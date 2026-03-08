export const MS_PER_SECOND = 1_000;
export const SECONDS_PER_MINUTE = 60;
export const MS_PER_MINUTE = MS_PER_SECOND * SECONDS_PER_MINUTE;
export function secondsToMs(seconds) {
    return seconds * MS_PER_SECOND;
}
export function minutesToSeconds(minutes) {
    return minutes * SECONDS_PER_MINUTE;
}
export function minutesToMs(minutes) {
    return minutes * MS_PER_MINUTE;
}
export function msToSeconds(milliseconds) {
    return milliseconds / MS_PER_SECOND;
}
export function msToMinutes(milliseconds) {
    return milliseconds / MS_PER_MINUTE;
}
export function computeWakeTime(startMs, durationMin) {
    if (!Number.isInteger(durationMin) || durationMin <= 0) {
        throw new Error("durationMin must be a positive integer minute value.");
    }
    return startMs + minutesToMs(durationMin);
}
export function isWakeTimeInFuture(wakeTimeMs, nowMs) {
    return wakeTimeMs > nowMs;
}
export function isWakeTimeMissed(wakeTimeMs, nowMs) {
    return !isWakeTimeInFuture(wakeTimeMs, nowMs);
}
