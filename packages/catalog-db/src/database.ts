import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { ExtensionManifest } from "@jamra/extension-sdk";
import { runMigrations } from "./migrations.js";

export interface CatalogDatabaseOptions {
  filePath?: string;
  dataDir?: string;
}

export interface InitializedDatabase {
  db: Database.Database;
  manifest?: ExtensionManifest;
}

function resolveDataDirectory(explicit?: string): string {
  if (explicit) return explicit;
  const env = process.env.JAMRA_DATA_DIR;
  if (env && env.trim().length > 0) return env.trim();
  return path.join(process.cwd(), ".jamra-data");
}

function ensureDirectory(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export class CatalogDatabase {
  private connection?: Database.Database;
  private filePath: string;

  constructor(options: CatalogDatabaseOptions = {}) {
    const dataDir = resolveDataDirectory(options.dataDir);
    ensureDirectory(dataDir);
    this.filePath = options.filePath ?? path.join(dataDir, "catalog.sqlite");
  }

  connect(): Database.Database {
    if (this.connection) {
      return this.connection;
    }

    if (process.env.JAMRA_DISABLE_SQLITE === "1") {
      throw new Error(
        "SQLite usage disabled via JAMRA_DISABLE_SQLITE. Remove the env variable to enable the persistent catalog database.",
      );
    }

    let db: Database.Database;

    try {
      db = new Database(this.filePath, {
        readonly: false,
        fileMustExist: false,
      });
    } catch (error) {
      throw new Error(
        `Unable to open SQLite database at ${this.filePath}. Install build tooling and run \`pnpm sqlite:refresh\` (add \`-- --electron\` when rebuilding the desktop shell) or set JAMRA_DISABLE_SQLITE=1 to skip persistence. Cause: ${String(
          error,
        )}`,
      );
    }

    try {
      db.pragma("journal_mode = WAL");
      db.pragma("foreign_keys = ON");
      db.pragma("synchronous = NORMAL");
      db.pragma("temp_store = MEMORY");

      runMigrations(db);
    } catch (error) {
      db.close();
      throw new Error(
        `Failed to initialize SQLite catalog at ${this.filePath}. Ensure better-sqlite3 native bindings are built (run \`pnpm sqlite:refresh\`, adding \`-- --electron\` when packaging Electron) or set JAMRA_DISABLE_SQLITE=1 to force in-memory operation. Cause: ${String(
          error,
        )}`,
      );
    }

    this.connection = db;
    return db;
  }

  get db(): Database.Database {
    return this.connect();
  }

  close(): void {
    if (this.connection) {
      this.connection.close();
      this.connection = undefined;
    }
  }

  get path(): string {
    return this.filePath;
  }
}
