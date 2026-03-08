export interface Orchestrator {
  initialize(): Promise<void>;
  arm(targetDurationMin: number): Promise<void>;
  cancel(): Promise<void>;
}

export function createOrchestrator(): Orchestrator {
  return {
    async initialize(): Promise<void> {
      throw new Error("Phase 3 implementation pending.");
    },
    async arm(): Promise<void> {
      throw new Error("Phase 3 implementation pending.");
    },
    async cancel(): Promise<void> {
      throw new Error("Phase 3 implementation pending.");
    }
  };
}
