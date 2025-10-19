import type Database from "better-sqlite3";
import type { ExtensionManifest } from "@jamra/extension-sdk";
import type {
  StoredExtension,
  ExtensionListOptions,
  StoredExtensionSourceMetadata,
  StoredExtensionUpdateState,
} from "../catalogRepository.js";

export class ExtensionRepository {
  constructor(private readonly db: Database.Database) {}

  upsertExtension(
    manifest: ExtensionManifest,
    options?: {
      entryPath?: string;
      enabled?: boolean;
      settings?: Record<string, unknown> | null;
      sourceMetadata?: StoredExtensionSourceMetadata;
      updateState?: StoredExtensionUpdateState;
    },
  ): void {
    const entryPath = options?.entryPath ?? null;
    const enabled = options?.enabled ?? true;
    const settingsJson =
      options?.settings !== undefined ? JSON.stringify(options.settings) : null;
    const sourceMetadataJson = options?.sourceMetadata
      ? JSON.stringify(options.sourceMetadata)
      : null;
    const updateStateJson = options?.updateState
      ? JSON.stringify(options.updateState)
      : null;

    this.db
      .prepare(
        `
        INSERT INTO extensions (
          id,
          name,
          version,
          description,
          homepage,
          icon,
          author_name,
          author_url,
          author_contact,
          language_codes,
          capabilities_json,
          manifest_json,
          entry_path,
          is_enabled,
          settings_json,
          source_metadata_json,
          update_state_json
        )
        VALUES (
          @id,
          @name,
          @version,
          @description,
          @homepage,
          @icon,
          @author_name,
          @author_url,
          @author_contact,
          @language_codes,
          @capabilities_json,
          @manifest_json,
          @entry_path,
          @is_enabled,
          @settings_json,
          @source_metadata_json,
          @update_state_json
        )
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          version = excluded.version,
          description = excluded.description,
          homepage = excluded.homepage,
          icon = excluded.icon,
          author_name = excluded.author_name,
          author_url = excluded.author_url,
          author_contact = excluded.author_contact,
          language_codes = excluded.language_codes,
          capabilities_json = excluded.capabilities_json,
          manifest_json = excluded.manifest_json,
          entry_path = COALESCE(excluded.entry_path, entry_path),
          is_enabled = COALESCE(excluded.is_enabled, is_enabled),
          settings_json = COALESCE(excluded.settings_json, settings_json),
          source_metadata_json = COALESCE(excluded.source_metadata_json, source_metadata_json),
          update_state_json = COALESCE(excluded.update_state_json, update_state_json)
      `,
      )
      .run({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description ?? null,
        homepage: manifest.homepage ?? null,
        icon: manifest.icon ?? null,
        author_name: manifest.author.name,
        author_url: manifest.author.url ?? null,
        author_contact: manifest.author.contact ?? null,
        language_codes: JSON.stringify(manifest.languageCodes ?? []),
        capabilities_json: JSON.stringify(manifest.capabilities ?? {}),
        manifest_json: JSON.stringify(manifest),
        entry_path: entryPath,
        is_enabled: enabled ? 1 : 0,
        settings_json: settingsJson,
        source_metadata_json: sourceMetadataJson,
        update_state_json: updateStateJson,
      });
  }

  listExtensions(options: ExtensionListOptions = {}): StoredExtension[] {
    let sql = "SELECT * FROM extensions WHERE 1=1";
    const params: Record<string, string | number> = {};

    if (options.search) {
      sql +=
        " AND (name LIKE @search OR author_name LIKE @search OR id LIKE @search)";
      params.search = `%${options.search}%`;
    }

    if (options.status === "enabled") {
      sql += " AND is_enabled = 1";
    } else if (options.status === "disabled") {
      sql += " AND is_enabled = 0";
    }

    if (options.sort === "name") {
      sql += " ORDER BY name";
    } else if (options.sort === "author") {
      sql += " ORDER BY author_name";
    } else if (options.sort === "language") {
      sql += " ORDER BY language_codes";
    } else {
      sql += " ORDER BY installed_at";
    }

    if (options.order === "desc") {
      sql += " DESC";
    } else {
      sql += " ASC";
    }

    const rows = this.db.prepare(sql).all(params) as Array<{
      id: string;
      name: string;
      version: string;
      description: string | null;
      homepage: string | null;
      icon: string | null;
      author_name: string;
      author_url: string | null;
      author_contact: string | null;
      language_codes: string;
      capabilities_json: string;
      manifest_json: string;
      entry_path: string | null;
      is_enabled: number;
      settings_json: string | null;
      source_metadata_json: string | null;
      update_state_json: string | null;
      installed_at: number;
    }>;

    return rows.map((row) => this.rowToStoredExtension(row));
  }

  getExtension(id: string): StoredExtension | undefined {
    const row = this.db
      .prepare("SELECT * FROM extensions WHERE id = ?")
      .get(id) as
      | {
          id: string;
          name: string;
          version: string;
          description: string | null;
          homepage: string | null;
          icon: string | null;
          author_name: string;
          author_url: string | null;
          author_contact: string | null;
          language_codes: string;
          capabilities_json: string;
          manifest_json: string;
          entry_path: string | null;
          is_enabled: number;
          settings_json: string | null;
          source_metadata_json: string | null;
          update_state_json: string | null;
          installed_at: number;
        }
      | undefined;

    return row ? this.rowToStoredExtension(row) : undefined;
  }

  setExtensionEnabled(id: string, enabled: boolean): void {
    this.db
      .prepare("UPDATE extensions SET is_enabled = ? WHERE id = ?")
      .run(enabled ? 1 : 0, id);
  }

  removeExtension(id: string): void {
    this.db.prepare("DELETE FROM extensions WHERE id = ?").run(id);
  }

  updateExtensionSettings(
    id: string,
    settings: Record<string, unknown> | null,
  ): void {
    const settingsJson = settings !== null ? JSON.stringify(settings) : null;
    this.db
      .prepare("UPDATE extensions SET settings_json = ? WHERE id = ?")
      .run(settingsJson, id);
  }

  updateExtensionSourceMetadata(
    id: string,
    metadata: StoredExtensionSourceMetadata,
  ): void {
    this.db
      .prepare("UPDATE extensions SET source_metadata_json = ? WHERE id = ?")
      .run(JSON.stringify(metadata), id);
  }

  updateExtensionUpdateState(
    id: string,
    updateState: StoredExtensionUpdateState,
  ): void {
    this.db
      .prepare("UPDATE extensions SET update_state_json = ? WHERE id = ?")
      .run(JSON.stringify(updateState), id);
  }

  private rowToStoredExtension(row: {
    id: string;
    name: string;
    version: string;
    description: string | null;
    homepage: string | null;
    icon: string | null;
    author_name: string;
    author_url: string | null;
    author_contact: string | null;
    language_codes: string;
    capabilities_json: string;
    manifest_json: string;
    entry_path: string | null;
    is_enabled: number;
    settings_json: string | null;
    source_metadata_json: string | null;
    update_state_json: string | null;
    installed_at: number;
  }): StoredExtension {
    const manifest = JSON.parse(row.manifest_json) as ExtensionManifest;
    return {
      id: row.id,
      name: row.name,
      version: row.version,
      description: row.description ?? undefined,
      homepage: row.homepage ?? undefined,
      icon: row.icon ?? undefined,
      author: {
        name: row.author_name,
        url: row.author_url ?? undefined,
        contact: row.author_contact ?? undefined,
      },
      languageCodes: manifest.languageCodes,
      capabilities: manifest.capabilities,
      manifest,
      entryPath: row.entry_path ?? undefined,
      enabled: row.is_enabled === 1,
      settings: row.settings_json
        ? (JSON.parse(row.settings_json) as Record<string, unknown>)
        : undefined,
      source: row.source_metadata_json
        ? (JSON.parse(
            row.source_metadata_json,
          ) as StoredExtensionSourceMetadata)
        : undefined,
      updateState: row.update_state_json
        ? (JSON.parse(row.update_state_json) as StoredExtensionUpdateState)
        : undefined,
      installedAt: row.installed_at,
    };
  }
}
