import fs from "node:fs";
import path from "node:path";
function sanitizeId(id) {
    return id.replace(/[^a-zA-Z0-9-_]/g, "_");
}
export class ExtensionStorage {
    constructor(baseDir) {
        this.baseDir = baseDir;
        fs.mkdirSync(this.baseDir, { recursive: true });
    }
    async save(sourcePath, manifest) {
        const ext = path.extname(sourcePath) || ".js";
        const target = path.join(this.baseDir, `${sanitizeId(manifest.id)}@${manifest.version}${ext}`);
        await fs.promises.copyFile(sourcePath, target);
        await this.removeOtherVersions(manifest.id, target);
        return target;
    }
    async remove(manifestId) {
        await this.removeOtherVersions(manifestId);
    }
    async removeOtherVersions(manifestId, keep) {
        const entries = await fs.promises.readdir(this.baseDir, {
            withFileTypes: true,
        });
        const normalizedKeep = keep ? path.resolve(keep) : undefined;
        const prefix = `${sanitizeId(manifestId)}@`;
        await Promise.all(entries
            .filter((entry) => entry.isFile() && entry.name.startsWith(prefix))
            .map(async (entry) => {
            const filePath = path.resolve(this.baseDir, entry.name);
            if (normalizedKeep && filePath === normalizedKeep)
                return;
            await fs.promises.rm(filePath, { force: true }).catch(() => {
                // Ignore removal errors; stale files can be cleaned up later.
            });
        }));
    }
}
