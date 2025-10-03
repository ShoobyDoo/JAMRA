import type { ExtensionManifest } from "@jamra/extension-sdk";
export declare class ExtensionStorage {
    private readonly baseDir;
    constructor(baseDir: string);
    save(sourcePath: string, manifest: ExtensionManifest): Promise<string>;
    remove(manifestId: string): Promise<void>;
    private removeOtherVersions;
}
//# sourceMappingURL=storage.d.ts.map