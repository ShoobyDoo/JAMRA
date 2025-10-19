export function resolveIcon(icon?: string | null): string | undefined {
  const trimmed = icon?.trim();
  if (!trimmed) return undefined;
  return trimmed;
}
