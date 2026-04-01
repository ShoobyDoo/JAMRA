import { ValidationError } from "../../shared/errors.js";
import type { ExtensionManifest } from "@jamra/extension-sdk";
import type { PackageValidator } from "./installer.types.js";

export class ExtensionPackageValidator implements PackageValidator {
  async validate(
    files: string[],
    manifest: ExtensionManifest,
  ): Promise<void> {
    // 1. Validate manifest has required fields
    if (!manifest.id || typeof manifest.id !== "string") {
      throw new ValidationError("Extension manifest missing required field: id");
    }

    if (!manifest.name || typeof manifest.name !== "string") {
      throw new ValidationError(
        "Extension manifest missing required field: name",
      );
    }

    if (!manifest.version || typeof manifest.version !== "string") {
      throw new ValidationError(
        "Extension manifest missing required field: version",
      );
    }

    // 2. Validate entrypoint exists in files
    const entrypoint = manifest.entry || "index.js";
    const hasEntrypoint = files.some((file) => file.endsWith(entrypoint));

    if (!hasEntrypoint) {
      throw new ValidationError(
        `Extension entrypoint not found: ${entrypoint}`,
      );
    }

    // 3. Validate at least one file exists
    if (files.length === 0) {
      throw new ValidationError("Extension package contains no files");
    }
  }
}

export const createPackageValidator = (): PackageValidator => {
  return new ExtensionPackageValidator();
};
