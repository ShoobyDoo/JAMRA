import { runChapterMetaTests } from "./chapter-meta.test";
import { runChapterSlugTests } from "./chapter-slug.test";
import { runReadingHistoryTests } from "./reading-history.test";
import { runDownloadUtilsTests } from "./download-utils.test";

interface TestCase {
  name: string;
  run: () => void | Promise<void>;
}

async function main() {
  const tests: TestCase[] = [
    { name: "chapter meta helpers", run: runChapterMetaTests },
    { name: "chapter slug generation", run: runChapterSlugTests },
    { name: "reading history hydration", run: runReadingHistoryTests },
    { name: "download utilities", run: runDownloadUtilsTests },
  ];

  const results: Array<{ name: string; success: boolean; error?: Error }> = [];

  for (const test of tests) {
    try {
      await test.run();
      results.push({ name: test.name, success: true });
    } catch (error) {
      results.push({
        name: test.name,
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  const failed = results.filter((result) => !result.success);

  results.forEach((result) => {
    if (result.success) {
      console.log(`✓ ${result.name}`);
    } else {
      console.error(`✗ ${result.name}`);
      if (result.error) {
        console.error(result.error);
      }
    }
  });

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

void main();
