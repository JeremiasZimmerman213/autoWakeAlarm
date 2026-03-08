import { createZeppAlarmAdapter } from "../alarm/alarm-adapter.js";
import { createOrchestrator } from "../core/orchestrator.js";
import { NoopLogger, type Logger } from "../debug/logger.js";
import { createZeppSleepAdapter } from "../sleep/sleep-adapter.js";
import { createZeppSessionStore } from "../storage/session-store.js";
import { classifyServiceTrigger } from "./trigger-classifier.js";

const logger: Logger = new NoopLogger();

const orchestrator = createOrchestrator({
  sessionStore: createZeppSessionStore(),
  sleepAdapter: createZeppSleepAdapter(),
  alarmAdapter: createZeppAlarmAdapter(),
  logger
});

AppService({
  onInit(options?: unknown): void {
    // Required by Phase 3: always capture raw init payload first.
    console.log("[sleep-alarm-service] onInit raw options:", options);

    const classification = classifyServiceTrigger(options);
    console.log("[sleep-alarm-service] classified trigger:", classification.trigger);

    void orchestrator
      .handleInvocation({
        trigger: classification.trigger,
        rawOptions: options
      })
      .then((result) => {
        console.log("[sleep-alarm-service] orchestration result:", result.state.status);
      })
      .catch((error: unknown) => {
        logger.error("App service orchestration failed.", {
          error: toErrorMessage(error),
          trigger: classification.trigger,
          rawParamsText: classification.rawParamsText
        });
        console.log("[sleep-alarm-service] orchestration error:", toErrorMessage(error));
      });
  },

  onDestroy(): void {
    console.log("[sleep-alarm-service] onDestroy");
  }
});

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
