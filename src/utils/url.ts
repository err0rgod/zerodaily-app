/**
 * Utility to extract clean, readable publisher domain from source URLs.
 * e.g., 'https://www.tomshardware.com/news/...' -> 'tomshardware.com'
 */
export function extractDomain(url?: string): string {
  if (!url || typeof url !== 'string') return 'Source';

  try {
    const parsed = new URL(url);
    let host = parsed.hostname;
    if (host.startsWith('www.')) {
      host = host.slice(4);
    }
    return host || 'Source';
  } catch {
    // Regex fallback if URL constructor fails on unconventional schemes
    const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/\?#]+)/i);
    return match ? match[1] : 'Source';
  }
}

/** Estimate reading time in minutes (or seconds if short) */
export function getReadingEstimate(text: string): string {
  if (!text) return '1 min read';
  const words = text.trim().split(/\s+/).length;
  if (words < 120) {
    return '60s read';
  }
  const mins = Math.ceil(words / 150);
  return `${mins} min read`;
}
