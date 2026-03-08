import { isIntegerMinutes } from "./types.js";
import { computeWakeTime, isWakeTimeInFuture } from "../utils/time.js";
export const INITIAL_APP_STATE = { status: "idle" };
export function reduceAppState(state, event) {
    switch (event.type) {
        case "ARM": {
            if (!isIntegerMinutes(event.durationMinutes)) {
                return {
                    state: { status: "error", message: "ARM duration must be a positive integer minute value." },
                    effects: []
                };
            }
            return {
                state: {
                    status: "armed_waiting_for_sleep",
                    targetDurationMin: event.durationMinutes,
                    armedAtMs: event.armedAtMs
                },
                effects: getAlarmCancelEffectIfNeeded(state)
            };
        }
        case "CANCEL": {
            if (state.status === "idle") {
                return unchanged(state);
            }
            return {
                state: { status: "idle" },
                effects: getAlarmCancelEffectIfNeeded(state)
            };
        }
        case "SLEEP_SIGNAL_RECEIVED": {
            return unchanged(state);
        }
        case "SLEEP_START_CONFIRMED": {
            if (state.status !== "armed_waiting_for_sleep") {
                return unchanged(state);
            }
            return handleSleepStartConfirmed(state, event.startTimeMs, event.detectedAtMs, event.alarmId);
        }
        case "WAKE_TIME_MISSED": {
            if (state.status !== "armed_waiting_for_sleep") {
                return unchanged(state);
            }
            return {
                state: {
                    status: "missed_target",
                    targetDurationMin: state.targetDurationMin,
                    sleepStartMs: event.sleepStartMs,
                    wakeTimeMs: event.wakeTimeMs,
                    detectedAtMs: event.detectedAtMs
                },
                effects: []
            };
        }
        case "ALARM_SCHEDULED": {
            if (state.status !== "armed_waiting_for_sleep") {
                return unchanged(state);
            }
            return {
                state: {
                    status: "sleep_detected_alarm_scheduled",
                    targetDurationMin: state.targetDurationMin,
                    sleepStartMs: event.sleepStartMs,
                    wakeTimeMs: event.wakeTimeMs,
                    alarmId: event.alarmId
                },
                effects: []
            };
        }
        case "ALARM_FIRED": {
            if (state.status !== "sleep_detected_alarm_scheduled") {
                return unchanged(state);
            }
            return {
                state: {
                    status: "alarm_fired",
                    wakeTimeMs: state.wakeTimeMs
                },
                effects: []
            };
        }
        case "ERROR": {
            return {
                state: {
                    status: "error",
                    message: event.message
                },
                effects: []
            };
        }
        default: {
            return exhaustiveGuard(event);
        }
    }
}
function handleSleepStartConfirmed(state, sleepStartMs, detectedAtMs, alarmId) {
    const targetDurationMin = state.targetDurationMin;
    const wakeTimeMs = computeWakeTime(sleepStartMs, targetDurationMin);
    if (!isWakeTimeInFuture(wakeTimeMs, detectedAtMs)) {
        return {
            state: {
                status: "missed_target",
                targetDurationMin,
                sleepStartMs,
                wakeTimeMs,
                detectedAtMs
            },
            effects: []
        };
    }
    // Assumption: if alarmId is available immediately, we can transition directly.
    if (alarmId !== undefined) {
        return {
            state: {
                status: "sleep_detected_alarm_scheduled",
                targetDurationMin,
                sleepStartMs,
                wakeTimeMs,
                alarmId
            },
            effects: []
        };
    }
    return {
        state: {
            status: "armed_waiting_for_sleep",
            targetDurationMin,
            armedAtMs: state.armedAtMs
        },
        effects: [
            {
                type: "SCHEDULE_ALARM",
                sleepStartMs,
                wakeTimeMs,
                targetDurationMin
            }
        ]
    };
}
function getAlarmCancelEffectIfNeeded(state) {
    if (state.status !== "sleep_detected_alarm_scheduled") {
        return [];
    }
    return [{ type: "CANCEL_ALARM", alarmId: state.alarmId }];
}
function unchanged(state) {
    return { state, effects: [] };
}
function exhaustiveGuard(unreachable) {
    throw new Error(`Unhandled event: ${JSON.stringify(unreachable)}`);
}
