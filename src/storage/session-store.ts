import { SESSION_SCHEMA_VERSION, type SessionSnapshot } from "../core/types.js";

const SESSION_STORAGE_KEY = "sleep_alarm_session_v1";

interface StorageLike {
  setItem(key: string, value: string): void;
  getItem(key: string, defaultValue: string): string;
  removeItem?(key: string): void;
}

export interface SessionStore {
  saveSession(snapshot: SessionSnapshot): Promise<void>;
  loadSession(): Promise<SessionSnapshot | null>;
  clearSession(): Promise<void>;
}

export interface SessionStoreOptions {
  readonly storageKey?: string;
}

export function createZeppSessionStore(options: SessionStoreOptions = {}): SessionStore {
  const storageKey = options.storageKey ?? SESSION_STORAGE_KEY;
  let storagePromise: Promise<StorageLike> | null = null;

  async function getStorage(): Promise<StorageLike> {
    if (storagePromise === null) {
      storagePromise = import("@zos/storage").then((module) => module.localStorage as StorageLike);
    }

    return storagePromise;
  }

  return {
    async saveSession(snapshot: SessionSnapshot): Promise<void> {
      const storage = await getStorage();
      storage.setItem(storageKey, serializeSession(snapshot));
    },

    async loadSession(): Promise<SessionSnapshot | null> {
      const storage = await getStorage();
      const raw = storage.getItem(storageKey, "");
      return deserializeSession(raw);
    },

    async clearSession(): Promise<void> {
      const storage = await getStorage();
      // TODO(zepp-validation): Verify `removeItem` support on target runtime; fallback keeps compatibility.
      if (typeof storage.removeItem === "function") {
        storage.removeItem(storageKey);
        return;
      }

      storage.setItem(storageKey, "");
    }
  };
}

export class InMemorySessionStore implements SessionStore {
  private serialized: string | null = null;

  async saveSession(snapshot: SessionSnapshot): Promise<void> {
    this.serialized = serializeSession(snapshot);
  }

  async loadSession(): Promise<SessionSnapshot | null> {
    return deserializeSession(this.serialized);
  }

  async clearSession(): Promise<void> {
    this.serialized = null;
  }
}

export function serializeSession(snapshot: SessionSnapshot): string {
  return JSON.stringify(snapshot);
}

export function deserializeSession(raw: string | null | undefined): SessionSnapshot | null {
  if (raw === null || raw === undefined || raw.trim() === "") {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return isSessionSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isSessionSnapshot(value: unknown): value is SessionSnapshot {
  if (!isObject(value)) {
    return false;
  }

  if (value.version !== SESSION_SCHEMA_VERSION) {
    return false;
  }

  if (!isEpochMs(value.savedAtMs)) {
    return false;
  }

  if (!isObject(value.state)) {
    return false;
  }

  return isPersistableStateSnapshot(value.state);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isEpochMs(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && Number.isFinite(value);
}

function isDurationMin(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isPersistableStateSnapshot(value: Record<string, unknown>): value is SessionSnapshot["state"] {
  if (value.status === "armed_waiting_for_sleep") {
    return isDurationMin(value.targetDurationMin) && isEpochMs(value.armedAtMs);
  }

  if (value.status === "sleep_detected_alarm_scheduled") {
    return (
      isDurationMin(value.targetDurationMin) &&
      isEpochMs(value.sleepStartMs) &&
      isEpochMs(value.wakeTimeMs) &&
      (typeof value.alarmId === "number" || typeof value.alarmId === "string")
    );
  }

  if (value.status === "missed_target") {
    return (
      isDurationMin(value.targetDurationMin) &&
      isEpochMs(value.sleepStartMs) &&
      isEpochMs(value.wakeTimeMs) &&
      isEpochMs(value.detectedAtMs)
    );
  }

  return false;
}
