import { describe, expect, it } from "vitest";
import { INITIAL_APP_STATE, reduceAppState } from "../src/core/state-machine.js";
import type { AppState } from "../src/core/types.js";

describe("state machine", () => {
  it("arms from idle with target duration", () => {
    const result = reduceAppState(INITIAL_APP_STATE, {
      type: "ARM",
      durationMinutes: 480,
      armedAtMs: 1_000
    });

    expect(result.effects).toEqual([]);
    expect(result.state).toEqual({
      status: "armed_waiting_for_sleep",
      targetDurationMin: 480,
      armedAtMs: 1_000
    });
  });

  it("transitions to scheduled when sleep start is confirmed and alarm id is available", () => {
    const armedState: AppState = {
      status: "armed_waiting_for_sleep",
      targetDurationMin: 420,
      armedAtMs: 1_000
    };

    const result = reduceAppState(armedState, {
      type: "SLEEP_START_CONFIRMED",
      startTimeMs: 2_000,
      detectedAtMs: 2_001,
      alarmId: "alarm-1"
    });

    expect(result.effects).toEqual([]);
    expect(result.state).toEqual({
      status: "sleep_detected_alarm_scheduled",
      targetDurationMin: 420,
      sleepStartMs: 2_000,
      wakeTimeMs: 2_000 + 420 * 60 * 1000,
      alarmId: "alarm-1"
    });
  });

  it("emits schedule effect when wake time is in the future but alarm id is not yet known", () => {
    const armedState: AppState = {
      status: "armed_waiting_for_sleep",
      targetDurationMin: 360,
      armedAtMs: 10_000
    };

    const result = reduceAppState(armedState, {
      type: "SLEEP_START_CONFIRMED",
      startTimeMs: 12_000,
      detectedAtMs: 12_500
    });

    expect(result.state).toEqual({
      status: "armed_waiting_for_sleep",
      targetDurationMin: 360,
      armedAtMs: 10_000
    });
    expect(result.effects).toEqual([
      {
        type: "SCHEDULE_ALARM",
        sleepStartMs: 12_000,
        wakeTimeMs: 12_000 + 360 * 60 * 1000,
        targetDurationMin: 360
      }
    ]);
  });

  it("moves to missed_target when wake time has already passed", () => {
    const armedState: AppState = {
      status: "armed_waiting_for_sleep",
      targetDurationMin: 1,
      armedAtMs: 1_000
    };

    const result = reduceAppState(armedState, {
      type: "SLEEP_START_CONFIRMED",
      startTimeMs: 10_000,
      detectedAtMs: 70_000
    });

    expect(result.effects).toEqual([]);
    expect(result.state).toEqual({
      status: "missed_target",
      targetDurationMin: 1,
      sleepStartMs: 10_000,
      wakeTimeMs: 70_000,
      detectedAtMs: 70_000
    });
  });

  it("moves scheduled state to alarm_fired", () => {
    const scheduledState: AppState = {
      status: "sleep_detected_alarm_scheduled",
      targetDurationMin: 450,
      sleepStartMs: 5_000,
      wakeTimeMs: 27_005_000,
      alarmId: 123
    };

    const result = reduceAppState(scheduledState, { type: "ALARM_FIRED" });

    expect(result.state).toEqual({
      status: "alarm_fired",
      wakeTimeMs: 27_005_000
    });
    expect(result.effects).toEqual([]);
  });

  it("cancels scheduled state back to idle and emits alarm cancel effect", () => {
    const scheduledState: AppState = {
      status: "sleep_detected_alarm_scheduled",
      targetDurationMin: 450,
      sleepStartMs: 5_000,
      wakeTimeMs: 27_005_000,
      alarmId: "abc"
    };

    const result = reduceAppState(scheduledState, { type: "CANCEL" });

    expect(result.state).toEqual({ status: "idle" });
    expect(result.effects).toEqual([{ type: "CANCEL_ALARM", alarmId: "abc" }]);
  });
});
