import type { AlarmId, EpochMs } from "../core/types.js";
import type { Logger } from "../debug/logger.js";
import { NoopLogger } from "../debug/logger.js";
import { MS_PER_SECOND } from "../utils/time.js";
import { APP_SERVICE_ENTRY_PATH } from "../config/runtime-paths.js";

export const ALARM_DESTINATION_PATH = APP_SERVICE_ENTRY_PATH;

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

export interface AlarmAdapterOptions {
  readonly destinationPath?: string;
  readonly logger?: Logger;
}

export function createZeppAlarmAdapter(
  options: AlarmAdapterOptions = {}
): AlarmAdapter {
  const destinationPath = options.destinationPath ?? ALARM_DESTINATION_PATH;
  const logger = options.logger ?? new NoopLogger();
  let alarmModulePromise: Promise<ZeppAlarmModule> | null = null;

  async function getAlarmModule(): Promise<ZeppAlarmModule> {
    if (alarmModulePromise === null) {
      alarmModulePromise = import("@zos/alarm") as Promise<ZeppAlarmModule>;
    }

    return alarmModulePromise;
  }

  return {
    async scheduleAlarm(wakeTimeMs: EpochMs): Promise<AlarmScheduleResult> {
      logger.info("Alarm schedule attempt.", { wakeTimeMs, destinationPath });
      const setOptions = toAlarmSetOptions(wakeTimeMs, destinationPath);
      if (setOptions === null) {
        logger.warn("Alarm schedule rejected due to invalid wake time.", { wakeTimeMs });
        return { ok: false, reason: "invalid_wake_time" };
      }

      try {
        const module = await getAlarmModule();
        const alarmId = module.set(setOptions);

        if (alarmId === 0) {
          logger.warn("Alarm schedule failed: Zepp returned 0.", { wakeTimeMs });
          return { ok: false, reason: "set_returned_zero" };
        }

        logger.info("Alarm schedule success.", {
          alarmId,
          scheduledUtcSeconds: setOptions.time
        });
        return {
          ok: true,
          alarmId,
          scheduledUtcSeconds: setOptions.time
        };
      } catch {
        logger.error("Alarm schedule failed with Zepp alarm error.", { wakeTimeMs });
        return { ok: false, reason: "zepp_alarm_error" };
      }
    },

    async cancelAlarm(alarmId: AlarmId): Promise<AlarmCancelResult> {
      logger.info("Alarm cancel attempt.", { alarmId });
      if (!isValidZeppAlarmId(alarmId)) {
        logger.warn("Alarm cancel rejected due to invalid alarm id.", { alarmId });
        return { ok: false, reason: "invalid_alarm_id" };
      }

      try {
        const module = await getAlarmModule();
        module.cancel(alarmId);
        logger.info("Alarm cancel success.", { alarmId });
        return { ok: true };
      } catch {
        logger.error("Alarm cancel failed with Zepp alarm error.", { alarmId });
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
