import type { ExtensionLogger } from "@jamra/extension-sdk";
export declare class ConsoleExtensionLogger implements ExtensionLogger {
    private readonly namespace;
    constructor(namespace: string);
    private format;
    debug(message: string, meta?: Record<string, unknown>): void;
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
}
//# sourceMappingURL=defaultLogger.d.ts.map