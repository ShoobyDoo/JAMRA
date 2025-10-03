import { ExtensionManifest } from "./types";
import { ExtensionHandlers } from "./handlers";

export interface ExtensionModule {
  manifest: ExtensionManifest;
  handlers: ExtensionHandlers;
}

export type ExtensionFactory = () => ExtensionModule | Promise<ExtensionModule>;
