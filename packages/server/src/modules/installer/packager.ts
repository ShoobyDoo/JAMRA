import fs from "node:fs";
import path from "node:path";
import type { Database } from "better-sqlite3";
import { DomainError } from "../../shared/errors.js";
import type { ExtensionPackager } from "./installer.types.js";
import type { ExtensionMetadata } from "./types/repository-schema.types.js";
import type { ExtensionManifest } from "@jamra/extension-sdk";

/**
 * Extension packager for installing compiled extensions
 */
export class FileExtensionPackager implements ExtensionPackager {
  constructor(
    private readonly db: Database,
    private readonly extensionsDir: string,
  ) {}

  async unpack(_archivePath: string, _targetDir: string): Promise<string[]> {
    throw new DomainError("Archive unpacking not implemented. Use installExtension instead.");
  }

  /**
   * Install extension from compiled source code
   * @param compiledCode - Compiled JavaScript code
   * @param metadata - Extension metadata
   * @returns Installation path
   */
  async installExtension(
    compiledCode: string,
    metadata: ExtensionMetadata,
  ): Promise<string> {
    const { id } = metadata;

    // 1. Create directory structure: extensions/{extensionId}/
    const installPath = path.join(this.extensionsDir, id);

    if (!fs.existsSync(installPath)) {
      fs.mkdirSync(installPath, { recursive: true });
    }

    // 2. Write compiled JavaScript file
    const entrypointName = this.getCompiledEntrypointName(metadata.entrypoint);
    const entrypointPath = path.join(installPath, entrypointName);

    // Create subdirectories if needed
    const entrypointDir = path.dirname(entrypointPath);
    if (!fs.existsSync(entrypointDir)) {
      fs.mkdirSync(entrypointDir, { recursive: true });
    }

    fs.writeFileSync(entrypointPath, compiledCode, "utf-8");

    // 3. Write manifest.json
    const manifest: ExtensionManifest = this.createManifest(metadata, entrypointName);
    const manifestPath = path.join(installPath, "manifest.json");
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(manifest, null, 2),
      "utf-8",
    );

    // 4. Write package.json if dependencies exist
    if (metadata.dependencies && Object.keys(metadata.dependencies).length > 0) {
      const packageJson = {
        name: metadata.id,
        version: metadata.version,
        dependencies: metadata.dependencies,
      };
      const packagePath = path.join(installPath, "package.json");
      fs.writeFileSync(
        packagePath,
        JSON.stringify(packageJson, null, 2),
        "utf-8",
      );
    }

    // 5. Register in database
    this.registerExtension(metadata, installPath, manifest);

    return installPath;
  }

  /**
   * Create extension manifest from metadata
   */
  private createManifest(
    metadata: ExtensionMetadata,
    compiledEntrypoint: string,
  ): ExtensionManifest {
    return {
      id: metadata.id,
      name: metadata.name,
      version: metadata.version,
      entry: compiledEntrypoint,
      language: "en", // Default to English
      author: metadata.author,
      description: metadata.description,
    };
  }

  /**
   * Get compiled entrypoint filename (.ts → .js)
   */
  private getCompiledEntrypointName(entrypoint: string): string {
    // Replace .ts, .tsx with .js
    return entrypoint
      .replace(/\.tsx?$/, ".js")
      .replace(/\.jsx?$/, ".js");
  }

  /**
   * Register extension in database
   */
  private registerExtension(
    metadata: ExtensionMetadata,
    installPath: string,
    manifest: ExtensionManifest,
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO extensions
      (id, slug, name, version, repo_source, install_path, manifest_json, enabled, installed_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        version = excluded.version,
        install_path = excluded.install_path,
        manifest_json = excluded.manifest_json,
        updated_at = excluded.updated_at
    `);

    const now = Date.now();
    stmt.run(
      metadata.id,
      metadata.id, // Use id as slug
      metadata.name,
      metadata.version,
      metadata.sourceUrl,
      installPath,
      JSON.stringify(manifest),
      1, // enabled
      now,
      now,
    );
  }
}

export const createExtensionPackager = (
  db: Database,
  extensionsDir: string,
): FileExtensionPackager => {
  return new FileExtensionPackager(db, extensionsDir);
};
