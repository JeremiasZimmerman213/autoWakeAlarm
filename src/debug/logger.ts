export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogRecord {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestampMs: number;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface Logger {
  debug(message: string, context?: Readonly<Record<string, unknown>>): void;
  info(message: string, context?: Readonly<Record<string, unknown>>): void;
  warn(message: string, context?: Readonly<Record<string, unknown>>): void;
  error(message: string, context?: Readonly<Record<string, unknown>>): void;
}

export class NoopLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

export class MemoryLogger implements Logger {
  private readonly records: LogRecord[] = [];

  debug(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.push("debug", message, context);
  }

  info(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.push("info", message, context);
  }

  warn(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.push("warn", message, context);
  }

  error(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.push("error", message, context);
  }

  snapshot(): ReadonlyArray<LogRecord> {
    return [...this.records];
  }

  clear(): void {
    this.records.length = 0;
  }

  private push(
    level: LogLevel,
    message: string,
    context?: Readonly<Record<string, unknown>>
  ): void {
    const timestampMs = Date.now();
    const baseRecord = { level, message, timestampMs };
    this.records.push(context === undefined ? baseRecord : { ...baseRecord, context });
  }
}

export function createLogger(enabled: boolean): Logger {
  return enabled ? new MemoryLogger() : new NoopLogger();
}
