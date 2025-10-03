export declare class ExtensionLoadError extends Error {
    readonly cause?: unknown | undefined;
    constructor(message: string, cause?: unknown | undefined);
}
export declare class ManifestValidationError extends Error {
    readonly issues: string[];
    constructor(message: string, issues: string[]);
}
//# sourceMappingURL=errors.d.ts.map