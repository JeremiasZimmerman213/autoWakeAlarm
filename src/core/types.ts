export type EpochMs = number;
export type DurationMin = number;
export type AlarmId = string | number;

export const SESSION_SCHEMA_VERSION = 1 as const;

export type AppState =
  | { status: "idle" }
  | {
      status: "armed_waiting_for_sleep";
      targetDurationMin: DurationMin;
      armedAtMs: EpochMs;
    }
  | {
      status: "sleep_detected_alarm_scheduled";
      targetDurationMin: DurationMin;
      sleepStartMs: EpochMs;
      wakeTimeMs: EpochMs;
      alarmId: AlarmId;
    }
  | {
      status: "missed_target";
      targetDurationMin: DurationMin;
      sleepStartMs: EpochMs;
      wakeTimeMs: EpochMs;
      detectedAtMs: EpochMs;
    }
  | { status: "alarm_fired"; wakeTimeMs: EpochMs }
  | { status: "error"; message: string };

export type PersistableState = Extract<
  AppState,
  { status: "armed_waiting_for_sleep" | "sleep_detected_alarm_scheduled" | "missed_target" }
>;

export interface SessionSnapshot {
  readonly version: typeof SESSION_SCHEMA_VERSION;
  readonly savedAtMs: EpochMs;
  readonly state: PersistableState;
}

export type AppEvent =
  | {
      type: "ARM";
      durationMinutes: DurationMin;
      armedAtMs: EpochMs;
    }
  | { type: "CANCEL" }
  | { type: "SLEEP_SIGNAL_RECEIVED"; receivedAtMs: EpochMs }
  | {
      type: "SLEEP_START_CONFIRMED";
      startTimeMs: EpochMs;
      detectedAtMs: EpochMs;
      alarmId?: AlarmId;
    }
  | {
      type: "WAKE_TIME_MISSED";
      sleepStartMs: EpochMs;
      wakeTimeMs: EpochMs;
      detectedAtMs: EpochMs;
    }
  | {
      type: "ALARM_SCHEDULED";
      alarmId: AlarmId;
      sleepStartMs: EpochMs;
      wakeTimeMs: EpochMs;
    }
  | { type: "ALARM_FIRED" }
  | { type: "ERROR"; message: string };

export type StateEffect =
  | {
      type: "SCHEDULE_ALARM";
      sleepStartMs: EpochMs;
      wakeTimeMs: EpochMs;
      targetDurationMin: DurationMin;
    }
  | {
      type: "CANCEL_ALARM";
      alarmId: AlarmId;
    };

export interface TransitionResult {
  readonly state: AppState;
  readonly effects: ReadonlyArray<StateEffect>;
}

export function isIntegerMinutes(value: number): value is DurationMin {
  return Number.isInteger(value) && value > 0;
}

export function isPersistableState(state: AppState): state is PersistableState {
  return (
    state.status === "armed_waiting_for_sleep" ||
    state.status === "sleep_detected_alarm_scheduled" ||
    state.status === "missed_target"
  );
}
