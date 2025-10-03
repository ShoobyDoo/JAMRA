import type { Server } from "node:http";
export interface CatalogServerOptions {
    port?: number;
    extensionPath?: string;
    extensionId?: string;
    disableCors?: boolean;
}
export interface CatalogServerInstance {
    port: number;
    extensionId?: string;
    loadedExtensions: string[];
    server: Server;
    close: () => Promise<void>;
}
export declare function startCatalogServer(options?: CatalogServerOptions): Promise<CatalogServerInstance>;
//# sourceMappingURL=server.d.ts.map