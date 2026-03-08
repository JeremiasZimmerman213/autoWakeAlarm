import { describe, expect, it } from "vitest";
import type {
  AlarmAdapter,
  AlarmCancelResult,
  AlarmScheduleResult
} from "../src/alarm/alarm-adapter.js";
import { createOrchestrator, type InvocationTrigger } from "../src/core/orchestrator.js";
import { SESSION_SCHEMA_VERSION, type SessionSnapshot } from "../src/core/types.js";
import type { Logger } from "../src/debug/logger.js";
import type { SleepAdapter } from "../src/sleep/sleep-adapter.js";
import type { SessionStore } from "../src/storage/session-store.js";

class MockSessionStore implements SessionStore {
  snapshot: SessionSnapshot | null;
  savedSnapshots: SessionSnapshot[] = [];
  clearCalls = 0;

  constructor(snapshot: SessionSnapshot | null) {
    this.snapshot = snapshot;
  }

  async saveSession(snapshot: SessionSnapshot): Promise<void> {
    this.snapshot = snapshot;
    this.savedSnapshots.push(snapshot);
  }

  async loadSession(): Promise<SessionSnapshot | null> {
    return this.snapshot;
  }

  async clearSession(): Promise<void> {
    this.snapshot = null;
    this.clearCalls += 1;
  }
}

class MockSleepAdapter implements SleepAdapter {
  nextSleepStart: { startTimeMs: number; detectedAtMs: number } | null;
  readCalls = 0;

  constructor(nextSleepStart: { startTimeMs: number; detectedAtMs: number } | null) {
    this.nextSleepStart = nextSleepStart;
  }

  async refreshAndReadSleepStart(): Promise<{ startTimeMs: number; detectedAtMs: number } | null> {
    this.readCalls += 1;
    return this.nextSleepStart;
  }

  subscribeToSleepSignal(): () => void {
    return () => {};
  }
}

class MockAlarmAdapter implements AlarmAdapter {
  scheduleCalls: number[] = [];
  cancelCalls: Array<number | string> = [];
  nextScheduleResult: AlarmScheduleResult;
  nextCancelResult: AlarmCancelResult = { ok: true };

  constructor(nextScheduleResult: AlarmScheduleResult) {
    this.nextScheduleResult = nextScheduleResult;
  }

  async scheduleAlarm(wakeTimeMs: number): Promise<AlarmScheduleResult> {
    this.scheduleCalls.push(wakeTimeMs);
    return this.nextScheduleResult;
  }

  async cancelAlarm(alarmId: number | string): Promise<AlarmCancelResult> {
    this.cancelCalls.push(alarmId);
    return this.nextCancelResult;
  }
}

class MockLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

describe("orchestrator", () => {
  it("armed + sleep found + future wake time schedules alarm", async () => {
    const sessionStore = new MockSessionStore({
      version: SESSION_SCHEMA_VERSION,
      savedAtMs: 1,
      state: {
        status: "armed_waiting_for_sleep",
        targetDurationMin: 10,
        armedAtMs: 1_000
      }
    });
    const sleepAdapter = new MockSleepAdapter({ startTimeMs: 2_000, detectedAtMs: 2_500 });
    const alarmAdapter = new MockAlarmAdapter({
      ok: true,
      alarmId: 77,
      scheduledUtcSeconds: 602
    });

    const orchestrator = createOrchestrator({
      sessionStore,
      sleepAdapter,
      alarmAdapter,
      logger: new MockLogger(),
      now: () => 10_000
    });

    const result = await orchestrator.handleInvocation({ trigger: "sleep_event" });

    expect(result.didScheduleAlarm).toBe(true);
    expect(result.didPersist).toBe(true);
    expect(result.state).toEqual({
      status: "sleep_detected_alarm_scheduled",
      targetDurationMin: 10,
      sleepStartMs: 2_000,
      wakeTimeMs: 602_000,
      alarmId: 77
    });
    expect(alarmAdapter.scheduleCalls).toEqual([602_000]);
    expect(sessionStore.snapshot?.state.status).toBe("sleep_detected_alarm_scheduled");
  });

  it("armed + sleep found + past wake time marks missed_target", async () => {
    const sessionStore = new MockSessionStore({
      version: SESSION_SCHEMA_VERSION,
      savedAtMs: 1,
      state: {
        status: "armed_waiting_for_sleep",
        targetDurationMin: 1,
        armedAtMs: 1_000
      }
    });
    const sleepAdapter = new MockSleepAdapter({ startTimeMs: 10_000, detectedAtMs: 71_000 });
    const alarmAdapter = new MockAlarmAdapter({
      ok: true,
      alarmId: 90,
      scheduledUtcSeconds: 0
    });

    const orchestrator = createOrchestrator({
      sessionStore,
      sleepAdapter,
      alarmAdapter,
      logger: new MockLogger(),
      now: () => 20_000
    });

    const result = await orchestrator.handleInvocation({ trigger: "sleep_event" });

    expect(result.state).toEqual({
      status: "missed_target",
      targetDurationMin: 1,
      sleepStartMs: 10_000,
      wakeTimeMs: 70_000,
      detectedAtMs: 71_000
    });
    expect(result.didPersist).toBe(true);
    expect(result.didScheduleAlarm).toBe(false);
    expect(alarmAdapter.scheduleCalls).toEqual([]);
  });

  it("armed + no sleep start remains waiting", async () => {
    const sessionStore = new MockSessionStore({
      version: SESSION_SCHEMA_VERSION,
      savedAtMs: 1,
      state: {
        status: "armed_waiting_for_sleep",
        targetDurationMin: 420,
        armedAtMs: 2_000
      }
    });
    const sleepAdapter = new MockSleepAdapter(null);
    const alarmAdapter = new MockAlarmAdapter({
      ok: true,
      alarmId: 22,
      scheduledUtcSeconds: 0
    });

    const orchestrator = createOrchestrator({
      sessionStore,
      sleepAdapter,
      alarmAdapter,
      logger: new MockLogger(),
      now: () => 3_000
    });

    const result = await orchestrator.handleInvocation({ trigger: "unknown" });

    expect(result.state).toEqual(sessionStore.snapshot?.state);
    expect(result.didPersist).toBe(false);
    expect(result.didScheduleAlarm).toBe(false);
    expect(alarmAdapter.scheduleCalls).toEqual([]);
  });

  it("already scheduled state prevents duplicate scheduling", async () => {
    const sessionStore = new MockSessionStore({
      version: SESSION_SCHEMA_VERSION,
      savedAtMs: 1,
      state: {
        status: "sleep_detected_alarm_scheduled",
        targetDurationMin: 480,
        sleepStartMs: 1_000,
        wakeTimeMs: 2_000,
        alarmId: 123
      }
    });
    const sleepAdapter = new MockSleepAdapter({ startTimeMs: 100, detectedAtMs: 200 });
    const alarmAdapter = new MockAlarmAdapter({
      ok: true,
      alarmId: 88,
      scheduledUtcSeconds: 0
    });

    const orchestrator = createOrchestrator({
      sessionStore,
      sleepAdapter,
      alarmAdapter,
      logger: new MockLogger(),
      now: () => 4_000
    });

    const result = await orchestrator.handleInvocation({ trigger: "sleep_event" });

    expect(result.state.status).toBe("sleep_detected_alarm_scheduled");
    expect(result.didPersist).toBe(false);
    expect(result.didScheduleAlarm).toBe(false);
    expect(sleepAdapter.readCalls).toBe(0);
    expect(alarmAdapter.scheduleCalls).toEqual([]);
  });

  it("alarm_fire trigger moves scheduled state to alarm_fired", async () => {
    const sessionStore = new MockSessionStore({
      version: SESSION_SCHEMA_VERSION,
      savedAtMs: 1,
      state: {
        status: "sleep_detected_alarm_scheduled",
        targetDurationMin: 360,
        sleepStartMs: 100,
        wakeTimeMs: 200,
        alarmId: 999
      }
    });
    const sleepAdapter = new MockSleepAdapter(null);
    const alarmAdapter = new MockAlarmAdapter({
      ok: true,
      alarmId: 1,
      scheduledUtcSeconds: 0
    });

    const orchestrator = createOrchestrator({
      sessionStore,
      sleepAdapter,
      alarmAdapter,
      logger: new MockLogger(),
      now: () => 5_000
    });

    const result = await orchestrator.handleInvocation({ trigger: "alarm_fire" as InvocationTrigger });

    expect(result.state).toEqual({ status: "alarm_fired", wakeTimeMs: 200 });
    expect(result.didPersist).toBe(true);
    expect(sessionStore.clearCalls).toBe(1);
  });
});
