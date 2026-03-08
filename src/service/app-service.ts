export interface AppService {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createAppService(): AppService {
  return {
    async start(): Promise<void> {
      throw new Error("Phase 2+ implementation pending.");
    },
    async stop(): Promise<void> {
      throw new Error("Phase 2+ implementation pending.");
    }
  };
}
