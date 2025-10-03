import path from "node:path";
import { fileURLToPath } from "node:url";
import { ExtensionHost } from "@jamra/extension-host";
import { CatalogDatabase } from "@jamra/catalog-db";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const extensionBuildPath = path.join(
  projectRoot,
  "packages",
  "example-extension",
  "dist",
  "index.js",
);

async function main() {
  let host;
  let database;

  try {
    if (process.env.JAMRA_DISABLE_SQLITE === "1") {
      throw new Error("JAMRA_DISABLE_SQLITE=1");
    }

    database = new CatalogDatabase();
    host = new ExtensionHost({ database });
  } catch (error) {
    console.warn(
      "SQLite backend unavailable, falling back to in-memory cache.",
    );
    console.warn(String(error));
    host = new ExtensionHost();
  }

  try {
    const { manifest } = await host.loadFromFile(extensionBuildPath);
    console.log(`Loaded extension: ${manifest.name} v${manifest.version}`);

    const page = await host.invokeCatalogue(manifest.id, { page: 1 });
    console.log(
      "Catalogue items:",
      page.items.map((item) => item.title),
    );

    const first = page.items[0];
    if (!first) {
      console.warn("No catalogue items returned");
      return;
    }

    const details = await host.invokeMangaDetails(manifest.id, {
      mangaId: first.id,
    });
    console.log(`Fetched details for ${details.title}`);

    const chapters = await host.invokeChapterList(manifest.id, {
      mangaId: first.id,
    });
    console.log(`Chapter count: ${chapters?.length ?? 0}`);

    if (chapters && chapters.length > 0) {
      const pages = await host.invokeChapterPages(manifest.id, {
        mangaId: first.id,
        chapterId: chapters[0].id,
      });
      console.log(
        `Loaded ${pages.pages.length} pages for chapter ${chapters[0].id}`,
      );
    }
  } finally {
    database?.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
