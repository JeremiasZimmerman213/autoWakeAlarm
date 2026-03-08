import type { AlarmId, EpochMs } from "../core/types.js";

export interface AlarmAdapter {
  scheduleAt(wakeTimeMs: EpochMs): Promise<AlarmId>;
  cancel(alarmId: AlarmId): Promise<void>;
}
