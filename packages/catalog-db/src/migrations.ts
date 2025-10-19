import type Database from "better-sqlite3";

interface Migration {
  id: number;
  up: (db: Database.Database) => void;
}

const MIGRATIONS: Migration[] = [
  {
    id: 1,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS extension_cache (
          namespace TEXT NOT NULL,
          cache_key TEXT NOT NULL,
          value TEXT NOT NULL,
          expires_at INTEGER,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
          PRIMARY KEY (namespace, cache_key)
        );

        CREATE INDEX IF NOT EXISTS idx_extension_cache_expires_at
          ON extension_cache (expires_at);

        CREATE TABLE IF NOT EXISTS extensions (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          version TEXT NOT NULL,
          description TEXT,
          homepage TEXT,
          icon TEXT,
          author_name TEXT NOT NULL,
          author_url TEXT,
          author_contact TEXT,
          language_codes TEXT NOT NULL,
          capabilities_json TEXT NOT NULL,
          manifest_json TEXT NOT NULL,
          entry_path TEXT,
          is_enabled INTEGER NOT NULL DEFAULT 1,
          settings_json TEXT,
          installed_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
        );

        CREATE TABLE IF NOT EXISTS manga (
          id TEXT PRIMARY KEY,
          extension_id TEXT NOT NULL,
          title TEXT NOT NULL,
          alt_titles_json TEXT,
          description TEXT,
          cover_url TEXT,
          status TEXT,
          tags_json TEXT,
          demographic TEXT,
          language_code TEXT,
          updated_at TEXT,
          last_synced_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
          FOREIGN KEY (extension_id) REFERENCES extensions(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_manga_extension ON manga (extension_id);
        CREATE INDEX IF NOT EXISTS idx_manga_updated_at ON manga (updated_at);

        CREATE TABLE IF NOT EXISTS chapters (
          id TEXT PRIMARY KEY,
          manga_id TEXT NOT NULL,
          extension_id TEXT NOT NULL,
          title TEXT,
          chapter_number TEXT,
          volume TEXT,
          language_code TEXT,
          published_at TEXT,
          external_url TEXT,
          last_synced_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
          FOREIGN KEY (manga_id) REFERENCES manga(id) ON DELETE CASCADE,
          FOREIGN KEY (extension_id) REFERENCES extensions(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_chapters_manga ON chapters (manga_id);
        CREATE INDEX IF NOT EXISTS idx_chapters_extension ON chapters (extension_id);

        CREATE TABLE IF NOT EXISTS chapter_pages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          chapter_id TEXT NOT NULL,
          manga_id TEXT NOT NULL,
          extension_id TEXT NOT NULL,
          page_index INTEGER NOT NULL,
          image_url TEXT NOT NULL,
          width INTEGER,
          height INTEGER,
          bytes INTEGER,
          FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
          FOREIGN KEY (manga_id) REFERENCES manga(id) ON DELETE CASCADE,
          FOREIGN KEY (extension_id) REFERENCES extensions(id) ON DELETE CASCADE,
          UNIQUE (chapter_id, page_index)
        );

        CREATE INDEX IF NOT EXISTS idx_chapter_pages_chapter ON chapter_pages (chapter_id);

        CREATE TABLE IF NOT EXISTS sync_state (
          extension_id TEXT PRIMARY KEY,
          last_catalogue_sync INTEGER,
          last_full_sync INTEGER,
          FOREIGN KEY (extension_id) REFERENCES extensions(id) ON DELETE CASCADE
        );
      `);
    },
  },
  {
    id: 2,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS manga_details (
          manga_id TEXT PRIMARY KEY,
          extension_id TEXT NOT NULL,
          authors_json TEXT,
          artists_json TEXT,
          genres_json TEXT,
          links_json TEXT,
          rating REAL,
          year INTEGER,
          last_synced_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
          FOREIGN KEY (manga_id) REFERENCES manga(id) ON DELETE CASCADE,
          FOREIGN KEY (extension_id) REFERENCES extensions(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_manga_details_extension
          ON manga_details (extension_id);
      `);
    },
  },
  {
    id: 3,
    up: (db) => {
      const columns = db
        .prepare(`PRAGMA table_info(extensions)`)
        .all() as Array<{
        name: string;
      }>;
      const existing = new Set(columns.map((column) => column.name));

      if (!existing.has("entry_path")) {
        db.exec(`ALTER TABLE extensions ADD COLUMN entry_path TEXT;`);
      }
      if (!existing.has("is_enabled")) {
        db.exec(
          `ALTER TABLE extensions ADD COLUMN is_enabled INTEGER NOT NULL DEFAULT 1;`,
        );
      }
      if (!existing.has("settings_json")) {
        db.exec(`ALTER TABLE extensions ADD COLUMN settings_json TEXT;`);
      }
    },
  },
  {
    id: 4,
    up: (db) => {
      const columns = db
        .prepare(`PRAGMA table_info(extensions)`)
        .all() as Array<{
        name: string;
      }>;
      const existing = new Set(columns.map((column) => column.name));

      if (!existing.has("source_metadata_json")) {
        db.exec(`ALTER TABLE extensions ADD COLUMN source_metadata_json TEXT;`);
      }

      if (!existing.has("update_state_json")) {
        db.exec(`ALTER TABLE extensions ADD COLUMN update_state_json TEXT;`);
      }
    },
  },
  {
    id: 5,
    up: (db) => {
      const columns = db
        .prepare(`PRAGMA table_info(extensions)`)
        .all() as Array<{
        name: string;
      }>;
      const existing = new Set(columns.map((column) => column.name));

      if (!existing.has("icon")) {
        db.exec(`ALTER TABLE extensions ADD COLUMN icon TEXT;`);
      }
    },
  },
  {
    id: 6,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS reading_progress (
          manga_id TEXT NOT NULL,
          chapter_id TEXT NOT NULL,
          current_page INTEGER NOT NULL DEFAULT 0,
          total_pages INTEGER NOT NULL,
          scroll_position INTEGER DEFAULT 0,
          last_read_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
          PRIMARY KEY (manga_id, chapter_id)
        );

        CREATE INDEX IF NOT EXISTS idx_reading_progress_last_read
          ON reading_progress (last_read_at DESC);
      `);
    },
  },
  {
    id: 7,
    up: (db) => {
      // Add series_name column to manga table for WeebCentral caching
      const columns = db
        .prepare(`PRAGMA table_info(manga)`)
        .all() as Array<{
        name: string;
      }>;
      const existing = new Set(columns.map((column) => column.name));

      if (!existing.has("series_name")) {
        db.exec(`ALTER TABLE manga ADD COLUMN series_name TEXT;`);
      }

      // Create index for faster lookups
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_manga_series_name
          ON manga (series_name);
      `);
    },
  },
  {
    id: 8,
    up: (db) => {
      const columns = db
        .prepare(`PRAGMA table_info(manga)`)
        .all() as Array<{
        name: string;
      }>;
      const existing = new Set(columns.map((column) => column.name));

      if (!existing.has("slug")) {
        db.exec(`ALTER TABLE manga ADD COLUMN slug TEXT;`);
      }

      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_manga_extension_slug
          ON manga (extension_id, slug)
          WHERE slug IS NOT NULL;
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_manga_slug_lookup
          ON manga (slug)
          WHERE slug IS NOT NULL;
      `);

      db.exec(`
        UPDATE manga
        SET slug = lower(series_name)
        WHERE slug IS NULL
          AND series_name IS NOT NULL
          AND length(series_name) > 0;
      `);
    },
  },
  {
    id: 9,
    up: (db) => {
      const columns = db
        .prepare(`PRAGMA table_info(manga)`)
        .all() as Array<{
        name: string;
      }>;
      const existing = new Set(columns.map((column) => column.name));

      if (!existing.has("cover_urls_json")) {
        db.exec(`ALTER TABLE manga ADD COLUMN cover_urls_json TEXT;`);
      }

      db.exec(`
        CREATE TABLE IF NOT EXISTS manga_cover_cache (
          manga_id TEXT NOT NULL,
          extension_id TEXT NOT NULL,
          cover_url TEXT NOT NULL,
          data_base64 TEXT NOT NULL,
          mime_type TEXT,
          bytes INTEGER,
          metadata_json TEXT,
          updated_at INTEGER NOT NULL,
          expires_at INTEGER,
          PRIMARY KEY (manga_id, extension_id),
          FOREIGN KEY (manga_id) REFERENCES manga(id) ON DELETE CASCADE,
          FOREIGN KEY (extension_id) REFERENCES extensions(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_manga_cover_cache_expiry
          ON manga_cover_cache (expires_at);
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
        );
      `);
    },
  },
  {
    id: 10,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS library_entries (
          manga_id TEXT PRIMARY KEY,
          extension_id TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('reading', 'plan_to_read', 'completed', 'on_hold', 'dropped')),
          personal_rating REAL CHECK(personal_rating IS NULL OR (personal_rating >= 0 AND personal_rating <= 10)),
          favorite INTEGER NOT NULL DEFAULT 0,
          notes TEXT,
          added_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
          started_at INTEGER,
          completed_at INTEGER,
          FOREIGN KEY (manga_id) REFERENCES manga(id) ON DELETE CASCADE,
          FOREIGN KEY (extension_id) REFERENCES extensions(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_library_status
          ON library_entries(status);
        CREATE INDEX IF NOT EXISTS idx_library_favorite
          ON library_entries(favorite) WHERE favorite = 1;
        CREATE INDEX IF NOT EXISTS idx_library_added_at
          ON library_entries(added_at DESC);
        CREATE INDEX IF NOT EXISTS idx_library_updated_at
          ON library_entries(updated_at DESC);

        CREATE TABLE IF NOT EXISTS library_tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          color TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
        );

        CREATE TABLE IF NOT EXISTS library_entry_tags (
          manga_id TEXT NOT NULL,
          tag_id INTEGER NOT NULL,
          PRIMARY KEY (manga_id, tag_id),
          FOREIGN KEY (manga_id) REFERENCES library_entries(manga_id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES library_tags(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_library_entry_tags_manga
          ON library_entry_tags(manga_id);
        CREATE INDEX IF NOT EXISTS idx_library_entry_tags_tag
          ON library_entry_tags(tag_id);
      `);
    },
  },
];

export function runMigrations(db: Database.Database): void {
  const currentVersion =
    (db.pragma("user_version", { simple: true }) as number) ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.id <= currentVersion) continue;

    db.transaction(() => {
      migration.up(db);
      db.pragma(`user_version = ${migration.id}`);
    })();
  }
}
