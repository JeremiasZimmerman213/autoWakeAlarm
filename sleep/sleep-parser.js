import { minutesToMs } from "../utils/time.js";
const MINUTES_PER_DAY = 24 * 60;
export const DEFAULT_MAX_FUTURE_DRIFT_MIN = 5;
export function normalizeZeppSleepStart(sleepInfo, referenceNowMs) {
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
export function normalizeSleepStartToEpochMs(input) {
    if (!isValidMinutesFromMidnight(input.startTimeMinutesFromMidnight)) {
        return null;
    }
    const maxFutureDriftMin = input.maxFutureDriftMin ?? DEFAULT_MAX_FUTURE_DRIFT_MIN;
    const todayCandidateMs = buildLocalDayTimeEpochMs(input.referenceNowMs, 0, input.startTimeMinutesFromMidnight);
    const futureLimitMs = input.referenceNowMs + minutesToMs(maxFutureDriftMin);
    // Conservative midnight crossing rule: if today's candidate is too far in the future,
    // interpret startTime as belonging to yesterday.
    if (todayCandidateMs > futureLimitMs) {
        return buildLocalDayTimeEpochMs(input.referenceNowMs, -1, input.startTimeMinutesFromMidnight);
    }
    return todayCandidateMs;
}
export function getLocalMidnightEpochMs(referenceNowMs) {
    const localDate = new Date(referenceNowMs);
    localDate.setHours(0, 0, 0, 0);
    return localDate.getTime();
}
function buildLocalDayTimeEpochMs(referenceNowMs, dayOffset, minutesFromMidnight) {
    const localDate = new Date(referenceNowMs);
    localDate.setHours(0, 0, 0, 0);
    localDate.setDate(localDate.getDate() + dayOffset);
    localDate.setMinutes(minutesFromMidnight, 0, 0);
    return localDate.getTime();
}
export function isValidMinutesFromMidnight(value) {
    return Number.isInteger(value) && value >= 0 && value < MINUTES_PER_DAY;
}
