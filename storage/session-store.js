import { SESSION_SCHEMA_VERSION } from "../core/types.js";
const SESSION_STORAGE_KEY = "sleep_alarm_session_v1";
export function createZeppSessionStore(options = {}) {
    const storageKey = options.storageKey ?? SESSION_STORAGE_KEY;
    let storagePromise = null;
    async function getStorage() {
        if (storagePromise === null) {
            storagePromise = import("@zos/storage").then((module) => module.localStorage);
        }
        return storagePromise;
    }
    return {
        async saveSession(snapshot) {
            const storage = await getStorage();
            storage.setItem(storageKey, serializeSession(snapshot));
        },
        async loadSession() {
            const storage = await getStorage();
            const raw = storage.getItem(storageKey, "");
            return deserializeSession(raw);
        },
        async clearSession() {
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
export class InMemorySessionStore {
    serialized = null;
    async saveSession(snapshot) {
        this.serialized = serializeSession(snapshot);
    }
    async loadSession() {
        return deserializeSession(this.serialized);
    }
    async clearSession() {
        this.serialized = null;
    }
}
export function serializeSession(snapshot) {
    return JSON.stringify(snapshot);
}
export function deserializeSession(raw) {
    if (raw === null || raw === undefined || raw.trim() === "") {
        return null;
    }
    try {
        const parsed = JSON.parse(raw);
        return isSessionSnapshot(parsed) ? parsed : null;
    }
    catch {
        return null;
    }
}
function isSessionSnapshot(value) {
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
function isObject(value) {
    return typeof value === "object" && value !== null;
}
function isEpochMs(value) {
    return typeof value === "number" && Number.isInteger(value) && Number.isFinite(value);
}
function isDurationMin(value) {
    return typeof value === "number" && Number.isInteger(value) && value > 0;
}
function isPersistableStateSnapshot(value) {
    if (value.status === "armed_waiting_for_sleep") {
        return isDurationMin(value.targetDurationMin) && isEpochMs(value.armedAtMs);
    }
    if (value.status === "sleep_detected_alarm_scheduled") {
        return (isDurationMin(value.targetDurationMin) &&
            isEpochMs(value.sleepStartMs) &&
            isEpochMs(value.wakeTimeMs) &&
            (typeof value.alarmId === "number" || typeof value.alarmId === "string"));
    }
    if (value.status === "missed_target") {
        return (isDurationMin(value.targetDurationMin) &&
            isEpochMs(value.sleepStartMs) &&
            isEpochMs(value.wakeTimeMs) &&
            isEpochMs(value.detectedAtMs));
    }
    return false;
}
