import { createZeppAlarmAdapter } from "../alarm/alarm-adapter.js";
import { INITIAL_APP_STATE, reduceAppState } from "../core/state-machine.js";
import {
  isPersistableState,
  SESSION_SCHEMA_VERSION,
  type AppState,
  type PersistableState,
  type StateEffect
} from "../core/types.js";
import { createZeppSessionStore } from "../storage/session-store.js";
import * as hmUI from "@zos/ui";

const DURATION_OPTIONS_MIN = [360, 420, 450, 480, 540] as const;

const LAYOUT = {
  left: 12,
  width: 168,
  titleY: 28,
  durationY: 74,
  statusY: 110,
  detailY: 150,
  changeButtonY: 204,
  armButtonY: 264,
  cancelButtonY: 324,
  rowHeight: 40,
  textSize: 22,
  statusSize: 20,
  buttonHeight: 44
} as const;

const sessionStore = createZeppSessionStore();
const alarmAdapter = createZeppAlarmAdapter();

const pageState = {
  durationIndex: 3,
  statusText: "Status: Loading",
  detailText: ""
};

type TextWidget = ReturnType<typeof hmUI.createWidget>;

let durationWidget: TextWidget | null = null;
let statusWidget: TextWidget | null = null;
let detailWidget: TextWidget | null = null;

Page({
  onInit(): void {
    void refreshFromPersistedState();
  },

  build(): void {
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
      h: 46,
      text: "",
      text_size: 16
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

  onDestroy(): void {
    durationWidget = null;
    statusWidget = null;
    detailWidget = null;
  }
});

function cycleDuration(): void {
  pageState.durationIndex = (pageState.durationIndex + 1) % DURATION_OPTIONS_MIN.length;
  render();
}

async function armWorkflow(): Promise<void> {
  const currentState = await loadCurrentAppState();
  const transition = reduceAppState(currentState, {
    type: "ARM",
    durationMinutes: currentDurationMin(),
    armedAtMs: Date.now()
  });

  await applyEffects(transition.effects);
  await persistAppState(transition.state);
  await refreshFromPersistedState();
}

async function cancelWorkflow(): Promise<void> {
  const currentState = await loadCurrentAppState();
  const transition = reduceAppState(currentState, { type: "CANCEL" });

  await applyEffects(transition.effects);
  await persistAppState(transition.state);
  await refreshFromPersistedState();
}

async function refreshFromPersistedState(): Promise<void> {
  const appState = await loadCurrentAppState();

  if (hasDuration(appState)) {
    const matchedIndex = DURATION_OPTIONS_MIN.findIndex((value) => value === appState.targetDurationMin);
    if (matchedIndex >= 0) {
      pageState.durationIndex = matchedIndex;
    }
  }

  pageState.statusText = formatStatusLabel(appState);
  pageState.detailText = formatDetailLabel(appState);
  render();
}

async function applyEffects(effects: ReadonlyArray<StateEffect>): Promise<void> {
  for (const effect of effects) {
    if (effect.type === "CANCEL_ALARM") {
      await alarmAdapter.cancelAlarm(effect.alarmId);
      continue;
    }

    // TODO(phase-4): SCHEDULE_ALARM effect handling stays in service/orchestrator flow.
  }
}

async function loadCurrentAppState(): Promise<AppState> {
  const snapshot = await sessionStore.loadSession();
  if (snapshot === null) {
    return INITIAL_APP_STATE;
  }

  return snapshot.state;
}

async function persistAppState(state: AppState): Promise<void> {
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

function currentDurationMin(): number {
  return DURATION_OPTIONS_MIN[pageState.durationIndex] ?? DURATION_OPTIONS_MIN[0];
}

function hasDuration(state: AppState): state is PersistableState {
  return (
    state.status === "armed_waiting_for_sleep" ||
    state.status === "sleep_detected_alarm_scheduled" ||
    state.status === "missed_target"
  );
}

function render(): void {
  if (durationWidget !== null) {
    // TODO(zepp-validation): Confirm hmUI.prop.MORE text updates are stable on Helio firmware.
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
}

function formatStatusLabel(state: AppState): string {
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

function formatDetailLabel(state: AppState): string {
  if (state.status === "sleep_detected_alarm_scheduled") {
    return `Wake: ${formatClock(state.wakeTimeMs)}`;
  }

  if (state.status === "missed_target") {
    return `Wake passed: ${formatClock(state.wakeTimeMs)}`;
  }

  if (state.status === "error") {
    return state.message;
  }

  return "";
}

function formatClock(epochMs: number): string {
  const date = new Date(epochMs);
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}
