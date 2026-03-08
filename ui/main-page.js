import { createZeppAlarmAdapter } from "../alarm/alarm-adapter.js";
import { INITIAL_APP_STATE, reduceAppState } from "../core/state-machine.js";
import { isPersistableState, SESSION_SCHEMA_VERSION } from "../core/types.js";
import { ConsoleLogger } from "../debug/logger.js";
import { createZeppSessionStore } from "../storage/session-store.js";
import { formatEpochForDisplay } from "../utils/debug-format.js";
import * as hmUI from "@zos/ui";
const DURATION_OPTIONS_MIN = [360, 420, 450, 480, 540];
const LAYOUT = {
    left: 12,
    width: 168,
    titleY: 22,
    durationY: 62,
    statusY: 98,
    detailY: 132,
    debugY: 168,
    changeButtonY: 246,
    armButtonY: 300,
    cancelButtonY: 354,
    rowHeight: 34,
    textSize: 22,
    statusSize: 18,
    buttonHeight: 42
};
const logger = new ConsoleLogger();
const sessionStore = createZeppSessionStore();
const alarmAdapter = createZeppAlarmAdapter({ logger });
const pageState = {
    durationIndex: 3,
    statusText: "Status: Loading",
    detailText: "",
    debugText: "Debug: --"
};
let durationWidget = null;
let statusWidget = null;
let detailWidget = null;
let debugWidget = null;
Page({
    onInit() {
        logger.info("Page onInit.");
        void refreshFromPersistedState();
    },
    build() {
        logger.info("Page build.");
        hmUI.createWidget(hmUI.widget.TEXT, {
            x: LAYOUT.left,
            y: LAYOUT.titleY,
            w: LAYOUT.width,
            h: LAYOUT.rowHeight,
            text: "Sleep Alarm",
            text_size: LAYOUT.textSize
        });
        durationWidget = hmUI.createWidget(hmUI.widget.TEXT, {
            x: LAYOUT.left,
            y: LAYOUT.durationY,
            w: LAYOUT.width,
            h: LAYOUT.rowHeight,
            text: "Duration: --",
            text_size: LAYOUT.statusSize
        });
        statusWidget = hmUI.createWidget(hmUI.widget.TEXT, {
            x: LAYOUT.left,
            y: LAYOUT.statusY,
            w: LAYOUT.width,
            h: LAYOUT.rowHeight,
            text: "Status: --",
            text_size: LAYOUT.statusSize
        });
        detailWidget = hmUI.createWidget(hmUI.widget.TEXT, {
            x: LAYOUT.left,
            y: LAYOUT.detailY,
            w: LAYOUT.width,
            h: LAYOUT.rowHeight,
            text: "",
            text_size: 16
        });
        debugWidget = hmUI.createWidget(hmUI.widget.TEXT, {
            x: LAYOUT.left,
            y: LAYOUT.debugY,
            w: LAYOUT.width,
            h: 72,
            text: "Debug: --",
            text_size: 14
        });
        hmUI.createWidget(hmUI.widget.BUTTON, {
            x: LAYOUT.left,
            y: LAYOUT.changeButtonY,
            w: LAYOUT.width,
            h: LAYOUT.buttonHeight,
            text: "Change Duration",
            click_func: () => {
                cycleDuration();
            }
        });
        hmUI.createWidget(hmUI.widget.BUTTON, {
            x: LAYOUT.left,
            y: LAYOUT.armButtonY,
            w: LAYOUT.width,
            h: LAYOUT.buttonHeight,
            text: "Arm",
            click_func: () => {
                void armWorkflow();
            }
        });
        hmUI.createWidget(hmUI.widget.BUTTON, {
            x: LAYOUT.left,
            y: LAYOUT.cancelButtonY,
            w: LAYOUT.width,
            h: LAYOUT.buttonHeight,
            text: "Cancel",
            click_func: () => {
                void cancelWorkflow();
            }
        });
        render();
        void refreshFromPersistedState();
    },
    onDestroy() {
        logger.info("Page onDestroy.");
        durationWidget = null;
        statusWidget = null;
        detailWidget = null;
        debugWidget = null;
    }
});
function cycleDuration() {
    pageState.durationIndex = (pageState.durationIndex + 1) % DURATION_OPTIONS_MIN.length;
    logger.info("Duration changed.", { selectedDurationMin: currentDurationMin() });
    render();
}
async function armWorkflow() {
    logger.info("Arm tapped.", { selectedDurationMin: currentDurationMin() });
    const currentState = await loadCurrentAppState();
    const transition = reduceAppState(currentState, {
        type: "ARM",
        durationMinutes: currentDurationMin(),
        armedAtMs: Date.now()
    });
    await applyEffects(transition.effects);
    await persistAppState(transition.state);
    logger.info("Arm flow persisted.", { nextStatus: transition.state.status });
    await refreshFromPersistedState();
}
async function cancelWorkflow() {
    logger.info("Cancel tapped.");
    const currentState = await loadCurrentAppState();
    const transition = reduceAppState(currentState, { type: "CANCEL" });
    await applyEffects(transition.effects);
    await persistAppState(transition.state);
    logger.info("Cancel flow persisted.", { nextStatus: transition.state.status });
    await refreshFromPersistedState();
}
async function refreshFromPersistedState() {
    const appState = await loadCurrentAppState();
    if (hasDuration(appState)) {
        const matchedIndex = DURATION_OPTIONS_MIN.findIndex((value) => value === appState.targetDurationMin);
        if (matchedIndex >= 0) {
            pageState.durationIndex = matchedIndex;
        }
    }
    pageState.statusText = formatStatusLabel(appState);
    pageState.detailText = formatDetailLabel(appState);
    pageState.debugText = formatDebugSummary(appState);
    logger.info("Persisted state loaded for page.", {
        status: appState.status,
        selectedDurationMin: currentDurationMin()
    });
    render();
}
async function applyEffects(effects) {
    for (const effect of effects) {
        if (effect.type === "CANCEL_ALARM") {
            const result = await alarmAdapter.cancelAlarm(effect.alarmId);
            logger.info("Page cancel-alarm effect applied.", {
                alarmId: effect.alarmId,
                success: result.ok
            });
            continue;
        }
        logger.info("Page ignored non-cancel effect.", { effectType: effect.type });
    }
}
async function loadCurrentAppState() {
    const snapshot = await sessionStore.loadSession();
    if (snapshot === null) {
        return INITIAL_APP_STATE;
    }
    return snapshot.state;
}
async function persistAppState(state) {
    if (isPersistableState(state)) {
        await sessionStore.saveSession({
            version: SESSION_SCHEMA_VERSION,
            savedAtMs: Date.now(),
            state
        });
        return;
    }
    await sessionStore.clearSession();
}
function currentDurationMin() {
    return DURATION_OPTIONS_MIN[pageState.durationIndex] ?? DURATION_OPTIONS_MIN[0];
}
function hasDuration(state) {
    return (state.status === "armed_waiting_for_sleep" ||
        state.status === "sleep_detected_alarm_scheduled" ||
        state.status === "missed_target");
}
function render() {
    if (durationWidget !== null) {
        durationWidget.setProperty(hmUI.prop.MORE, {
            text: `Duration: ${currentDurationMin()} min`
        });
    }
    if (statusWidget !== null) {
        statusWidget.setProperty(hmUI.prop.MORE, {
            text: pageState.statusText
        });
    }
    if (detailWidget !== null) {
        detailWidget.setProperty(hmUI.prop.MORE, {
            text: pageState.detailText
        });
    }
    if (debugWidget !== null) {
        debugWidget.setProperty(hmUI.prop.MORE, {
            text: pageState.debugText
        });
    }
}
function formatStatusLabel(state) {
    if (state.status === "idle") {
        return "Status: Not armed";
    }
    if (state.status === "armed_waiting_for_sleep") {
        return "Status: Waiting for sleep";
    }
    if (state.status === "sleep_detected_alarm_scheduled") {
        return "Status: Alarm scheduled";
    }
    if (state.status === "missed_target") {
        return "Status: Missed target";
    }
    if (state.status === "alarm_fired") {
        return "Status: Alarm fired";
    }
    return "Status: Error";
}
function formatDetailLabel(state) {
    if (state.status === "sleep_detected_alarm_scheduled") {
        return `Wake: ${formatEpochForDisplay(state.wakeTimeMs)}`;
    }
    if (state.status === "missed_target") {
        return `Wake passed: ${formatEpochForDisplay(state.wakeTimeMs)}`;
    }
    if (state.status === "error") {
        return state.message;
    }
    return "";
}
function formatDebugSummary(state) {
    if (state.status === "armed_waiting_for_sleep") {
        return `st:${state.status} dur:${state.targetDurationMin} arm:${formatEpochForDisplay(state.armedAtMs)}`;
    }
    if (state.status === "sleep_detected_alarm_scheduled") {
        return `st:${state.status} dur:${state.targetDurationMin}\ns:${formatEpochForDisplay(state.sleepStartMs)} w:${formatEpochForDisplay(state.wakeTimeMs)} id:${state.alarmId}`;
    }
    if (state.status === "missed_target") {
        return `st:${state.status} dur:${state.targetDurationMin}\ns:${formatEpochForDisplay(state.sleepStartMs)} w:${formatEpochForDisplay(state.wakeTimeMs)}`;
    }
    if (state.status === "alarm_fired") {
        return `st:${state.status} wake:${formatEpochForDisplay(state.wakeTimeMs)}`;
    }
    if (state.status === "error") {
        return `st:error msg:${state.message}`;
    }
    return `st:idle dur:${currentDurationMin()}`;
}
