import type { EpochMs } from "../core/types.js";
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

export function createZeppSleepAdapter(): SleepAdapter {
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
      sleepSensor.updateInfo();

      const sleepInfo = sleepSensor.getInfo();
      return normalizeZeppSleepStart(sleepInfo, referenceNowMs);
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
