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

	it('returns empty string for empty string', () => {
		expect(truncateWithEllipsis('', 10)).toBe('');
	});

	it('returns text as-is when within limit', () => {
		expect(truncateWithEllipsis('Hello', 10)).toBe('Hello');
	});

	it('returns text as-is when exactly at limit', () => {
		expect(truncateWithEllipsis('Hello', 5)).toBe('Hello');
	});

	it('truncates and appends ellipsis when over limit', () => {
		expect(truncateWithEllipsis('Hello World', 8)).toBe('Hello...');
	});

	it('returns text as-is when maxLength < 4', () => {
		expect(truncateWithEllipsis('Hello', 3)).toBe('Hello');
	});

	it('returns text as-is when maxLength === 4', () => {
		expect(truncateWithEllipsis('Hi', 4)).toBe('Hi');
		expect(truncateWithEllipsis('Hello', 4)).toBe('H...');
	});

	it('handles very long strings', () => {
		const long = 'a'.repeat(1000);
		const result = truncateWithEllipsis(long, 10);
		expect(result).toBe('a'.repeat(7) + '...');
		expect(result.length).toBe(10);
	});

	it('handles unicode strings', () => {
		expect(truncateWithEllipsis('こんにちは世界', 5)).toBe('こん...');
	});
});

describe('extractInitials', () => {
	it('returns "?" for null', () => {
		expect(extractInitials(null)).toBe('?');
	});

	it('returns "?" for undefined', () => {
		expect(extractInitials(undefined)).toBe('?');
	});

	it('returns "?" for empty string', () => {
		expect(extractInitials('')).toBe('?');
	});

	it('returns "?" for whitespace-only string', () => {
		expect(extractInitials('   ')).toBe('?');
	});

	it('returns single initial for single name', () => {
		expect(extractInitials('Alice')).toBe('A');
	});

	it('returns first and last initials for two-word name', () => {
		expect(extractInitials('John Doe')).toBe('JD');
	});

	it('returns first and last initials for three-word name', () => {
		expect(extractInitials('Mary Jane Watson')).toBe('MW');
	});

	it('handles multiple spaces between words', () => {
		expect(extractInitials('John   Doe')).toBe('JD');
	});

	it('uppercases initials', () => {
		expect(extractInitials('john doe')).toBe('JD');
	});

	it('handles leading/trailing spaces', () => {
		expect(extractInitials('  John Doe  ')).toBe('JD');
	});
});

describe('sanitizeSearchQuery', () => {
	it('returns empty string for null', () => {
		expect(sanitizeSearchQuery(null)).toBe('');
	});

	it('returns empty string for undefined', () => {
		expect(sanitizeSearchQuery(undefined)).toBe('');
	});

	it('returns empty string for empty string', () => {
		expect(sanitizeSearchQuery('')).toBe('');
	});

	it('strips special characters', () => {
		expect(sanitizeSearchQuery('hello@world!')).toBe('helloworld');
	});

	it('keeps spaces and hyphens', () => {
		expect(sanitizeSearchQuery('hello world-test')).toBe('hello world-test');
	});

	it('collapses multiple spaces', () => {
		expect(sanitizeSearchQuery('hello   world')).toBe('hello world');
	});

	it('trims leading and trailing whitespace', () => {
		expect(sanitizeSearchQuery('  hello  ')).toBe('hello');
	});

	it('returns empty string for input that is only special characters', () => {
		expect(sanitizeSearchQuery('!@#$%^&*()')).toBe('');
	});

	it('handles XSS input', () => {
		expect(sanitizeSearchQuery("<script>alert('x')</script>")).toBe('scriptalertxscript');
	});

	it('handles unicode/non-alphanumeric input', () => {
		expect(sanitizeSearchQuery('café')).toBe('caf');
	});

	it('passes through normal alphanumeric input unchanged', () => {
		expect(sanitizeSearchQuery('hello123')).toBe('hello123');
	});
});

describe('highlightMatch', () => {
	it('wraps match in mark tags (case-insensitive)', () => {
		expect(highlightMatch('Hello World', 'world')).toBe('Hello <mark>World</mark>');
	});

	it('matches case-insensitively', () => {
		expect(highlightMatch('Hello World', 'HELLO')).toBe('<mark>Hello</mark> World');
	});

	it('returns HTML-escaped text when query is empty', () => {
		expect(highlightMatch('Hello', '')).toBe('Hello');
	});

	it('escapes HTML in text before highlighting (XSS prevention)', () => {
		expect(highlightMatch("<script>alert('x')</script>", 'alert')).toBe(
			'&lt;script&gt;<mark>alert</mark>(&#39;x&#39;)&lt;/script&gt;'
		);
	});

	it('escapes HTML entities in text', () => {
		// & in the source text is escaped to &amp; and the match is highlighted
		expect(highlightMatch('a & b', '&')).toBe('a <mark>&amp;</mark> b');
	});

	it('escapes < and > in text', () => {
		expect(highlightMatch('a < b > c', 'b')).toBe('a &lt; <mark>b</mark> &gt; c');
	});

	it('handles query that is not found', () => {
		expect(highlightMatch('Hello World', 'xyz')).toBe('Hello World');
	});

	it('handles unicode text', () => {
		expect(highlightMatch('こんにちは', 'にち')).toBe('こん<mark>にち</mark>は');
	});

	it('only highlights first match', () => {
		expect(highlightMatch('foo foo foo', 'foo')).toBe('<mark>foo</mark> foo foo');
	});

	it('handles query with regex special characters safely', () => {
		expect(highlightMatch('price: $5.00', '$5')).toBe('price: <mark>$5</mark>.00');
	});

	it('handles very long text', () => {
		const long = 'a'.repeat(500) + 'MATCH' + 'b'.repeat(500);
		const result = highlightMatch(long, 'match');
		expect(result).toContain('<mark>MATCH</mark>');
	});
});
