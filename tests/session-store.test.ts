import { describe, expect, it } from "vitest";
import { SESSION_SCHEMA_VERSION, type SessionSnapshot } from "../src/core/types.js";
import {
  deserializeSession,
  InMemorySessionStore,
  serializeSession
} from "../src/storage/session-store.js";

describe("session store", () => {
  it("serializes and deserializes a valid session snapshot", () => {
    const snapshot: SessionSnapshot = {
      version: SESSION_SCHEMA_VERSION,
      savedAtMs: 1_700_000_100_000,
      state: {
        status: "armed_waiting_for_sleep",
        targetDurationMin: 480,
        armedAtMs: 1_700_000_000_000
      }
    };

    const serialized = serializeSession(snapshot);
    expect(deserializeSession(serialized)).toEqual(snapshot);
  });

  it("returns null for invalid serialized payloads", () => {
    expect(deserializeSession("{not-json")).toBeNull();
    expect(deserializeSession(" ")).toBeNull();

    const wrongVersion = JSON.stringify({
      version: 999,
      savedAtMs: 1,
      state: {
        status: "armed_waiting_for_sleep",
        targetDurationMin: 480,
        armedAtMs: 1
      }
    });

    expect(deserializeSession(wrongVersion)).toBeNull();
  });

  it("in-memory store supports save, load, and clear", async () => {
    const store = new InMemorySessionStore();
    const snapshot: SessionSnapshot = {
      version: SESSION_SCHEMA_VERSION,
      savedAtMs: 1_700_000_100_000,
      state: {
        status: "missed_target",
        targetDurationMin: 420,
        sleepStartMs: 1_700_000_000_000,
        wakeTimeMs: 1_700_025_200_000,
        detectedAtMs: 1_700_026_000_000
      }
    };

    await store.saveSession(snapshot);
    await expect(store.loadSession()).resolves.toEqual(snapshot);

    await store.clearSession();
    await expect(store.loadSession()).resolves.toBeNull();
  });
});
