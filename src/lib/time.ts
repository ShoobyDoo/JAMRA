export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp);
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    const label = diffMinutes === 1 ? "minute" : "minutes";
    return `${diffMinutes} ${label} ago`;
  }

  if (diffHours < 24) {
    const label = diffHours === 1 ? "hour" : "hours";
    return `${diffHours} ${label} ago`;
  }

  if (diffDays < 7) {
    const label = diffDays === 1 ? "day" : "days";
    return `${diffDays} ${label} ago`;
  }

  return new Date(timestamp).toLocaleDateString();
}
