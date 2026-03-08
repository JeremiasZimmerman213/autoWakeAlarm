import { describe, expect, it } from "vitest";
import { ALARM_DESTINATION_PATH, toAlarmSetOptions, toUtcSeconds } from "../src/alarm/alarm-adapter.js";

describe("alarm adapter pure helpers", () => {
  it("converts epoch milliseconds to UTC seconds using floor", () => {
    expect(toUtcSeconds(1_701_234_567_890)).toBe(1_701_234_567);
    expect(toUtcSeconds(1_000)).toBe(1);
    expect(toUtcSeconds(999)).toBe(0);
  });

  it("creates Zepp alarm set options with centralized destination path", () => {
    const wakeTimeMs = 1_701_234_567_890;

    expect(toAlarmSetOptions(wakeTimeMs)).toEqual({
      url: ALARM_DESTINATION_PATH,
      time: 1_701_234_567,
      store: true
    });
  });

  it("rejects invalid wake times for scheduling", () => {
    expect(toAlarmSetOptions(0)).toBeNull();
    expect(toAlarmSetOptions(-100)).toBeNull();
  });
});
