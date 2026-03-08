import { describe, expect, it } from "vitest";
import { classifyServiceTrigger } from "../src/service/trigger-classifier.js";

describe("service trigger classifier", () => {
  it("classifies known sleep event markers", () => {
    expect(classifyServiceTrigger({ params: "event:os.health.sleep_status" }).trigger).toBe("sleep_event");
  });

  it("classifies known alarm markers", () => {
    expect(classifyServiceTrigger({ params: "alarm_fire" }).trigger).toBe("alarm_fire");
  });

  it("falls back to unknown when markers are absent", () => {
    expect(classifyServiceTrigger({ params: "hello" }).trigger).toBe("unknown");
    expect(classifyServiceTrigger(undefined).trigger).toBe("unknown");
  });
});
