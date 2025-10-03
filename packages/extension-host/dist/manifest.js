import { ManifestValidationError } from "./errors.js";
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+].+)?$/;
const ID_PATTERN = /^[a-z0-9]+([-.][a-z0-9]+)*$/i;
export function validateManifest(manifest) {
    const issues = [];
    if (!manifest.id || typeof manifest.id !== "string") {
        issues.push("`id` is required.");
    }
    else if (!ID_PATTERN.test(manifest.id)) {
        issues.push("`id` must use alphanumeric segments separated by '.' or '-'.");
    }
    if (!manifest.name || typeof manifest.name !== "string") {
        issues.push("`name` is required.");
    }
    if (!manifest.version || typeof manifest.version !== "string") {
        issues.push("`version` is required.");
    }
    else if (!VERSION_PATTERN.test(manifest.version)) {
        issues.push("`version` must follow semver (e.g. 1.2.3). Use prerelease/build metadata if needed.");
    }
    if (!manifest.author || typeof manifest.author.name !== "string") {
        issues.push("`author.name` is required.");
    }
    if (manifest.icon !== undefined) {
        if (typeof manifest.icon !== "string") {
            issues.push("`icon` must be a string when provided.");
        }
        else if (manifest.icon.trim().length === 0) {
            issues.push("`icon` cannot be empty when provided.");
        }
    }
    if (!Array.isArray(manifest.languageCodes) ||
        manifest.languageCodes.length === 0) {
        issues.push("`languageCodes` must contain at least one language code.");
    }
    if (!manifest.capabilities || manifest.capabilities.catalogue !== true) {
        issues.push("`capabilities.catalogue` must be true (all extensions must support catalogue).");
    }
    if (issues.length > 0) {
        throw new ManifestValidationError(`Invalid manifest for extension ${manifest.id ?? "<unknown>"}`, issues);
    }
}
