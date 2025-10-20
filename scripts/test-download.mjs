#!/usr/bin/env node

/**
 * Test script for offline download functionality
 * Usage: node scripts/test-download.mjs
 */

const API_URL = process.env.JAMRA_API_URL || "http://localhost:4545";

async function testDownload() {
  console.log("=== Testing Offline Download Functionality ===\n");

  try {
    // 1. Get manga details
    console.log("1. Fetching manga details...");
    const mangaResponse = await fetch(
      `${API_URL}/api/manga/com.jamra.example/example-1`,
    );
    if (!mangaResponse.ok) {
      throw new Error(`Failed to fetch manga: ${mangaResponse.status}`);
    }
    const mangaData = await mangaResponse.json();
    const manga = mangaData.details;
    console.log(`   ✓ Found manga: ${manga.title}`);
    console.log(`   ✓ Chapters available: ${manga.chapters?.length || 0}\n`);

    if (!manga.chapters || manga.chapters.length === 0) {
      throw new Error("No chapters available to test");
    }

    // 2. Queue a chapter download
    const testChapter = manga.chapters[0];
    console.log(
      `2. Queuing chapter download: ${testChapter.title || testChapter.id}...`,
    );
    const queueResponse = await fetch(
      `${API_URL}/api/offline/download/chapter`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extensionId: "com.jamra.example",
          mangaId: "example-1",
          chapterId: testChapter.id,
          priority: 0,
        }),
      },
    );

    if (!queueResponse.ok) {
      const error = await queueResponse.text();
      throw new Error(
        `Failed to queue download: ${queueResponse.status} - ${error}`,
      );
    }

    const queueData = await queueResponse.json();
    console.log(`   ✓ Download queued with ID: ${queueData.queueId}\n`);

    // 3. Check queue status
    console.log("3. Checking download queue...");
    const queueCheckResponse = await fetch(`${API_URL}/api/offline/queue`);
    if (!queueCheckResponse.ok) {
      throw new Error(`Failed to check queue: ${queueCheckResponse.status}`);
    }
    const queueCheckData = await queueCheckResponse.json();
    console.log(`   ✓ Queue items: ${queueCheckData.queue.length}`);

    const ourItem = queueCheckData.queue.find(
      (q) => q.id === queueData.queueId,
    );
    if (ourItem) {
      console.log(`   ✓ Status: ${ourItem.status}`);
      console.log(
        `   ✓ Progress: ${ourItem.progressCurrent}/${ourItem.progressTotal}\n`,
      );
    }

    // 4. Test SSE connection
    console.log("4. Testing SSE connection...");
    console.log("   → Connecting to SSE endpoint...");
    console.log("   → (This will show real-time download progress)");
    console.log("   → Press Ctrl+C to stop\n");

    const eventSource = new (await import("eventsource")).default(
      `${API_URL}/api/offline/events`,
    );

    eventSource.addEventListener("connected", () => {
      console.log("   ✓ SSE connection established\n");
      console.log("=== Listening for download events ===");
    });

    eventSource.addEventListener("download-started", (e) => {
      const data = JSON.parse(e.data);
      console.log(`[STARTED] Queue ${data.queueId}`);
    });

    eventSource.addEventListener("download-progress", (e) => {
      const data = JSON.parse(e.data);
      const percent =
        data.progressTotal > 0
          ? Math.round((data.progressCurrent / data.progressTotal) * 100)
          : 0;
      console.log(
        `[PROGRESS] Queue ${data.queueId}: ${data.progressCurrent}/${data.progressTotal} pages (${percent}%)`,
      );
    });

    eventSource.addEventListener("download-completed", (e) => {
      const data = JSON.parse(e.data);
      console.log(`[COMPLETED] Queue ${data.queueId}\n`);
      console.log("=== Download Test Successful! ===");
      eventSource.close();
      process.exit(0);
    });

    eventSource.addEventListener("download-failed", (e) => {
      const data = JSON.parse(e.data);
      console.error(`[FAILED] Queue ${data.queueId}: ${data.error}`);
      eventSource.close();
      process.exit(1);
    });

    eventSource.onerror = (error) => {
      console.error("SSE connection error:", error);
      eventSource.close();
      process.exit(1);
    };
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    process.exit(1);
  }
}

testDownload();
