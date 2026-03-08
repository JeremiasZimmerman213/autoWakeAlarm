export function classifyServiceTrigger(rawOptions) {
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
export function toRawParamsText(rawOptions) {
    if (typeof rawOptions === "string") {
        return rawOptions;
    }
    if (isObject(rawOptions) && typeof rawOptions.params === "string") {
        return rawOptions.params;
    }
    return safeJson(rawOptions);
}
function hasSleepEventMarker(text) {
    return text.includes("sleep_status") || text.includes("health.sleep") || text.includes("sleep_event");
}
function hasAlarmMarker(text) {
    // TODO(zepp-validation): Confirm stable alarm-fire params shape; keep classification conservative.
    return text.includes("alarm_fire") || text.includes("alarm");
}
function safeJson(value) {
    try {
        return JSON.stringify(value) ?? "";
    }
    catch {
        return "";
    }
}
function isObject(value) {
    return typeof value === "object" && value !== null;
}
