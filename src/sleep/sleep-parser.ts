import type { EpochMs } from "../core/types.js";
import { minutesToMs } from "../utils/time.js";

export interface ZeppSleepInfo {
  readonly score: number;
  readonly deepTime: number;
  readonly startTime: number;
  readonly endTime: number;
  readonly totalTime: number;
}

export interface SleepStartInfo {
  readonly startTimeMs: EpochMs;
  readonly detectedAtMs: EpochMs;
}

export interface SleepStartConversionInput {
  readonly startTimeMinutesFromMidnight: number;
  readonly referenceNowMs: EpochMs;
  readonly maxFutureDriftMin?: number;
}

const MINUTES_PER_DAY = 24 * 60;
export const DEFAULT_MAX_FUTURE_DRIFT_MIN = 5;

export function normalizeZeppSleepStart(
  sleepInfo: ZeppSleepInfo | null,
  referenceNowMs: EpochMs
): SleepStartInfo | null {
  if (sleepInfo === null) {
    return null;
  }

  const startTimeMs = normalizeSleepStartToEpochMs({
    startTimeMinutesFromMidnight: sleepInfo.startTime,
    referenceNowMs
  });

  if (startTimeMs === null) {
    return null;
  }

  return {
    startTimeMs,
    detectedAtMs: referenceNowMs
  };
}

export function normalizeSleepStartToEpochMs(input: SleepStartConversionInput): EpochMs | null {
  if (!isValidMinutesFromMidnight(input.startTimeMinutesFromMidnight)) {
    return null;
  }

  const maxFutureDriftMin = input.maxFutureDriftMin ?? DEFAULT_MAX_FUTURE_DRIFT_MIN;
  const todayCandidateMs = buildLocalDayTimeEpochMs(
    input.referenceNowMs,
    0,
    input.startTimeMinutesFromMidnight
  );

  const futureLimitMs = input.referenceNowMs + minutesToMs(maxFutureDriftMin);

  // Conservative midnight crossing rule: if today's candidate is too far in the future,
  // interpret startTime as belonging to yesterday.
  if (todayCandidateMs > futureLimitMs) {
    return buildLocalDayTimeEpochMs(input.referenceNowMs, -1, input.startTimeMinutesFromMidnight);
  }

  return todayCandidateMs;
}

export function getLocalMidnightEpochMs(referenceNowMs: EpochMs): EpochMs {
  const localDate = new Date(referenceNowMs);
  localDate.setHours(0, 0, 0, 0);
  return localDate.getTime();
}

function buildLocalDayTimeEpochMs(
  referenceNowMs: EpochMs,
  dayOffset: number,
  minutesFromMidnight: number
): EpochMs {
  const localDate = new Date(referenceNowMs);
  localDate.setHours(0, 0, 0, 0);
  localDate.setDate(localDate.getDate() + dayOffset);
  localDate.setMinutes(minutesFromMidnight, 0, 0);
  return localDate.getTime();
}

export function isValidMinutesFromMidnight(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < MINUTES_PER_DAY;
}
