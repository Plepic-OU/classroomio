import {
  truncateWithEllipsis,
  extractInitials,
  sanitizeSearchQuery,
  highlightMatch
} from './textFormatting';

describe('truncateWithEllipsis', () => {
  it('returns original text when within limit', () => {
    expect(truncateWithEllipsis('Hello', 10)).toBe('Hello');
  });

  it('returns original text when exactly at limit', () => {
    expect(truncateWithEllipsis('Hello', 5)).toBe('Hello');
  });

  it('truncates and appends ellipsis when exceeded', () => {
    expect(truncateWithEllipsis('Hello World', 8)).toBe('Hello...');
  });

  it('returns empty string for empty input', () => {
    expect(truncateWithEllipsis('', 10)).toBe('');
  });

  it('returns empty string for null input', () => {
    expect(truncateWithEllipsis(null, 10)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(truncateWithEllipsis(undefined, 10)).toBe('');
  });

  it('returns text as-is when maxLength < 4', () => {
    expect(truncateWithEllipsis('Hello World', 3)).toBe('Hello World');
    expect(truncateWithEllipsis('Hello World', 1)).toBe('Hello World');
  });

  it('handles exactly maxLength === 4', () => {
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
  it('returns first and last initials for two-word name', () => {
    expect(extractInitials('John Doe')).toBe('JD');
  });

  it('returns single initial for one-word name', () => {
    expect(extractInitials('Alice')).toBe('A');
  });

  it('returns first and last initials for multi-word name', () => {
    expect(extractInitials('Mary Jane Watson')).toBe('MW');
  });

  it('returns "?" for empty string', () => {
    expect(extractInitials('')).toBe('?');
  });

  it('returns "?" for null', () => {
    expect(extractInitials(null)).toBe('?');
  });

  it('returns "?" for undefined', () => {
    expect(extractInitials(undefined)).toBe('?');
  });

  it('returns "?" for whitespace-only string', () => {
    expect(extractInitials('   ')).toBe('?');
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
  it('strips special characters', () => {
    expect(sanitizeSearchQuery('hello@world!')).toBe('helloworld');
  });

  it('keeps spaces and hyphens', () => {
    expect(sanitizeSearchQuery('hello world-foo')).toBe('hello world-foo');
  });

  it('collapses multiple spaces', () => {
    expect(sanitizeSearchQuery('hello   world')).toBe('hello world');
  });

  it('trims leading and trailing spaces', () => {
    expect(sanitizeSearchQuery('  hello world  ')).toBe('hello world');
  });

  it('returns empty string for only special characters', () => {
    expect(sanitizeSearchQuery('@#$%^&*()')).toBe('');
  });

  it('returns empty string for null', () => {
    expect(sanitizeSearchQuery(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(sanitizeSearchQuery(undefined)).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeSearchQuery('')).toBe('');
  });

  it('handles alphanumeric input unchanged', () => {
    expect(sanitizeSearchQuery('abc123')).toBe('abc123');
  });

  it('strips XSS attempts', () => {
    expect(sanitizeSearchQuery("<script>alert('x')</script>")).toBe('scriptalertxscript');
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
    expect(highlightMatch('Hello World', '')).toBe('Hello World');
  });

  it('returns empty string when text is empty', () => {
    expect(highlightMatch('', 'world')).toBe('');
  });

  it('escapes HTML before inserting mark tags', () => {
    const result = highlightMatch('<div>Hello</div>', 'Hello');
    expect(result).toBe('&lt;div&gt;<mark>Hello</mark>&lt;/div&gt;');
  });

  it('prevents XSS in text input', () => {
    const xss = "<script>alert('x')</script>";
    const result = highlightMatch(xss, 'script');
    expect(result).not.toContain('<script>');
    expect(result).toContain('<mark>script</mark>');
  });

  it('prevents XSS in query input', () => {
    const result = highlightMatch('hello world', '<img src=x onerror=alert(1)>');
    expect(result).toBe('hello world');
  });

  it('handles unicode text', () => {
    expect(highlightMatch('こんにちは世界', '世界')).toBe('こんにちは<mark>世界</mark>');
  });

  it('highlights all occurrences', () => {
    expect(highlightMatch('foo bar foo', 'foo')).toBe('<mark>foo</mark> bar <mark>foo</mark>');
  });

  it('handles very long strings', () => {
    const long = 'a'.repeat(500) + 'target' + 'a'.repeat(500);
    const result = highlightMatch(long, 'target');
    expect(result).toContain('<mark>target</mark>');
  });
});
