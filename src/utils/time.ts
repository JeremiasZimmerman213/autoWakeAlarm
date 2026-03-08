import type { DurationMin, EpochMs } from "../core/types.js";

export const MS_PER_SECOND = 1_000;
export const SECONDS_PER_MINUTE = 60;
export const MS_PER_MINUTE = MS_PER_SECOND * SECONDS_PER_MINUTE;

export function secondsToMs(seconds: number): number {
  return seconds * MS_PER_SECOND;
}

export function minutesToSeconds(minutes: number): number {
  return minutes * SECONDS_PER_MINUTE;
}

export function minutesToMs(minutes: number): number {
  return minutes * MS_PER_MINUTE;
}

export function msToSeconds(milliseconds: number): number {
  return milliseconds / MS_PER_SECOND;
}

export function msToMinutes(milliseconds: number): number {
  return milliseconds / MS_PER_MINUTE;
}

export function computeWakeTime(startMs: EpochMs, durationMin: DurationMin): EpochMs {
  if (!Number.isInteger(durationMin) || durationMin <= 0) {
    throw new Error("durationMin must be a positive integer minute value.");
  }

  return startMs + minutesToMs(durationMin);
}

export function isWakeTimeInFuture(wakeTimeMs: EpochMs, nowMs: EpochMs): boolean {
  return wakeTimeMs > nowMs;
}

export function isWakeTimeMissed(wakeTimeMs: EpochMs, nowMs: EpochMs): boolean {
  return !isWakeTimeInFuture(wakeTimeMs, nowMs);
}
