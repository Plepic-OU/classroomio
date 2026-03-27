/**
 * Truncates text at maxLength and appends "..." if exceeded.
 * Returns original text if within limit.
 * Returns empty string for empty/null/undefined input.
 * maxLength must be at least 4 (room for 1 char + "..."), otherwise returns as-is.
 */
export function truncateWithEllipsis(text: string | null | undefined, maxLength: number): string {
  if (text == null || text === '') return '';
  if (maxLength < 4) return text;
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Extracts initials from a full name.
 * "John Doe" → "JD", "Alice" → "A", "Mary Jane Watson" → "MW" (first + last).
 * Returns "?" for empty input.
 */
export function extractInitials(fullName: string | null | undefined): string {
  if (fullName == null) return '?';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Strips non-alphanumeric characters except spaces and hyphens.
 * Collapses multiple spaces and trims.
 * Returns empty string for input that's only special characters.
 */
export function sanitizeSearchQuery(input: string | null | undefined): string {
  if (input == null) return '';
  return input
    .replace(/[^a-zA-Z0-9\s\u00C0-\u024F\u1E00-\u1EFF-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Wraps matching substring in <mark> tags (case-insensitive).
 * Escapes HTML in text before inserting <mark> tags to prevent XSS.
 */
export function highlightMatch(text: string | null | undefined, query: string): string {
  if (text == null || text === '') return '';
  if (!query) return escapeHtml(text);

  const escaped = escapeHtml(text);
  const escapedQuery = escapeHtml(query);

  const regex = new RegExp(
    escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    'gi'
  );

  return escaped.replace(regex, (match) => `<mark>${match}</mark>`);
}
