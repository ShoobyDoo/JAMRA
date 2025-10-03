export class ExtensionLoadError extends Error {
    constructor(message, cause) {
        super(message);
        this.cause = cause;
        this.name = "ExtensionLoadError";
    }
}
export class ManifestValidationError extends Error {
    constructor(message, issues) {
        super(message);
        this.issues = issues;
        this.name = "ManifestValidationError";
    }
}
