import { request } from "./client";

export interface CacheSettings {
  enabled: boolean;
  ttlMs: number;
  maxEntries: number;
  fetchTimeoutMs?: number;
}

export interface UpdateCacheSettingsPayload {
  enabled?: boolean;
  ttlMs?: number;
  ttlDays?: number;
  maxEntries?: number;
  fetchTimeoutMs?: number;
}

export async function fetchCacheSettings(): Promise<CacheSettings> {
  const response = await request<{ settings: CacheSettings }>(
    "/system/cache-settings",
  );
  return response.settings;
}

export async function updateCacheSettings(
  payload: UpdateCacheSettingsPayload,
): Promise<CacheSettings> {
  const response = await request<{ settings: CacheSettings }>(
    "/system/cache-settings",
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
  return response.settings;
}
