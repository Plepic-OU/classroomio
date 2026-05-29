import {
  truncateWithEllipsis,
  extractInitials,
  sanitizeSearchQuery,
  highlightMatch
} from './textFormatting';

describe('truncateWithEllipsis', () => {
  test('returns original text when within limit', () => {
    expect(truncateWithEllipsis('Hello', 10)).toBe('Hello');
  });

  test('returns original text when exactly at limit', () => {
    expect(truncateWithEllipsis('Hello', 5)).toBe('Hello');
  });

  test('truncates and appends ellipsis when exceeded', () => {
    expect(truncateWithEllipsis('Hello World', 8)).toBe('Hello...');
  });

  test('returns empty string for empty string', () => {
    expect(truncateWithEllipsis('', 10)).toBe('');
  });

  test('returns empty string for null', () => {
    expect(truncateWithEllipsis(null, 10)).toBe('');
  });

  test('returns empty string for undefined', () => {
    expect(truncateWithEllipsis(undefined, 10)).toBe('');
  });

  test('returns as-is when maxLength is less than 4', () => {
    expect(truncateWithEllipsis('Hello World', 3)).toBe('Hello World');
  });

  test('returns as-is when maxLength is exactly 4', () => {
    expect(truncateWithEllipsis('Hello World', 4)).toBe('H...');
  });

  test('handles very long strings', () => {
    const long = 'a'.repeat(1000);
    const result = truncateWithEllipsis(long, 10);
    expect(result).toBe('aaaaaaa...');
    expect(result.length).toBe(10);
  });

  test('handles unicode strings', () => {
    expect(truncateWithEllipsis('こんにちは世界', 5)).toBe('こん...');
  });
});

describe('extractInitials', () => {
  test('returns initials for two-word name', () => {
    expect(extractInitials('John Doe')).toBe('JD');
  });

  test('returns single initial for one-word name', () => {
    expect(extractInitials('Alice')).toBe('A');
  });

  test('returns first and last initials for multi-word name', () => {
    expect(extractInitials('Mary Jane Watson')).toBe('MW');
  });

  test('returns "?" for empty string', () => {
    expect(extractInitials('')).toBe('?');
  });

  test('returns "?" for null', () => {
    expect(extractInitials(null)).toBe('?');
  });

  test('returns "?" for undefined', () => {
    expect(extractInitials(undefined)).toBe('?');
  });

  test('handles multiple spaces between words', () => {
    expect(extractInitials('John   Doe')).toBe('JD');
  });

  test('handles leading/trailing spaces', () => {
    expect(extractInitials('  John Doe  ')).toBe('JD');
  });

  test('uppercases initials', () => {
    expect(extractInitials('john doe')).toBe('JD');
  });
});

describe('sanitizeSearchQuery', () => {
  test('strips special characters', () => {
    expect(sanitizeSearchQuery('hello@world!')).toBe('helloworld');
  });

  test('keeps alphanumeric, spaces, and hyphens', () => {
    expect(sanitizeSearchQuery('hello world-test')).toBe('hello world-test');
  });

  test('collapses multiple spaces', () => {
    expect(sanitizeSearchQuery('hello   world')).toBe('hello world');
  });

  test('trims leading and trailing spaces', () => {
    expect(sanitizeSearchQuery('  hello  ')).toBe('hello');
  });

  test('returns empty string for only special characters', () => {
    expect(sanitizeSearchQuery('@#$%^&*()')).toBe('');
  });

  test('returns empty string for empty input', () => {
    expect(sanitizeSearchQuery('')).toBe('');
  });

  test('returns empty string for null', () => {
    expect(sanitizeSearchQuery(null)).toBe('');
  });

  test('returns empty string for undefined', () => {
    expect(sanitizeSearchQuery(undefined)).toBe('');
  });

  test('handles XSS input', () => {
    expect(sanitizeSearchQuery("<script>alert('x')</script>")).toBe('scriptalertxscript');
  });
});

describe('highlightMatch', () => {
  test('wraps matching substring in mark tags', () => {
    expect(highlightMatch('Hello World', 'world')).toBe('Hello <mark>World</mark>');
  });

  test('is case-insensitive', () => {
    expect(highlightMatch('Hello World', 'HELLO')).toBe('<mark>Hello</mark> World');
  });

  test('returns escaped text when query is empty', () => {
    expect(highlightMatch('Hello World', '')).toBe('Hello World');
  });

  test('escapes HTML before inserting mark tags', () => {
    expect(highlightMatch('<b>Hello</b>', 'Hello')).toBe('&lt;b&gt;<mark>Hello</mark>&lt;/b&gt;');
  });

  test('prevents XSS — script tag in text is escaped', () => {
    const result = highlightMatch("<script>alert('x')</script>", 'alert');
    expect(result).not.toContain('<script>');
    expect(result).toContain('<mark>alert</mark>');
  });

  test('handles no match', () => {
    expect(highlightMatch('Hello World', 'xyz')).toBe('Hello World');
  });

  test('handles unicode match', () => {
    expect(highlightMatch('こんにちは世界', 'にちは')).toBe('こん<mark>にちは</mark>世界');
  });

  test('escapes ampersands in text', () => {
    expect(highlightMatch('Tom & Jerry', 'Jerry')).toBe('Tom &amp; <mark>Jerry</mark>');
  });
});
