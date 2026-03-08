import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ALARM_DESTINATION_PATH } from "../src/alarm/alarm-adapter.js";
import { APP_SERVICE_ENTRY_PATH, MAIN_PAGE_ENTRY_PATH } from "../src/config/runtime-paths.js";

interface AppConfig {
  configVersion?: string;
  app?: Record<string, unknown>;
  runtime?: {
    apiVersion?: {
      compatible?: string;
      target?: string;
      minVersion?: string;
    };
  };
  permissions?: string[];
  targets?: Record<
    string,
    {
      module?: {
        page?: { pages?: string[] };
        "app-service"?: { services?: string[] };
        "app-event"?: { path?: string };
      };
      platforms?: Array<{ deviceSource?: number; st?: string; name?: string }>;
    }
  >;
  i18n?: Record<string, unknown>;
  defaultLanguage?: string;
}

describe("runtime config consistency", () => {
  it("keeps app.json entry paths aligned with runtime constants", () => {
    const appJsonPath = resolve(process.cwd(), "app.json");
    const appJson = readFileSync(appJsonPath, "utf8");
    const config = JSON.parse(appJson) as AppConfig;
    const target = config.targets?.["active-2-square"];

    expect(config.configVersion).toBe("v3");
    expect(config.app).toBeDefined();
    expect(config.runtime?.apiVersion?.minVersion).toBeDefined();
    expect(config.permissions?.length).toBeGreaterThan(0);
    expect(config.i18n).toBeDefined();
    expect(config.defaultLanguage).toBe("en-US");

    expect(target?.module?.page?.pages).toContain(MAIN_PAGE_ENTRY_PATH);
    expect(target?.module?.["app-service"]?.services?.[0]).toBe(APP_SERVICE_ENTRY_PATH);
    expect(target?.module?.["app-event"]?.path).toBe(APP_SERVICE_ENTRY_PATH);

    const sources = (target?.platforms ?? [])
      .map((platform) => platform.deviceSource)
      .filter((value): value is number => typeof value === "number")
      .sort((a, b) => a - b);
    expect(sources).toEqual([10223872, 10223873, 10223875]);

    expect(ALARM_DESTINATION_PATH).toBe(APP_SERVICE_ENTRY_PATH);
  });
});
