/**
 * Text formatting utilities for display, search and highlighting.
 */

/**
 * Escapes HTML special characters so user input is rendered as text, never markup.
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };

  return text.replace(/[&<>"'/]/g, (char) => map[char]);
}

/**
 * Truncates `text` to `maxLength` characters, appending `"..."` when the text
 * exceeds the limit. The resulting string (including the ellipsis) is at most
 * `maxLength` characters long.
 *
 * - Returns the original text when it is within the limit.
 * - Returns an empty string for empty/null/undefined input.
 * - `maxLength` must be at least 4 (room for 1 char + `"..."`); otherwise the
 *   text is returned unchanged.
 */
export function truncateWithEllipsis(text: string, maxLength: number): string {
  if (!text) return '';
  if (maxLength < 4) return text;

  // Split by code points so multi-byte characters (emoji, etc.) aren't cut in half.
  const chars = Array.from(text);
  if (chars.length <= maxLength) return text;

  return chars.slice(0, maxLength - 3).join('') + '...';
}

/**
 * Extracts up to two initials from a full name (first + last word).
 *
 * - `"John Doe"` → `"JD"`, `"Alice"` → `"A"`, `"Mary Jane Watson"` → `"MW"`.
 * - Returns `"?"` for empty input.
 * - Handles multiple spaces between words.
 */
export function extractInitials(fullName: string): string {
  if (!fullName || fullName.trim().length === 0) return '?';

  const words = fullName.trim().split(/\s+/);
  const firstChar = (word: string): string => Array.from(word)[0] ?? '';

  const first = firstChar(words[0]);
  const last = words.length > 1 ? firstChar(words[words.length - 1]) : '';

  return (first + last).toUpperCase();
}

/**
 * Sanitizes a free-text search query.
 *
 * - Strips characters that are not letters, numbers, spaces or hyphens.
 * - Collapses runs of whitespace into a single space and trims the result.
 * - Returns an empty string when the input contains only special characters.
 */
export function sanitizeSearchQuery(input: string): string {
  if (!input) return '';

  return input
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Wraps every case-insensitive occurrence of `query` within `text` in `<mark>`
 * tags. The text is HTML-escaped before the tags are inserted so that any
 * markup in the input cannot execute (XSS-safe).
 *
 * - `"Hello World", "world"` → `"Hello <mark>World</mark>"`.
 * - Returns an empty string for empty/null/undefined text.
 * - Returns the escaped text unchanged when the query is empty.
 */
export function highlightMatch(text: string, query: string): string {
  if (!text) return '';

  const escapedText = escapeHtml(text);
  if (!query || query.trim().length === 0) return escapedText;

  // Escape the query for HTML (so it matches the escaped text) and for regex.
  const escapedQuery = escapeHtml(query);
  const pattern = escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${pattern})`, 'gi');

  return escapedText.replace(regex, '<mark>$1</mark>');
}
