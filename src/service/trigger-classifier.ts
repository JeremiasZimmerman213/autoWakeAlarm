import type { InvocationTrigger } from "../core/orchestrator.js";

export interface TriggerClassification {
  readonly trigger: InvocationTrigger;
  readonly rawParamsText: string;
}

export function classifyServiceTrigger(rawOptions: unknown): TriggerClassification {
  const rawParamsText = toRawParamsText(rawOptions);
  const text = rawParamsText.toLowerCase();

  if (hasSleepEventMarker(text)) {
    return {
      trigger: "sleep_event",
      rawParamsText
    };
  }

  if (hasAlarmMarker(text)) {
    return {
      trigger: "alarm_fire",
      rawParamsText
    };
  }

  return {
    trigger: "unknown",
    rawParamsText
  };
}

export function toRawParamsText(rawOptions: unknown): string {
  if (typeof rawOptions === "string") {
    return rawOptions;
  }

  if (isObject(rawOptions) && typeof rawOptions.params === "string") {
    return rawOptions.params;
  }

  return safeJson(rawOptions);
}

function hasSleepEventMarker(text: string): boolean {
  return text.includes("sleep_status") || text.includes("health.sleep") || text.includes("sleep_event");
}

function hasAlarmMarker(text: string): boolean {
  // TODO(zepp-validation): Confirm stable alarm-fire params shape; keep classification conservative.
  return text.includes("alarm_fire") || text.includes("alarm");
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
