export function truncateWithEllipsis(text: string | null | undefined, maxLength: number): string {
  if (!text) return '';
  if (maxLength < 4) return text;
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export function extractInitials(fullName: string | null | undefined): string {
  if (!fullName || !fullName.trim()) return '?';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function sanitizeSearchQuery(input: string | null | undefined): string {
  if (!input) return '';
  const cleaned = input.replace(/[^a-zA-Z0-9 \-]/g, '').replace(/\s+/g, ' ').trim();
  return cleaned;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function highlightMatch(text: string, query: string): string {
  if (!query) return escapeHtml(text);
  const escapedText = escapeHtml(text);
  const escapedQuery = escapeHtml(query);
  const regex = new RegExp(escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return escapedText.replace(regex, (match) => `<mark>${match}</mark>`);
}
