export class NoopLogger {
    debug() { }
    info() { }
    warn() { }
    error() { }
}
export class MemoryLogger {
    records = [];
    debug(message, context) {
        this.push("debug", message, context);
    }
    info(message, context) {
        this.push("info", message, context);
    }
    warn(message, context) {
        this.push("warn", message, context);
    }
    error(message, context) {
        this.push("error", message, context);
    }
    snapshot() {
        return [...this.records];
    }
    clear() {
        this.records.length = 0;
    }
    push(level, message, context) {
        const timestampMs = Date.now();
        const baseRecord = { level, message, timestampMs };
        this.records.push(context === undefined ? baseRecord : { ...baseRecord, context });
    }
}
export class ConsoleLogger {
    debug(message, context) {
        this.log("debug", message, context);
    }
    info(message, context) {
        this.log("info", message, context);
    }
    warn(message, context) {
        this.log("warn", message, context);
    }
    error(message, context) {
        this.log("error", message, context);
    }
    log(level, message, context) {
        const prefix = `[sleep-alarm][${level}]`;
        if (context === undefined) {
            console.log(prefix, message);
            return;
        }
        console.log(prefix, message, context);
    }
}
export function createLogger(enabled) {
    return enabled ? new ConsoleLogger() : new NoopLogger();
}
