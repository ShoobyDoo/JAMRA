export function isHttpUrl(url: string | undefined): boolean {
  if (!url) return false;
  return /^https?:\/\//i.test(url);
}

export function isAlreadyProxied(url: string | undefined): boolean {
  if (!url) return false;
  return url.startsWith("/api/covers?src=");
}

export function buildImageProxyUrl(source: string): string {
  const encoded = encodeURIComponent(source);
  return `/api/covers?src=${encoded}`;
}

export function resolveImageSource(rawSrc: string): string {
  if (!isHttpUrl(rawSrc) || isAlreadyProxied(rawSrc)) {
    return rawSrc;
  }
  return buildImageProxyUrl(rawSrc);
}
