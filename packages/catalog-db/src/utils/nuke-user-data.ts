import type Database from "better-sqlite3";

/**
 * Nuclear option: Clears all user data (reading progress, cached manga, etc.)
 * but preserves installed extensions.
 *
 * WARNING: This is destructive and cannot be undone!
 */
export function nukeUserData(db: Database.Database): void {
  // Use a transaction to ensure atomicity
  const transaction = db.transaction(() => {
    // Clear history
    db.prepare("DELETE FROM history_entries").run();

    // Clear library data
    db.prepare("DELETE FROM library_entry_tags").run();
    db.prepare("DELETE FROM library_tags").run();
    db.prepare("DELETE FROM library_entries").run();

    // Clear reading progress
    db.prepare("DELETE FROM reading_progress").run();

    // Clear cached content
    db.prepare("DELETE FROM chapter_pages").run();
    db.prepare("DELETE FROM chapters").run();
    db.prepare("DELETE FROM manga_details").run();
    db.prepare("DELETE FROM manga").run();

    // Clear cover cache (base64-encoded cached images)
    db.prepare("DELETE FROM manga_cover_cache").run();

    // Clear extension cache
    db.prepare("DELETE FROM extension_cache").run();

    // Clear sync state
    db.prepare("DELETE FROM sync_state").run();
  });

  transaction();
}
