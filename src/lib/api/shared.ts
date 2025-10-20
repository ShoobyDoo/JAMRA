export interface CachedCoverPayload {
  dataUrl: string;
  sourceUrl: string;
  updatedAt: string;
  expiresAt?: string;
  mimeType?: string;
  bytes?: number;
}
