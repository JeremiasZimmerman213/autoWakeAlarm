import type { AlarmAdapter } from "../alarm/alarm-adapter.js";
import type { Logger } from "../debug/logger.js";
import type { SleepAdapter } from "../sleep/sleep-adapter.js";
import type { SessionStore } from "../storage/session-store.js";
import { formatEpochForLog } from "../utils/debug-format.js";
import { INITIAL_APP_STATE, reduceAppState } from "./state-machine.js";
import {
  isPersistableState,
  SESSION_SCHEMA_VERSION,
  type AppState,
  type EpochMs,
  type StateEffect
} from "./types.js";

export type InvocationTrigger = "sleep_event" | "alarm_fire" | "unknown";

export interface OrchestratorInput {
  readonly trigger: InvocationTrigger;
  readonly rawOptions?: unknown;
}

export interface OrchestratorResult {
  readonly state: AppState;
  readonly didPersist: boolean;
  readonly didScheduleAlarm: boolean;
}

export interface Orchestrator {
  handleInvocation(input: OrchestratorInput): Promise<OrchestratorResult>;
}

export interface OrchestratorDeps {
  readonly sessionStore: SessionStore;
  readonly sleepAdapter: SleepAdapter;
  readonly alarmAdapter: AlarmAdapter;
  readonly logger: Logger;
  readonly now?: () => EpochMs;
}

export function createOrchestrator(deps: OrchestratorDeps): Orchestrator {
  const now = deps.now ?? (() => Date.now());

  return {
    async handleInvocation(input: OrchestratorInput): Promise<OrchestratorResult> {
      const snapshot = await deps.sessionStore.loadSession();
      if (snapshot === null) {
        deps.logger.info("No persisted session found.", { trigger: input.trigger });
        return {
          state: INITIAL_APP_STATE,
          didPersist: false,
          didScheduleAlarm: false
        };
      }

      let state: AppState = snapshot.state;
      const originalState = state;
      let didScheduleAlarm = false;
      deps.logger.info("Persisted session loaded.", {
        trigger: input.trigger,
        status: snapshot.state.status,
        savedAtMs: snapshot.savedAtMs
      });

      if (input.trigger === "alarm_fire") {
        const alarmTransition = reduceAppState(state, { type: "ALARM_FIRED" });
        state = alarmTransition.state;

        const didPersist = await persistStateIfNeeded(deps, snapshot.state, state, now());
        deps.logger.info("Alarm fire handling completed.", {
          previousStatus: snapshot.state.status,
          nextStatus: state.status
        });

        return { state, didPersist, didScheduleAlarm: false };
      }

      if (state.status === "sleep_detected_alarm_scheduled") {
        deps.logger.info("Session already has a scheduled alarm; skipping duplicate scheduling.", {
          alarmId: state.alarmId,
          wakeTimeMs: state.wakeTimeMs
        });

        return {
          state,
          didPersist: false,
          didScheduleAlarm: false
        };
      }

      if (state.status !== "armed_waiting_for_sleep") {
        deps.logger.info("Session is not armed waiting for sleep; nothing to do.", {
          status: state.status,
          trigger: input.trigger
        });

        return {
          state,
          didPersist: false,
          didScheduleAlarm: false
        };
      }

      const sleepStart = await deps.sleepAdapter.refreshAndReadSleepStart(now());
      if (sleepStart === null) {
        deps.logger.info("No normalized sleep start found; keeping armed waiting state.", {
          trigger: input.trigger
        });

        return {
          state,
          didPersist: false,
          didScheduleAlarm: false
        };
      }

      let transition = reduceAppState(state, {
        type: "SLEEP_START_CONFIRMED",
        startTimeMs: sleepStart.startTimeMs,
        detectedAtMs: sleepStart.detectedAtMs
      });
      state = transition.state;
      deps.logger.info("Sleep start confirmed for state transition.", {
        startTime: formatEpochForLog(sleepStart.startTimeMs),
        detectedAt: formatEpochForLog(sleepStart.detectedAtMs),
        nextStatus: state.status
      });

      if (transition.effects.length > 0) {
        const effectResult = await applyEffects(deps, state, transition.effects);
        state = effectResult.state;
        didScheduleAlarm = effectResult.didScheduleAlarm;
      }

      const didPersist = await persistStateIfNeeded(deps, originalState, state, now());
      deps.logger.info("Processed sleep-trigger invocation.", {
        previousStatus: originalState.status,
        nextStatus: state.status,
        didScheduleAlarm
      });

      return {
        state,
        didPersist,
        didScheduleAlarm
      };
    }
  };
}

async function applyEffects(
  deps: OrchestratorDeps,
  currentState: AppState,
  effects: ReadonlyArray<StateEffect>
): Promise<{ state: AppState; didScheduleAlarm: boolean }> {
  let state = currentState;
  let didScheduleAlarm = false;

  for (const effect of effects) {
    if (effect.type === "SCHEDULE_ALARM") {
      deps.logger.info("Computed wake time.", {
        sleepStart: formatEpochForLog(effect.sleepStartMs),
        wakeTime: formatEpochForLog(effect.wakeTimeMs),
        targetDurationMin: effect.targetDurationMin
      });
      const scheduleResult = await deps.alarmAdapter.scheduleAlarm(effect.wakeTimeMs);
      if (!scheduleResult.ok) {
        deps.logger.warn("Alarm scheduling failed.", {
          reason: scheduleResult.reason,
          wakeTimeMs: effect.wakeTimeMs
        });
        continue;
      }

      const scheduleTransition = reduceAppState(state, {
        type: "ALARM_SCHEDULED",
        alarmId: scheduleResult.alarmId,
        sleepStartMs: effect.sleepStartMs,
        wakeTimeMs: effect.wakeTimeMs
      });
      state = scheduleTransition.state;
      didScheduleAlarm = true;
      continue;
    }

    const cancelResult = await deps.alarmAdapter.cancelAlarm(effect.alarmId);
    if (!cancelResult.ok) {
      deps.logger.warn("Alarm cancel effect failed.", {
        reason: cancelResult.reason,
        alarmId: effect.alarmId
      });
    }
  }

  return {
    state,
    didScheduleAlarm
  };
}

async function persistStateIfNeeded(
  deps: OrchestratorDeps,
  previousState: AppState,
  nextState: AppState,
  savedAtMs: EpochMs
): Promise<boolean> {
  if (isSameState(previousState, nextState)) {
    return false;
  }

  if (isPersistableState(nextState)) {
    await deps.sessionStore.saveSession({
      version: SESSION_SCHEMA_VERSION,
      savedAtMs,
      state: nextState
    });
    deps.logger.info("Persisted session updated.", {
      previousStatus: previousState.status,
      nextStatus: nextState.status
    });
    return true;
  }

  await deps.sessionStore.clearSession();
  deps.logger.info("Persisted session cleared.", {
    previousStatus: previousState.status,
    nextStatus: nextState.status
  });
  return true;
}

function isSameState(left: AppState, right: AppState): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
