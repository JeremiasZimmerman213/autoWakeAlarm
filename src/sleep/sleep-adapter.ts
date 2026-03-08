import type { EpochMs } from "../core/types.js";

export interface SleepStartInfo {
  readonly startTimeMs: EpochMs;
  readonly detectedAtMs: EpochMs;
}

export interface SleepAdapter {
  subscribe(onSignal: () => void): () => void;
  getSleepStart(): Promise<SleepStartInfo | null>;
}
