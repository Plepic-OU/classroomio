export function truncateWithEllipsis(text: string | null | undefined, maxLength: number): string {
	if (!text) {
		return '';
	}

	if (maxLength < 4) {
		return text;
	}

	if (text.length <= maxLength) {
		return text;
	}

	return text.slice(0, maxLength - 3) + '...';
}

export function extractInitials(fullName: string): string {
	if (!fullName || !fullName.trim()) {
		return '?';
	}

	const words = fullName.trim().split(/\s+/).filter((word) => word.length > 0);

	if (words.length === 0) {
		return '?';
	}

	if (words.length === 1) {
		return words[0][0].toUpperCase();
	}

	return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function sanitizeSearchQuery(input: string): string {
	if (!input) {
		return '';
	}

	const sanitized = input.replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ').trim();

	return sanitized;
}

export function highlightMatch(text: string, query: string): string {
	if (!text || !query) {
		return escapeHtml(text);
	}

	const escapedText = escapeHtml(text);
	const escapedQuery = escapeHtml(query);
	const regex = new RegExp(`(${escapedQuery})`, 'gi');

	return escapedText.replace(regex, '<mark>$1</mark>');
}

function escapeHtml(text: string): string {
	const htmlEntityMap: { [key: string]: string } = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;'
	};
	return text.replace(/[&<>"']/g, (char) => htmlEntityMap[char]);
}
