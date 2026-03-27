/**
 * Truncates text to maxLength and appends "..." if exceeded.
 * Returns empty string for empty/null/undefined input.
 * Returns text as-is if maxLength < 4.
 */
export function truncateWithEllipsis(text: string | null | undefined, maxLength: number): string {
	if (text == null || text === '') return '';
	if (maxLength < 4) return text;
	if (text.length <= maxLength) return text;
	return text.slice(0, maxLength - 3) + '...';
}

/**
 * Extracts initials from a full name (first + last word only).
 * Returns "?" for empty input.
 */
export function extractInitials(fullName: string | null | undefined): string {
	if (!fullName || fullName.trim() === '') return '?';
	const words = fullName.trim().split(/\s+/);
	if (words.length === 1) return words[0][0].toUpperCase();
	return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Strips non-alphanumeric characters except spaces and hyphens,
 * collapses multiple spaces, and trims.
 * Returns empty string if nothing remains.
 */
export function sanitizeSearchQuery(input: string | null | undefined): string {
	if (input == null) return '';
	const cleaned = input.replace(/[^a-zA-Z0-9 -]/g, '').replace(/\s+/g, ' ').trim();
	return cleaned;
}

/**
 * Wraps the first case-insensitive match of query in <mark> tags.
 * HTML-escapes the text before inserting tags to prevent XSS.
 */
export function highlightMatch(text: string, query: string): string {
	if (!query) return escapeHtml(text);

	const escaped = escapeHtml(text);
	const escapedQuery = escapeHtml(query);
	const regex = new RegExp(escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
	return escaped.replace(regex, (match) => `<mark>${match}</mark>`);
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}
