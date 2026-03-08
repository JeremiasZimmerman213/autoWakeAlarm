import { createZeppAlarmAdapter } from "../alarm/alarm-adapter.js";
import { createOrchestrator } from "../core/orchestrator.js";
import { ConsoleLogger, type Logger } from "../debug/logger.js";
import { createZeppSleepAdapter } from "../sleep/sleep-adapter.js";
import { createZeppSessionStore } from "../storage/session-store.js";
import { classifyServiceTrigger } from "./trigger-classifier.js";
import { safeStringify } from "../utils/debug-format.js";

const logger: Logger = new ConsoleLogger();

const orchestrator = createOrchestrator({
  sessionStore: createZeppSessionStore(),
  sleepAdapter: createZeppSleepAdapter({ logger }),
  alarmAdapter: createZeppAlarmAdapter({ logger }),
  logger
});

AppService({
  onInit(options?: unknown): void {
    // Required by Phase 3: always capture raw init payload first.
    logger.info("App service onInit raw options.", { options: safeStringify(options) });

    const classification = classifyServiceTrigger(options);
    logger.info("Trigger classification result.", {
      trigger: classification.trigger,
      rawParamsText: classification.rawParamsText
    });

    void orchestrator
      .handleInvocation({
        trigger: classification.trigger,
        rawOptions: options
      })
      .then((result) => {
        logger.info("Orchestration result.", {
          state: result.state.status,
          didPersist: result.didPersist,
          didScheduleAlarm: result.didScheduleAlarm
        });
      })
      .catch((error: unknown) => {
        logger.error("App service orchestration failed.", {
          error: toErrorMessage(error),
          trigger: classification.trigger,
          rawParamsText: classification.rawParamsText
        });
      });
  },

  onDestroy(): void {
    logger.info("App service onDestroy.");
  }
});

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
