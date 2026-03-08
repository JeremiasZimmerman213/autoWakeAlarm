import { describe, expect, it } from "vitest";
import {
  computeWakeTime,
  isWakeTimeInFuture,
  isWakeTimeMissed,
  minutesToMs,
  minutesToSeconds,
  msToMinutes,
  msToSeconds,
  secondsToMs
} from "../src/utils/time.js";

describe("time utilities", () => {
  it("computes wake time from sleep start plus duration minutes", () => {
    const sleepStartMs = 1_700_000_000_000;
    const durationMin = 480;

    expect(computeWakeTime(sleepStartMs, durationMin)).toBe(sleepStartMs + 480 * 60 * 1000);
  });

  it("converts minutes/seconds/milliseconds consistently", () => {
    expect(minutesToSeconds(3)).toBe(180);
    expect(secondsToMs(45)).toBe(45_000);
    expect(minutesToMs(2)).toBe(120_000);
    expect(msToSeconds(9_000)).toBe(9);
    expect(msToMinutes(180_000)).toBe(3);
  });

  it("evaluates wake time future and missed checks", () => {
    const nowMs = 5_000;

    expect(isWakeTimeInFuture(5_001, nowMs)).toBe(true);
    expect(isWakeTimeInFuture(5_000, nowMs)).toBe(false);
    expect(isWakeTimeMissed(5_000, nowMs)).toBe(true);
    expect(isWakeTimeMissed(4_999, nowMs)).toBe(true);
  });

  it("rejects non-integer minute durations for wake-time computation", () => {
    expect(() => computeWakeTime(1000, 0)).toThrow();
    expect(() => computeWakeTime(1000, 90.5)).toThrow();
  });
});
