import type Database from "better-sqlite3";
import type { AppContext } from "../../app/context.js";
import type {
  ExtensionManifest,
  ExtensionModule,
} from "@jamra/extension-sdk";

export interface ExtensionRecord {
  id: string;
  slug: string;
  name: string;
  version: string;
  repoSource?: string;
  installedAt?: Date;
  enabled: boolean;
  installPath: string;
  checksum?: string;
  manifest: ExtensionManifest;
}

export interface ExtensionRegistry {
  list(): Promise<ExtensionRecord[]>;
  findById(id: string): Promise<ExtensionRecord | null>;
  upsert(record: ExtensionRecord): Promise<void>;
  setEnabled(id: string, enabled: boolean): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface ExtensionRuntime {
  initialise(record: ExtensionRecord): Promise<void>;
  execute<TPayload = unknown, TResult = unknown>(
    record: ExtensionRecord,
    lifecycleMethod: keyof ExtensionModule,
    payload: TPayload,
  ): Promise<TResult>;
  dispose(record: ExtensionRecord): Promise<void>;
}

export interface LoadedExtensionSource {
  code: string;
  entryPath: string;
  sourceMap?: string;
}

export interface ExtensionLoader {
  loadSource(record: ExtensionRecord): Promise<LoadedExtensionSource>;
  unload(record: ExtensionRecord): Promise<void>;
}

export interface ExtensionsModuleContext extends AppContext {
  registry: ExtensionRegistry;
  runtime: ExtensionRuntime;
  loader: ExtensionLoader;
  db: Database.Database;
}
