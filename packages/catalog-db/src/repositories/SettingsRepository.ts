import type Database from "better-sqlite3";

export class SettingsRepository {
  constructor(private readonly db: Database.Database) {}

  setAppSetting(key: string, value: unknown): void {
    this.db
      .prepare(
        `
        INSERT INTO app_settings (key, value, updated_at)
        VALUES (@key, @value, @updated_at)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `,
      )
      .run({
        key,
        value: JSON.stringify(value),
        updated_at: Date.now(),
      });
  }

  getAppSetting<T>(key: string): T | undefined {
    const row = this.db
      .prepare("SELECT value FROM app_settings WHERE key = ?")
      .get(key) as { value: string } | undefined;

    return row ? (JSON.parse(row.value) as T) : undefined;
  }
}
