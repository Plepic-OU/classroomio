export function truncateWithEllipsis(text: string | null | undefined, maxLength: number): string {
  if (text == null) return '';
  if (maxLength < 4) throw new Error('maxLength must be >= 4');
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export function extractInitials(fullName: string | null | undefined): string {
  if (!fullName || !fullName.trim()) return '?';
  return fullName
    .trim()
    .split(/\s+/)
    .map((word) => word[0].toUpperCase())
    .join('');
}

export function sanitizeSearchQuery(input: string | null | undefined): string {
  if (input == null) return '';
  const cleaned = input.replace(/[^a-zA-Z0-9 \-]/g, '').replace(/\s+/g, ' ').trim();
  return cleaned;
}

export function highlightMatch(text: string, query: string): string {
  if (!query) return escapeHtml(text);
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return escapeHtml(text).replace(regex, '<mark>$1</mark>');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
