import { describe, expect, it } from "vitest";
import {
  normalizeSleepStartToEpochMs,
  normalizeZeppSleepStart,
  isValidMinutesFromMidnight
} from "../src/sleep/sleep-parser.js";

describe("sleep parser", () => {
  it("converts minutes-after-midnight to epoch ms for the same local day", () => {
    const referenceNowMs = new Date(2026, 2, 8, 10, 15, 0, 0).getTime();

    const result = normalizeSleepStartToEpochMs({
      startTimeMinutesFromMidnight: 7 * 60 + 30,
      referenceNowMs
    });

    expect(result).toBe(new Date(2026, 2, 8, 7, 30, 0, 0).getTime());
  });

  it("falls back to yesterday when today's candidate is too far in the future", () => {
    const referenceNowMs = new Date(2026, 2, 8, 0, 30, 0, 0).getTime();

    const result = normalizeSleepStartToEpochMs({
      startTimeMinutesFromMidnight: 23 * 60,
      referenceNowMs
    });

    expect(result).toBe(new Date(2026, 2, 7, 23, 0, 0, 0).getTime());
  });

  it("keeps today's candidate when future skew is within tolerance", () => {
    const referenceNowMs = new Date(2026, 2, 8, 22, 58, 0, 0).getTime();

    const result = normalizeSleepStartToEpochMs({
      startTimeMinutesFromMidnight: 23 * 60,
      referenceNowMs,
      maxFutureDriftMin: 5
    });

    expect(result).toBe(new Date(2026, 2, 8, 23, 0, 0, 0).getTime());
  });

  it("returns null for invalid start-time minute values", () => {
    expect(
      normalizeSleepStartToEpochMs({
        startTimeMinutesFromMidnight: -1,
        referenceNowMs: Date.now()
      })
    ).toBeNull();

    expect(
      normalizeSleepStartToEpochMs({
        startTimeMinutesFromMidnight: 1_440,
        referenceNowMs: Date.now()
      })
    ).toBeNull();

    expect(isValidMinutesFromMidnight(42.5)).toBe(false);
  });

  it("normalizes Zepp sleep info into internal sleep start info", () => {
    const referenceNowMs = new Date(2026, 2, 8, 8, 0, 0, 0).getTime();

    const result = normalizeZeppSleepStart(
      {
        score: 90,
        deepTime: 120,
        startTime: 2 * 60,
        endTime: 7 * 60,
        totalTime: 300
      },
      referenceNowMs
    );

    expect(result).toEqual({
      startTimeMs: new Date(2026, 2, 8, 2, 0, 0, 0).getTime(),
      detectedAtMs: referenceNowMs
    });
  });
});
