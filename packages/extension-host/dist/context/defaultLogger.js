export class ConsoleExtensionLogger {
    constructor(namespace) {
        this.namespace = namespace;
    }
    format(message, meta) {
        return meta ? `${message} ${JSON.stringify(meta)}` : message;
    }
    debug(message, meta) {
        console.debug(`[${this.namespace}] ${this.format(message, meta)}`);
    }
    info(message, meta) {
        console.info(`[${this.namespace}] ${this.format(message, meta)}`);
    }
    warn(message, meta) {
        console.warn(`[${this.namespace}] ${this.format(message, meta)}`);
    }
    error(message, meta) {
        console.error(`[${this.namespace}] ${this.format(message, meta)}`);
    }
}
