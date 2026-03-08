export const SESSION_SCHEMA_VERSION = 1;
export function isIntegerMinutes(value) {
    return Number.isInteger(value) && value > 0;
}
export function isPersistableState(state) {
    return (state.status === "armed_waiting_for_sleep" ||
        state.status === "sleep_detected_alarm_scheduled" ||
        state.status === "missed_target");
}
