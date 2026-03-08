import type { EpochMs } from "../core/types.js";
import type { Logger } from "../debug/logger.js";
import { NoopLogger } from "../debug/logger.js";
import {
  normalizeZeppSleepStart,
  type SleepStartInfo,
  type ZeppSleepInfo
} from "./sleep-parser.js";

interface SleepSensor {
  updateInfo(): void;
  getInfo(): ZeppSleepInfo | null;
}

type SleepCtor = new () => SleepSensor;

export interface SleepAdapter {
  refreshAndReadSleepStart(referenceNowMs?: EpochMs): Promise<SleepStartInfo | null>;
  subscribeToSleepSignal(onSignal: (rawParams?: string) => void): () => void;
}

export interface SleepAdapterOptions {
  readonly logger?: Logger;
}

export function createZeppSleepAdapter(options: SleepAdapterOptions = {}): SleepAdapter {
  const logger = options.logger ?? new NoopLogger();
  let sleepSensorPromise: Promise<SleepSensor> | null = null;

  async function getSleepSensor(): Promise<SleepSensor> {
    if (sleepSensorPromise === null) {
      sleepSensorPromise = loadSleepCtor().then((Ctor) => new Ctor());
    }

    return sleepSensorPromise;
  }

  return {
    async refreshAndReadSleepStart(referenceNowMs: EpochMs = Date.now()): Promise<SleepStartInfo | null> {
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

    subscribeToSleepSignal(onSignal: (rawParams?: string) => void): () => void {
      void onSignal;

      // TODO(zepp-validation): Wire real sleep system-event subscription in Phase 3 once
      // the exact service invocation payload contract is validated on device.
      return () => {};
    }
  };
}

async function loadSleepCtor(): Promise<SleepCtor> {
  const module = await import("@zos/sensor");
  return module.Sleep as SleepCtor;
}
