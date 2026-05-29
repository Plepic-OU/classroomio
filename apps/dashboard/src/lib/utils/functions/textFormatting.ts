const ELLIPSIS = '…';
const MIN_TRUNCATE_LENGTH = 4;

export function truncateWithEllipsis(
  text: string | null | undefined,
  maxLength: number
): string {
  if (text === null || text === undefined) {
    return '';
  }

  if (!Number.isFinite(maxLength) || maxLength < MIN_TRUNCATE_LENGTH) {
    throw new Error(
      `truncateWithEllipsis: maxLength must be a finite number >= ${MIN_TRUNCATE_LENGTH}`
    );
  }

  const chars = Array.from(text);
  if (chars.length <= maxLength) {
    return text;
  }

  return chars.slice(0, maxLength - 1).join('') + ELLIPSIS;
}

export function extractInitials(fullName: string | null | undefined): string {
  if (fullName === null || fullName === undefined) {
    return '?';
  }

  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return '?';
  }

  if (parts.length === 1) {
    return firstChar(parts[0]).toUpperCase();
  }

  const first = firstChar(parts[0]);
  const last = firstChar(parts[parts.length - 1]);
  return (first + last).toUpperCase();
}

function firstChar(value: string): string {
  return Array.from(value)[0] ?? '';
}

export function sanitizeSearchQuery(input: string | null | undefined): string {
  if (input === null || input === undefined) {
    return '';
  }

  const cleaned = input.replace(/[^\p{L}\p{N}\s-]/gu, '');
  const collapsed = cleaned.replace(/\s+/g, ' ').trim();
  return collapsed;
}

export function highlightMatch(
  text: string | null | undefined,
  query: string | null | undefined
): string {
  if (text === null || text === undefined) {
    return '';
  }

  const escapedText = escapeHtml(text);

  if (query === null || query === undefined || query === '') {
    return escapedText;
  }

  const escapedQuery = escapeHtml(query);
  const pattern = new RegExp(escapeRegExp(escapedQuery), 'gi');
  return escapedText.replace(pattern, (match) => `<mark>${match}</mark>`);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
