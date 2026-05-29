import {
	truncateWithEllipsis,
	extractInitials,
	sanitizeSearchQuery,
	highlightMatch
} from './textFormatting';

describe('truncateWithEllipsis', () => {
	it('returns empty string for null', () => {
		expect(truncateWithEllipsis(null, 10)).toBe('');
	});

	it('returns empty string for undefined', () => {
		expect(truncateWithEllipsis(undefined, 10)).toBe('');
	});

	it('returns empty string for empty input', () => {
		expect(truncateWithEllipsis('', 10)).toBe('');
	});

	it('returns original text if within limit', () => {
		expect(truncateWithEllipsis('Hello', 10)).toBe('Hello');
	});

	it('returns original text if exactly at limit', () => {
		expect(truncateWithEllipsis('Hello', 5)).toBe('Hello');
	});

	it('truncates text longer than maxLength and appends ellipsis', () => {
		expect(truncateWithEllipsis('Hello World', 8)).toBe('Hello...');
	});

	it('returns original text if maxLength is less than 4', () => {
		expect(truncateWithEllipsis('Hello World', 3)).toBe('Hello World');
	});

	it('truncates text if maxLength is exactly 4', () => {
		expect(truncateWithEllipsis('Hello World', 4)).toBe('H...');
	});

	it('handles very long strings', () => {
		const longString = 'a'.repeat(1000);
		expect(truncateWithEllipsis(longString, 50)).toBe('a'.repeat(47) + '...');
	});

	it('truncates at correct position for maxLength=4', () => {
		expect(truncateWithEllipsis('abcdef', 4)).toBe('a...');
	});

	it('handles whitespace correctly', () => {
		expect(truncateWithEllipsis('Hello World', 7)).toBe('Hell...');
	});
});

describe('extractInitials', () => {
	it('returns "?" for empty string', () => {
		expect(extractInitials('')).toBe('?');
	});

	it('returns "?" for null-like input (whitespace only)', () => {
		expect(extractInitials('   ')).toBe('?');
	});

	it('extracts single initial for one word', () => {
		expect(extractInitials('Alice')).toBe('A');
	});

	it('extracts first and last initials for two words', () => {
		expect(extractInitials('John Doe')).toBe('JD');
	});

	it('extracts first and last initials ignoring middle names', () => {
		expect(extractInitials('Mary Jane Watson')).toBe('MW');
	});

	it('handles multiple spaces between words', () => {
		expect(extractInitials('John    Doe')).toBe('JD');
	});

	it('converts lowercase to uppercase', () => {
		expect(extractInitials('john doe')).toBe('JD');
	});

	it('handles mixed case', () => {
		expect(extractInitials('jOhN dOe')).toBe('JD');
	});

	it('handles leading and trailing whitespace', () => {
		expect(extractInitials('  John Doe  ')).toBe('JD');
	});

	it('handles single letter names', () => {
		expect(extractInitials('A B')).toBe('AB');
	});

	it('handles unicode characters', () => {
		expect(extractInitials('José García')).toBe('JG');
	});
});

describe('sanitizeSearchQuery', () => {
	it('returns empty string for empty input', () => {
		expect(sanitizeSearchQuery('')).toBe('');
	});

	it('returns empty string for null-like input', () => {
		expect(sanitizeSearchQuery('   ')).toBe('');
	});

	it('strips special characters', () => {
		expect(sanitizeSearchQuery('hello@world!')).toBe('helloworld');
	});

	it('preserves alphanumeric characters', () => {
		expect(sanitizeSearchQuery('hello123world')).toBe('hello123world');
	});

	it('preserves spaces', () => {
		expect(sanitizeSearchQuery('hello world')).toBe('hello world');
	});

	it('preserves hyphens', () => {
		expect(sanitizeSearchQuery('hello-world')).toBe('hello-world');
	});

	it('collapses multiple spaces', () => {
		expect(sanitizeSearchQuery('hello    world')).toBe('hello world');
	});

	it('strips special characters and collapses spaces', () => {
		expect(sanitizeSearchQuery('hello   @@@   world!!!')).toBe('hello world');
	});

	it('returns empty string for input with only special characters', () => {
		expect(sanitizeSearchQuery('!@#$%^&*()')).toBe('');
	});

	it('trims result', () => {
		expect(sanitizeSearchQuery('  hello world  ')).toBe('hello world');
	});

	it('handles underscore as alphanumeric', () => {
		expect(sanitizeSearchQuery('hello_world')).toBe('hello_world');
	});

	it('removes tabs and newlines', () => {
		expect(sanitizeSearchQuery('hello\t\nworld')).toBe('hello world');
	});

	it('handles XSS attempts by stripping tags', () => {
		expect(sanitizeSearchQuery('<script>alert("xss")</script>')).toBe('scriptalertxssscript');
	});
});

describe('highlightMatch', () => {
	it('returns escaped text for empty query', () => {
		expect(highlightMatch('Hello World', '')).toBe('Hello World');
	});

	it('returns escaped text for null query', () => {
		expect(highlightMatch('Hello World', null as any)).toBe('Hello World');
	});

	it('returns empty string for empty text', () => {
		expect(highlightMatch('', 'query')).toBe('');
	});

	it('wraps matching substring in mark tags', () => {
		expect(highlightMatch('Hello World', 'World')).toBe('Hello <mark>World</mark>');
	});

	it('matches case-insensitively', () => {
		expect(highlightMatch('Hello World', 'world')).toBe('Hello <mark>World</mark>');
	});

	it('matches case-insensitively with different case', () => {
		expect(highlightMatch('hello world', 'WORLD')).toBe('hello <mark>world</mark>');
	});

	it('highlights all occurrences', () => {
		expect(highlightMatch('banana', 'an')).toBe('b<mark>an</mark><mark>an</mark>a');
	});

	it('escapes HTML in text before highlighting', () => {
		const result = highlightMatch('<script>alert("xss")</script>', 'script');
		expect(result).toContain('&lt;');
		expect(result).toContain('&gt;');
		expect(result).toContain('<mark>');
		expect(result).not.toContain('<script>');
	});

	it('escapes HTML special characters in query', () => {
		const result = highlightMatch('Hello <b>World</b>', '<b>');
		expect(result).not.toContain('<b>');
		expect(result).toContain('&lt;b&gt;');
	});

	it('handles partial matches', () => {
		expect(highlightMatch('Hello World', 'Wor')).toBe('Hello <mark>Wor</mark>ld');
	});

	it('handles query with special characters', () => {
		const result = highlightMatch('Price: $100', '$');
		expect(result).toContain('<mark>');
		expect(result).not.toContain('<script>');
	});

	it('handles very long text', () => {
		const longText = 'a'.repeat(1000);
		const result = highlightMatch(longText, 'a');
		const markCount = (result.match(/<mark>/g) || []).length;
		expect(markCount).toBeGreaterThan(500);
	});

	it('preserves text outside matches', () => {
		const result = highlightMatch('Hello World', 'lo');
		expect(result).toContain('Hel');
		expect(result).toContain(' Wor');
	});
});
