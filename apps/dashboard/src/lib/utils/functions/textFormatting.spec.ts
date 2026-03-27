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

  it('returns original text if within limit', () => {
    expect(truncateWithEllipsis('Hello', 10)).toBe('Hello');
  });

  it('returns original text if exactly at limit', () => {
    expect(truncateWithEllipsis('Hello', 5)).toBe('Hello');
  });

  it('truncates and appends ellipsis when exceeding limit', () => {
    expect(truncateWithEllipsis('Hello World', 8)).toBe('Hello...');
  });

  it('returns as-is when maxLength < 4', () => {
    expect(truncateWithEllipsis('Hello', 3)).toBe('Hello');
  });

  it('returns as-is when maxLength is 0', () => {
    expect(truncateWithEllipsis('Hello', 0)).toBe('Hello');
  });

  it('handles very long strings', () => {
    const long = 'a'.repeat(1000);
    const result = truncateWithEllipsis(long, 10);
    expect(result).toBe('aaaaaaa...');
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

  it('returns single initial for one name', () => {
    expect(extractInitials('Alice')).toBe('A');
  });

  it('returns first and last initials for two names', () => {
    expect(extractInitials('John Doe')).toBe('JD');
  });

  it('returns first and last initials for three names', () => {
    expect(extractInitials('Mary Jane Watson')).toBe('MW');
  });

  it('handles multiple spaces between words', () => {
    expect(extractInitials('John   Doe')).toBe('JD');
  });

  it('handles leading and trailing spaces', () => {
    expect(extractInitials('  John Doe  ')).toBe('JD');
  });

  it('handles unicode names', () => {
    expect(extractInitials('André García')).toBe('AG');
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

  it('returns empty string for only special characters', () => {
    expect(sanitizeSearchQuery('!@#$%^&*()')).toBe('');
  });

  it('strips special characters', () => {
    expect(sanitizeSearchQuery('hello!')).toBe('hello');
  });

  it('keeps alphanumeric, spaces, and hyphens', () => {
    expect(sanitizeSearchQuery('hello world-test')).toBe('hello world-test');
  });

  it('collapses multiple spaces', () => {
    expect(sanitizeSearchQuery('hello   world')).toBe('hello world');
  });

  it('trims leading and trailing spaces', () => {
    expect(sanitizeSearchQuery('  hello  ')).toBe('hello');
  });

  it('strips XSS input', () => {
    expect(sanitizeSearchQuery("<script>alert('x')</script>")).toBe('scriptalertxscript');
  });

  it('handles unicode input', () => {
    expect(sanitizeSearchQuery('café résumé')).toBe('caf rsum');
  });
});

describe('highlightMatch', () => {
  it('wraps matching substring in mark tags', () => {
    expect(highlightMatch('Hello World', 'world')).toBe('Hello <mark>World</mark>');
  });

  it('is case-insensitive', () => {
    expect(highlightMatch('Hello World', 'HELLO')).toBe('<mark>Hello</mark> World');
  });

  it('returns escaped text when query is empty', () => {
    expect(highlightMatch('Hello', '')).toBe('Hello');
  });

  it('escapes HTML to prevent XSS', () => {
    const result = highlightMatch("<script>alert('x')</script>", 'alert');
    expect(result).toContain('&lt;script&gt;');
    expect(result).not.toContain('<script>');
  });

  it('escapes HTML in text before highlighting', () => {
    expect(highlightMatch('a < b & c', '<')).toBe('a <mark>&lt;</mark> b &amp; c');
  });

  it('handles match with HTML characters in query', () => {
    const result = highlightMatch('Hello <World>', 'World');
    expect(result).toBe('Hello &lt;<mark>World</mark>&gt;');
  });

  it('handles no match', () => {
    expect(highlightMatch('Hello World', 'xyz')).toBe('Hello World');
  });

  it('handles unicode text and query', () => {
    expect(highlightMatch('こんにちは世界', '世界')).toBe('こんにちは<mark>世界</mark>');
  });

  it('handles multiple matches', () => {
    expect(highlightMatch('aaa', 'a')).toBe('<mark>a</mark><mark>a</mark><mark>a</mark>');
  });

  it('handles XSS in query', () => {
    const result = highlightMatch('Hello World', '<script>');
    expect(result).not.toContain('<script>');
    expect(result).toBe('Hello World');
  });
});
