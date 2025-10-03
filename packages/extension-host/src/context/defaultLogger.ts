import type { ExtensionLogger } from "@jamra/extension-sdk";

export class ConsoleExtensionLogger implements ExtensionLogger {
  constructor(private readonly namespace: string) {}

  private format(message: string, meta?: Record<string, unknown>) {
    return meta ? `${message} ${JSON.stringify(meta)}` : message;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    console.debug(`[${this.namespace}] ${this.format(message, meta)}`);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    console.info(`[${this.namespace}] ${this.format(message, meta)}`);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(`[${this.namespace}] ${this.format(message, meta)}`);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    console.error(`[${this.namespace}] ${this.format(message, meta)}`);
  }
}
