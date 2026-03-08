import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ALARM_DESTINATION_PATH } from "../src/alarm/alarm-adapter.js";
import { APP_SERVICE_ENTRY_PATH, MAIN_PAGE_ENTRY_PATH } from "../src/config/runtime-paths.js";

interface AppConfig {
  module?: {
    page?: { pages?: string[] };
    "app-service"?: { services?: string[] };
    "app-event"?: { path?: string };
  };
}

describe("runtime config consistency", () => {
  it("keeps app.json entry paths aligned with runtime constants", () => {
    const appJsonPath = resolve(process.cwd(), "app.json");
    const appJson = readFileSync(appJsonPath, "utf8");
    const config = JSON.parse(appJson) as AppConfig;

    expect(config.module?.page?.pages).toContain(MAIN_PAGE_ENTRY_PATH);
    expect(config.module?.["app-service"]?.services?.[0]).toBe(APP_SERVICE_ENTRY_PATH);
    expect(config.module?.["app-event"]?.path).toBe(APP_SERVICE_ENTRY_PATH);
    expect(ALARM_DESTINATION_PATH).toBe(APP_SERVICE_ENTRY_PATH);
  });
});
