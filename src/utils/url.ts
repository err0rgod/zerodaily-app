/**
 * Utility to extract clean, readable publisher domain from source URLs.
 * e.g., 'https://www.tomshardware.com/news/...' -> 'tomshardware.com'
 */
export function extractDomain(url?: string): string {
  if (!url || typeof url !== 'string') return 'Source';

  try {
    const trimmed = url.trim();
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    let host = parsed.hostname.toLowerCase();

    // Strip common leading subdomains
    if (host.startsWith('www.')) {
      host = host.slice(4);
    }
    if (host.startsWith('m.')) {
      host = host.slice(2);
    }
    if (host.startsWith('amp.')) {
      host = host.slice(4);
    }

    // Clean up verbose nested portals (e.g. Economic Times, Times of India)
    if (host.includes('economictimes')) {
      return 'economictimes.com';
    }
    if (host.includes('timesofindia')) {
      return 'timesofindia.com';
    }

    return host || 'Source';
  } catch {
    // Regex fallback if URL constructor fails on unconventional schemes
    const match = url.trim().match(/^(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:amp\.)?([^\/\?#]+)/i);
    let host = match ? match[1].toLowerCase() : 'Source';
    if (host.includes('economictimes')) {
      return 'economictimes.com';
    }
    if (host.includes('timesofindia')) {
      return 'timesofindia.com';
    }
    return host;
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
