/**
 * Truncates text at maxLength and appends "..." if exceeded.
 */
export function truncateWithEllipsis(text: string | null | undefined, maxLength: number): string {
  if (!text) return '';
  if (maxLength < 4) return text;
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Extracts initials from a full name (first + last).
 */
export function extractInitials(fullName: string | null | undefined): string {
  if (!fullName || !fullName.trim()) return '?';
  const words = fullName.trim().split(/\s+/);
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Strips non-alphanumeric characters except spaces and hyphens,
 * collapses multiple spaces, and trims.
 */
export function sanitizeSearchQuery(input: string | null | undefined): string {
  if (!input) return '';
  const cleaned = input.replace(/[^a-zA-Z0-9\s\u00C0-\u024F\u1E00-\u1EFF-]/g, '');
  return cleaned.replace(/\s+/g, ' ').trim();
}

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;'
};

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
}

/**
 * Wraps matching substring in <mark> tags (case-insensitive).
 * Escapes HTML in both text and query to prevent XSS.
 */
export function highlightMatch(text: string | null | undefined, query: string | null | undefined): string {
  if (!text) return '';
  const escaped = escapeHtml(text);
  if (!query) return escaped;

  const escapedQuery = escapeHtml(query);
  if (!escapedQuery) return escaped;

  const regex = new RegExp(escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return escaped.replace(regex, (match) => `<mark>${match}</mark>`);
}
