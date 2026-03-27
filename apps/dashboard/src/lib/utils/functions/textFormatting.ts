export function truncateWithEllipsis(text: string, maxLength: number): string {
  if (!text) return '';
  if (maxLength < 4) return text;
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export function extractInitials(fullName: string): string {
  if (!fullName || !fullName.trim()) return '?';
  const words = fullName.trim().split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function sanitizeSearchQuery(input: string): string {
  if (!input) return '';
  const stripped = input.replace(/[^a-zA-Z0-9 -]/g, '');
  const collapsed = stripped.replace(/\s+/g, ' ').trim();
  return collapsed;
}

export function highlightMatch(text: string, query: string): string {
  if (!query) return escapeHtml(text);
  const escapedText = escapeHtml(text);
  const escapedQuery = escapeHtml(query);
  const regex = new RegExp(escapeRegex(escapedQuery), 'gi');
  return escapedText.replace(regex, (match) => `<mark>${match}</mark>`);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
