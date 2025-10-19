import { cp, rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const sourceDir = path.join(
  repoRoot,
  "packages/catalog-server/src/extensions/registries",
);
const destDir = path.join(
  repoRoot,
  "packages/catalog-server/dist/extensions/registries",
);

async function main() {
  await rm(destDir, { recursive: true, force: true });
  await mkdir(destDir, { recursive: true });
  await cp(sourceDir, destDir, { recursive: true });
  console.log(
    `Copied catalog-server assets to ${path.relative(repoRoot, destDir)}`,
  );
}

main().catch((error) => {
  console.error("Failed to copy catalog-server assets:", error);
  process.exitCode = 1;
});
