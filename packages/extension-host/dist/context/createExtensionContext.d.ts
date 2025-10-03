import type { ExtensionContext, ExtensionManifest } from "@jamra/extension-sdk";
import { type FetchHttpClientOptions } from "./httpClient.js";
export interface CreateExtensionContextOptions {
    logger?: ExtensionContext["logger"];
    cache?: ExtensionContext["cache"];
    http?: ExtensionContext["http"] | FetchHttpClientOptions;
    settings?: Record<string, unknown>;
    runtime?: ExtensionContext["runtime"];
}
export declare function createExtensionContext(manifest: ExtensionManifest, options?: CreateExtensionContextOptions): ExtensionContext;
//# sourceMappingURL=createExtensionContext.d.ts.map