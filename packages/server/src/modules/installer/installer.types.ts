import type { ExtensionManifest } from "@jamra/extension-sdk";

export interface InstallRequest {
  sourceUrl: string;
  checksum?: string;
  signature?: string;
}

export interface InstallResult {
  id: string;
  status: "pending" | "completed" | "failed";
  error?: string;
}

export interface PackageValidator {
  validate(files: string[], manifest: ExtensionManifest): Promise<void>;
}

export interface ExtensionPackager {
  unpack(archivePath: string, targetDir: string): Promise<string[]>;
}
