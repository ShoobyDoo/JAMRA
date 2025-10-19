import type Database from "better-sqlite3";

export type LibraryStatus = "reading" | "plan_to_read" | "completed" | "on_hold" | "dropped";

export interface LibraryEntry {
  mangaId: string;
  extensionId: string;
  status: LibraryStatus;
  personalRating: number | null;
  favorite: boolean;
  notes: string | null;
  addedAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
}

export interface LibraryTag {
  id: number;
  name: string;
  color: string | null;
  createdAt: number;
}

export class LibraryRepository {
  constructor(private readonly db: Database.Database) {}

  addToLibrary(
    mangaId: string,
    extensionId: string,
    status: LibraryStatus,
    options?: {
      personalRating?: number;
      favorite?: boolean;
      notes?: string;
      startedAt?: number;
      completedAt?: number;
    },
  ): LibraryEntry {
    const timestamp = Date.now();

    this.db
      .prepare(
        `
        INSERT INTO library_entries (
          manga_id,
          extension_id,
          status,
          personal_rating,
          favorite,
          notes,
          added_at,
          updated_at,
          started_at,
          completed_at
        ) VALUES (
          @manga_id,
          @extension_id,
          @status,
          @personal_rating,
          @favorite,
          @notes,
          @added_at,
          @updated_at,
          @started_at,
          @completed_at
        )
        ON CONFLICT(manga_id) DO UPDATE SET
          extension_id = excluded.extension_id,
          status = excluded.status,
          personal_rating = excluded.personal_rating,
          favorite = excluded.favorite,
          notes = excluded.notes,
          updated_at = excluded.updated_at,
          started_at = excluded.started_at,
          completed_at = excluded.completed_at
      `,
      )
      .run({
        manga_id: mangaId,
        extension_id: extensionId,
        status,
        personal_rating: options?.personalRating ?? null,
        favorite: options?.favorite ? 1 : 0,
        notes: options?.notes ?? null,
        added_at: timestamp,
        updated_at: timestamp,
        started_at: options?.startedAt ?? null,
        completed_at: options?.completedAt ?? null,
      });

    return {
      mangaId,
      extensionId,
      status,
      personalRating: options?.personalRating ?? null,
      favorite: options?.favorite ?? false,
      notes: options?.notes ?? null,
      addedAt: timestamp,
      updatedAt: timestamp,
      startedAt: options?.startedAt ?? null,
      completedAt: options?.completedAt ?? null,
    };
  }

  updateLibraryEntry(
    mangaId: string,
    updates: {
      status?: LibraryStatus;
      personalRating?: number | null;
      favorite?: boolean;
      notes?: string | null;
      startedAt?: number | null;
      completedAt?: number | null;
    },
  ): void {
    const fields: string[] = [];
    const params: Record<string, unknown> = { manga_id: mangaId, updated_at: Date.now() };

    if (updates.status !== undefined) {
      fields.push("status = @status");
      params.status = updates.status;
    }
    if (updates.personalRating !== undefined) {
      fields.push("personal_rating = @personal_rating");
      params.personal_rating = updates.personalRating;
    }
    if (updates.favorite !== undefined) {
      fields.push("favorite = @favorite");
      params.favorite = updates.favorite ? 1 : 0;
    }
    if (updates.notes !== undefined) {
      fields.push("notes = @notes");
      params.notes = updates.notes;
    }
    if (updates.startedAt !== undefined) {
      fields.push("started_at = @started_at");
      params.started_at = updates.startedAt;
    }
    if (updates.completedAt !== undefined) {
      fields.push("completed_at = @completed_at");
      params.completed_at = updates.completedAt;
    }

    if (fields.length === 0) return;

    fields.push("updated_at = @updated_at");

    this.db
      .prepare(`UPDATE library_entries SET ${fields.join(", ")} WHERE manga_id = @manga_id`)
      .run(params);
  }

  removeFromLibrary(mangaId: string): void {
    this.db.prepare("DELETE FROM library_entries WHERE manga_id = ?").run(mangaId);
  }

  getLibraryEntry(mangaId: string): LibraryEntry | undefined {
    const row = this.db
      .prepare("SELECT * FROM library_entries WHERE manga_id = ?")
      .get(mangaId) as {
      manga_id: string;
      extension_id: string;
      status: LibraryStatus;
      personal_rating: number | null;
      favorite: number;
      notes: string | null;
      added_at: number;
      updated_at: number;
      started_at: number | null;
      completed_at: number | null;
    } | undefined;

    if (!row) return undefined;

    return {
      mangaId: row.manga_id,
      extensionId: row.extension_id,
      status: row.status,
      personalRating: row.personal_rating,
      favorite: row.favorite === 1,
      notes: row.notes,
      addedAt: row.added_at,
      updatedAt: row.updated_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    };
  }

  getLibraryEntries(filters?: {
    status?: LibraryStatus;
    favorite?: boolean;
  }): LibraryEntry[] {
    let sql = "SELECT * FROM library_entries WHERE 1=1";
    const params: Record<string, unknown> = {};

    if (filters?.status) {
      sql += " AND status = @status";
      params.status = filters.status;
    }

    if (filters?.favorite !== undefined) {
      sql += " AND favorite = @favorite";
      params.favorite = filters.favorite ? 1 : 0;
    }

    sql += " ORDER BY updated_at DESC";

    const rows = this.db.prepare(sql).all(params) as Array<{
      manga_id: string;
      extension_id: string;
      status: LibraryStatus;
      personal_rating: number | null;
      favorite: number;
      notes: string | null;
      added_at: number;
      updated_at: number;
      started_at: number | null;
      completed_at: number | null;
    }>;

    return rows.map((row) => ({
      mangaId: row.manga_id,
      extensionId: row.extension_id,
      status: row.status,
      personalRating: row.personal_rating,
      favorite: row.favorite === 1,
      notes: row.notes,
      addedAt: row.added_at,
      updatedAt: row.updated_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    }));
  }

  createLibraryTag(name: string, color?: string): LibraryTag {
    const result = this.db
      .prepare(
        `
        INSERT INTO library_tags (name, color, created_at)
        VALUES (@name, @color, @created_at)
      `,
      )
      .run({
        name,
        color: color ?? null,
        created_at: Date.now(),
      });

    const row = this.db
      .prepare("SELECT * FROM library_tags WHERE id = ?")
      .get(result.lastInsertRowid) as {
      id: number;
      name: string;
      color: string | null;
      created_at: number;
    };

    return {
      id: row.id,
      name: row.name,
      color: row.color,
      createdAt: row.created_at,
    };
  }

  deleteLibraryTag(tagId: number): void {
    this.db.prepare("DELETE FROM library_tags WHERE id = ?").run(tagId);
  }

  getLibraryTags(): LibraryTag[] {
    const rows = this.db.prepare("SELECT * FROM library_tags ORDER BY name ASC").all() as Array<{
      id: number;
      name: string;
      color: string | null;
      created_at: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      createdAt: row.created_at,
    }));
  }

  addTagToLibraryEntry(mangaId: string, tagId: number): void {
    this.db
      .prepare(
        `
        INSERT INTO library_entry_tags (manga_id, tag_id)
        VALUES (@manga_id, @tag_id)
        ON CONFLICT DO NOTHING
      `,
      )
      .run({ manga_id: mangaId, tag_id: tagId });
  }

  removeTagFromLibraryEntry(mangaId: string, tagId: number): void {
    this.db
      .prepare("DELETE FROM library_entry_tags WHERE manga_id = ? AND tag_id = ?")
      .run(mangaId, tagId);
  }

  getTagsForLibraryEntry(mangaId: string): LibraryTag[] {
    const rows = this.db
      .prepare(
        `
        SELECT t.* FROM library_tags t
        INNER JOIN library_entry_tags et ON et.tag_id = t.id
        WHERE et.manga_id = ?
        ORDER BY t.name ASC
      `,
      )
      .all(mangaId) as Array<{
      id: number;
      name: string;
      color: string | null;
      created_at: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      createdAt: row.created_at,
    }));
  }
}
