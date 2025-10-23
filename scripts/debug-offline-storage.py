#!/usr/bin/env python3
"""
Diagnostic script for offline storage database debugging.
Inspects the SQLite database to understand the actual state of downloads.
"""

import sqlite3
import json
import sys
from pathlib import Path
from datetime import datetime

DB_PATH = Path(__file__).parent.parent / ".jamra-data" / "catalog.sqlite"

def connect_db():
    """Connect to the SQLite database."""
    if not DB_PATH.exists():
        print(f"❌ Database not found at: {DB_PATH}")
        sys.exit(1)
    return sqlite3.connect(str(DB_PATH))

def format_timestamp(ts):
    """Convert Unix timestamp (ms) to readable format."""
    if ts is None:
        return "N/A"
    try:
        return datetime.fromtimestamp(ts / 1000).strftime("%Y-%m-%d %H:%M:%S")
    except:
        return str(ts)

def inspect_database():
    """Inspect the offline storage database."""
    conn = connect_db()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    print("="*80)
    print("OFFLINE STORAGE DATABASE INSPECTION")
    print("="*80)
    print()

    # Check if tables exist
    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name LIKE 'offline%' OR name LIKE 'download%'
        ORDER BY name
    """)
    tables = cursor.fetchall()

    if not tables:
        print("❌ No offline storage tables found!")
        conn.close()
        return

    print("📋 Available tables:")
    for table in tables:
        print(f"   - {table['name']}")
    print()

    # 1. OFFLINE MANGA
    print("="*80)
    print("1. OFFLINE MANGA")
    print("="*80)
    cursor.execute("""
        SELECT id, extension_id, manga_id, manga_slug,
               downloaded_at, last_updated_at, total_size_bytes
        FROM offline_manga
        ORDER BY downloaded_at DESC
    """)
    manga_list = cursor.fetchall()

    if not manga_list:
        print("   No manga downloaded")
    else:
        for manga in manga_list:
            print(f"\n   Manga ID: {manga['id']}")
            print(f"   Extension: {manga['extension_id']}")
            print(f"   Manga ID: {manga['manga_id']}")
            print(f"   Slug: {manga['manga_slug']}")
            print(f"   Downloaded: {format_timestamp(manga['downloaded_at'])}")
            print(f"   Last Updated: {format_timestamp(manga['last_updated_at'])}")
            print(f"   Size: {manga['total_size_bytes']:,} bytes")

    print()

    # 2. OFFLINE CHAPTERS
    print("="*80)
    print("2. OFFLINE CHAPTERS")
    print("="*80)

    cursor.execute("""
        SELECT
            oc.id,
            om.manga_slug,
            oc.chapter_id,
            oc.chapter_number,
            oc.chapter_title,
            oc.total_pages,
            oc.downloaded_at,
            oc.size_bytes
        FROM offline_chapters oc
        JOIN offline_manga om ON oc.offline_manga_id = om.id
        ORDER BY om.manga_slug, oc.chapter_number
    """)
    chapters = cursor.fetchall()

    if not chapters:
        print("   No chapters downloaded")
    else:
        current_manga = None
        for chapter in chapters:
            if current_manga != chapter['manga_slug']:
                current_manga = chapter['manga_slug']
                print(f"\n   📖 {current_manga}")

            print(f"      Ch {chapter['chapter_number']}: {chapter['chapter_title'] or 'Untitled'}")
            print(f"         ID: {chapter['chapter_id']}")
            print(f"         Pages: {chapter['total_pages']}")
            print(f"         Size: {chapter['size_bytes']:,} bytes")
            print(f"         Downloaded: {format_timestamp(chapter['downloaded_at'])}")

    print()

    # 3. DOWNLOAD QUEUE
    print("="*80)
    print("3. DOWNLOAD QUEUE (Active/Pending)")
    print("="*80)

    cursor.execute("""
        SELECT
            id, extension_id, manga_slug, chapter_id, chapter_number, chapter_title,
            status, priority, queued_at, started_at, completed_at, error_message,
            progress_current, progress_total
        FROM download_queue
        ORDER BY priority DESC, queued_at ASC
    """)
    queue = cursor.fetchall()

    if not queue:
        print("   Queue is empty")
    else:
        for item in queue:
            status_emoji = {
                'queued': '⏳',
                'downloading': '⬇️',
                'completed': '✅',
                'failed': '❌'
            }.get(item['status'], '❓')

            print(f"\n   {status_emoji} Queue ID: {item['id']} | Status: {item['status'].upper()}")
            print(f"      Manga: {item['manga_slug']}")

            if item['chapter_id']:
                print(f"      Chapter: Ch {item['chapter_number']} - {item['chapter_title'] or 'Untitled'}")
                print(f"      Chapter ID: {item['chapter_id']}")
            else:
                print(f"      Type: FULL MANGA DOWNLOAD")

            print(f"      Priority: {item['priority']}")
            print(f"      Queued: {format_timestamp(item['queued_at'])}")

            if item['started_at']:
                print(f"      Started: {format_timestamp(item['started_at'])}")

            if item['status'] == 'downloading':
                progress_pct = 0
                if item['progress_total'] and item['progress_total'] > 0:
                    progress_pct = (item['progress_current'] / item['progress_total']) * 100
                print(f"      Progress: {item['progress_current']}/{item['progress_total']} ({progress_pct:.1f}%)")

            if item['error_message']:
                print(f"      ❌ Error: {item['error_message']}")

    print()

    # 4. STATISTICS
    print("="*80)
    print("4. STATISTICS")
    print("="*80)

    cursor.execute("SELECT COUNT(*) as count FROM offline_manga")
    manga_count = cursor.fetchone()['count']

    cursor.execute("SELECT COUNT(*) as count FROM offline_chapters")
    chapter_count = cursor.fetchone()['count']

    cursor.execute("SELECT COUNT(*) as count FROM download_queue WHERE status = 'queued'")
    queued_count = cursor.fetchone()['count']

    cursor.execute("SELECT COUNT(*) as count FROM download_queue WHERE status = 'downloading'")
    downloading_count = cursor.fetchone()['count']

    cursor.execute("SELECT COUNT(*) as count FROM download_queue WHERE status = 'failed'")
    failed_count = cursor.fetchone()['count']

    cursor.execute("SELECT SUM(total_size_bytes) as size FROM offline_manga")
    total_size = cursor.fetchone()['size'] or 0

    print(f"\n   Downloaded Manga: {manga_count}")
    print(f"   Downloaded Chapters: {chapter_count}")
    print(f"   Total Size: {total_size:,} bytes ({total_size / (1024*1024):.2f} MB)")
    print(f"   Queue - Queued: {queued_count}")
    print(f"   Queue - Downloading: {downloading_count}")
    print(f"   Queue - Failed: {failed_count}")

    print()

    # 5. POTENTIAL ISSUES
    print("="*80)
    print("5. POTENTIAL ISSUES DETECTION")
    print("="*80)
    print()

    # Check for chapters in queue that are already downloaded
    cursor.execute("""
        SELECT
            dq.id as queue_id,
            dq.chapter_id,
            dq.chapter_number,
            dq.status as queue_status,
            om.manga_slug
        FROM download_queue dq
        JOIN offline_manga om ON dq.extension_id = om.extension_id
            AND dq.manga_id = om.manga_id
        JOIN offline_chapters oc ON oc.offline_manga_id = om.id
            AND oc.chapter_id = dq.chapter_id
        WHERE dq.chapter_id IS NOT NULL
    """)
    duplicate_queue = cursor.fetchall()

    if duplicate_queue:
        print("   ⚠️  CHAPTERS IN QUEUE THAT ARE ALREADY DOWNLOADED:")
        for dup in duplicate_queue:
            print(f"      - Queue ID {dup['queue_id']}: {dup['manga_slug']} Ch {dup['chapter_number']}")
            print(f"        Chapter ID: {dup['chapter_id']}")
            print(f"        Queue Status: {dup['queue_status']}")
    else:
        print("   ✅ No chapters in queue that are already downloaded")

    print()

    # Check for frozen downloads (downloading for > 1 hour)
    cursor.execute("""
        SELECT
            id, manga_slug, chapter_number, started_at,
            (strftime('%s', 'now') * 1000 - started_at) / 1000 / 60 as minutes_elapsed
        FROM download_queue
        WHERE status = 'downloading'
            AND started_at IS NOT NULL
            AND (strftime('%s', 'now') * 1000 - started_at) > 3600000
    """)
    frozen = cursor.fetchall()

    if frozen:
        print("   ⚠️  FROZEN DOWNLOADS (stuck in 'downloading' for > 1 hour):")
        for item in frozen:
            print(f"      - Queue ID {item['id']}: {item['manga_slug']} Ch {item['chapter_number']}")
            print(f"        Stuck for: {item['minutes_elapsed']:.1f} minutes")
    else:
        print("   ✅ No frozen downloads detected")

    print()

    # Check for chapters with 0 pages
    cursor.execute("""
        SELECT
            om.manga_slug,
            oc.chapter_id,
            oc.chapter_number,
            oc.total_pages
        FROM offline_chapters oc
        JOIN offline_manga om ON oc.offline_manga_id = om.id
        WHERE oc.total_pages = 0 OR oc.total_pages IS NULL
    """)
    zero_pages = cursor.fetchall()

    if zero_pages:
        print("   ⚠️  CHAPTERS WITH ZERO PAGES (possibly corrupted):")
        for item in zero_pages:
            print(f"      - {item['manga_slug']} Ch {item['chapter_number']}")
            print(f"        Chapter ID: {item['chapter_id']}")
    else:
        print("   ✅ All downloaded chapters have pages")

    print()
    print("="*80)

    conn.close()

def check_specific_manga(manga_id, extension_id="com.weebcentral.manga"):
    """Check specific manga for issues."""
    conn = connect_db()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    print("="*80)
    print(f"SPECIFIC MANGA CHECK: {manga_id}")
    print("="*80)
    print()

    # Get manga info
    cursor.execute("""
        SELECT * FROM offline_manga
        WHERE extension_id = ? AND manga_id = ?
    """, (extension_id, manga_id))

    manga = cursor.fetchone()

    if not manga:
        print(f"❌ Manga {manga_id} not found in offline_manga table")
        print("   This manga has no downloaded chapters.")
        conn.close()
        return

    print(f"✅ Manga found in database:")
    print(f"   DB ID: {manga['id']}")
    print(f"   Slug: {manga['manga_slug']}")
    print(f"   Total Size: {manga['total_size_bytes']:,} bytes")
    print()

    # Get downloaded chapters
    cursor.execute("""
        SELECT * FROM offline_chapters
        WHERE offline_manga_id = ?
        ORDER BY chapter_number
    """, (manga['id'],))

    chapters = cursor.fetchall()

    print(f"Downloaded Chapters: {len(chapters)}")
    if chapters:
        for ch in chapters:
            print(f"   - Ch {ch['chapter_number']}: {ch['chapter_title'] or 'Untitled'} ({ch['total_pages']} pages)")
            print(f"     ID: {ch['chapter_id']}")

    print()

    # Get queue items for this manga
    cursor.execute("""
        SELECT * FROM download_queue
        WHERE extension_id = ? AND manga_id = ?
        ORDER BY priority DESC, queued_at ASC
    """, (extension_id, manga_id))

    queue_items = cursor.fetchall()

    print(f"Queue Items: {len(queue_items)}")
    if queue_items:
        for item in queue_items:
            status_emoji = {
                'queued': '⏳',
                'downloading': '⬇️',
                'completed': '✅',
                'failed': '❌'
            }.get(item['status'], '❓')

            chapter_info = f"Ch {item['chapter_number']}" if item['chapter_id'] else "FULL MANGA"
            print(f"   {status_emoji} {chapter_info}: {item['status']}")
            if item['error_message']:
                print(f"      Error: {item['error_message']}")

    conn.close()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        manga_id = sys.argv[1]
        extension_id = sys.argv[2] if len(sys.argv) > 2 else "com.weebcentral.manga"
        check_specific_manga(manga_id, extension_id)
    else:
        inspect_database()
