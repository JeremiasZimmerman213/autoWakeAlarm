import type { AlarmId, EpochMs } from "../core/types.js";
import { MS_PER_SECOND } from "../utils/time.js";

// TODO(zepp-validation): Confirm this path matches the final built App Service entry path.
export const ALARM_DESTINATION_PATH = "app-service/sleep_alarm_service";

interface ZeppAlarmSetOptions {
  readonly url: string;
  readonly time: number;
  readonly store: true;
}

interface ZeppAlarmModule {
  set(options: ZeppAlarmSetOptions): number;
  // TODO(zepp-validation): Confirm whether `cancel(id)` vs `cancel({ id })` is preferred on Helio firmware.
  cancel(id: number | { id: number }): void;
}

export interface AlarmScheduleSuccess {
  readonly ok: true;
  readonly alarmId: number;
  readonly scheduledUtcSeconds: number;
}

export interface AlarmScheduleFailure {
  readonly ok: false;
  readonly reason: "invalid_wake_time" | "set_returned_zero" | "zepp_alarm_error";
}

export type AlarmScheduleResult = AlarmScheduleSuccess | AlarmScheduleFailure;

export interface AlarmCancelSuccess {
  readonly ok: true;
}

export interface AlarmCancelFailure {
  readonly ok: false;
  readonly reason: "invalid_alarm_id" | "zepp_alarm_error";
}

export type AlarmCancelResult = AlarmCancelSuccess | AlarmCancelFailure;

export interface AlarmAdapter {
  scheduleAlarm(wakeTimeMs: EpochMs): Promise<AlarmScheduleResult>;
  cancelAlarm(alarmId: AlarmId): Promise<AlarmCancelResult>;
}

export function createZeppAlarmAdapter(
  destinationPath: string = ALARM_DESTINATION_PATH
): AlarmAdapter {
  let alarmModulePromise: Promise<ZeppAlarmModule> | null = null;

  async function getAlarmModule(): Promise<ZeppAlarmModule> {
    if (alarmModulePromise === null) {
      alarmModulePromise = import("@zos/alarm") as Promise<ZeppAlarmModule>;
    }

    return alarmModulePromise;
  }

  return {
    async scheduleAlarm(wakeTimeMs: EpochMs): Promise<AlarmScheduleResult> {
      const setOptions = toAlarmSetOptions(wakeTimeMs, destinationPath);
      if (setOptions === null) {
        return { ok: false, reason: "invalid_wake_time" };
      }

      try {
        const module = await getAlarmModule();
        const alarmId = module.set(setOptions);

        if (alarmId === 0) {
          return { ok: false, reason: "set_returned_zero" };
        }

        return {
          ok: true,
          alarmId,
          scheduledUtcSeconds: setOptions.time
        };
      } catch {
        return { ok: false, reason: "zepp_alarm_error" };
      }
    },

    async cancelAlarm(alarmId: AlarmId): Promise<AlarmCancelResult> {
      if (!isValidZeppAlarmId(alarmId)) {
        return { ok: false, reason: "invalid_alarm_id" };
      }

      try {
        const module = await getAlarmModule();
        module.cancel(alarmId);
        return { ok: true };
      } catch {
        return { ok: false, reason: "zepp_alarm_error" };
      }
    }
  };
}

export function toUtcSeconds(epochMs: EpochMs): number {
  if (!Number.isFinite(epochMs)) {
    throw new Error("epochMs must be a finite number.");
  }

  return Math.floor(epochMs / MS_PER_SECOND);
}

export function toAlarmSetOptions(
  wakeTimeMs: EpochMs,
  destinationPath: string = ALARM_DESTINATION_PATH
): ZeppAlarmSetOptions | null {
  if (!Number.isFinite(wakeTimeMs) || wakeTimeMs <= 0) {
    return null;
  }

  const utcSeconds = toUtcSeconds(wakeTimeMs);
  if (utcSeconds <= 0) {
    return null;
  }

  return {
    url: destinationPath,
    time: utcSeconds,
    store: true
  };
}

function isValidZeppAlarmId(alarmId: AlarmId): alarmId is number {
  return typeof alarmId === "number" && Number.isInteger(alarmId) && alarmId > 0;
}
