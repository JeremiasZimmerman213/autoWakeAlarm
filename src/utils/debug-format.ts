export function formatEpochForLog(epochMs: number): string {
  const date = new Date(epochMs);
  return `${date.toISOString()} (${epochMs})`;
}

export function formatEpochForDisplay(epochMs: number): string {
  const date = new Date(epochMs);
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
