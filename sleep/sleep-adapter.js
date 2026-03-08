import { NoopLogger } from "../debug/logger.js";
import { normalizeZeppSleepStart } from "./sleep-parser.js";
export function createZeppSleepAdapter(options = {}) {
    const logger = options.logger ?? new NoopLogger();
    let sleepSensorPromise = null;
    async function getSleepSensor() {
        if (sleepSensorPromise === null) {
            sleepSensorPromise = loadSleepCtor().then((Ctor) => new Ctor());
        }
        return sleepSensorPromise;
    }
    return {
        async refreshAndReadSleepStart(referenceNowMs = Date.now()) {
            const sleepSensor = await getSleepSensor();
            logger.info("Sleep info refresh attempt.", { referenceNowMs });
            sleepSensor.updateInfo();
            const sleepInfo = sleepSensor.getInfo();
            logger.info("Sleep info fetched.", {
                hasInfo: sleepInfo !== null,
                startTimeMinutesFromMidnight: sleepInfo?.startTime
            });
            const normalized = normalizeZeppSleepStart(sleepInfo, referenceNowMs);
            logger.info("Sleep start normalized.", {
                normalizedStartMs: normalized?.startTimeMs ?? null,
                detectedAtMs: normalized?.detectedAtMs ?? null
            });
            return normalized;
        },
        subscribeToSleepSignal(onSignal) {
            void onSignal;
            // TODO(zepp-validation): Wire real sleep system-event subscription in Phase 3 once
            // the exact service invocation payload contract is validated on device.
            return () => { };
        }
    };
}
async function loadSleepCtor() {
    const module = await import("@zos/sensor");
    return module.Sleep;
}
