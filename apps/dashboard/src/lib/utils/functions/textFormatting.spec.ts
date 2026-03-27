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

  test('truncates and appends ellipsis when exceeded', () => {
    expect(truncateWithEllipsis('Hello World', 8)).toBe('Hello...');
  });

  test('returns original text when exactly at limit', () => {
    expect(truncateWithEllipsis('Hello', 5)).toBe('Hello');
  });

  test('returns empty string for empty input', () => {
    expect(truncateWithEllipsis('', 10)).toBe('');
  });

  test('returns empty string for null input', () => {
    expect(truncateWithEllipsis(null as unknown as string, 10)).toBe('');
  });

  test('returns empty string for undefined input', () => {
    expect(truncateWithEllipsis(undefined as unknown as string, 10)).toBe('');
  });

  test('returns as-is when maxLength is less than 4', () => {
    expect(truncateWithEllipsis('Hello World', 3)).toBe('Hello World');
  });

  test('returns as-is when maxLength is exactly 4', () => {
    expect(truncateWithEllipsis('Hello', 4)).toBe('H...');
  });

  test('handles very long strings', () => {
    const long = 'a'.repeat(1000);
    const result = truncateWithEllipsis(long, 10);
    expect(result).toBe('a'.repeat(7) + '...');
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

  test('returns first and last initial for three-word name', () => {
    expect(extractInitials('Mary Jane Watson')).toBe('MW');
  });

  test('returns "?" for empty string', () => {
    expect(extractInitials('')).toBe('?');
  });

  test('returns "?" for null input', () => {
    expect(extractInitials(null as unknown as string)).toBe('?');
  });

  test('returns "?" for undefined input', () => {
    expect(extractInitials(undefined as unknown as string)).toBe('?');
  });

  test('handles multiple spaces between words', () => {
    expect(extractInitials('John   Doe')).toBe('JD');
  });

  test('handles leading and trailing spaces', () => {
    expect(extractInitials('  John Doe  ')).toBe('JD');
  });

  test('uppercases initials', () => {
    expect(extractInitials('john doe')).toBe('JD');
  });

  test('handles unicode names', () => {
    expect(extractInitials('Ångström Öberg')).toBe('ÅÖ'.toUpperCase());
  });
});

describe('sanitizeSearchQuery', () => {
  test('strips non-alphanumeric characters except spaces and hyphens', () => {
    expect(sanitizeSearchQuery('hello@world!')).toBe('helloworld');
  });

  test('preserves hyphens', () => {
    expect(sanitizeSearchQuery('well-known')).toBe('well-known');
  });

  test('preserves spaces', () => {
    expect(sanitizeSearchQuery('hello world')).toBe('hello world');
  });

  test('collapses multiple spaces', () => {
    expect(sanitizeSearchQuery('hello   world')).toBe('hello world');
  });

  test('trims leading and trailing spaces', () => {
    expect(sanitizeSearchQuery('  hello  ')).toBe('hello');
  });

  test('returns empty string for empty input', () => {
    expect(sanitizeSearchQuery('')).toBe('');
  });

  test('returns empty string for input with only special characters', () => {
    expect(sanitizeSearchQuery('!@#$%^&*()')).toBe('');
  });

  test('handles XSS input', () => {
    expect(sanitizeSearchQuery("<script>alert('x')</script>")).toBe('scriptalertxscript');
  });

  test('handles unicode input', () => {
    expect(sanitizeSearchQuery('café résumé')).toBe('caf rsum');
  });

  test('returns empty string for null input', () => {
    expect(sanitizeSearchQuery(null as unknown as string)).toBe('');
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

  test('escapes HTML in text to prevent XSS', () => {
    expect(highlightMatch("<script>alert('x')</script>", 'alert')).toBe(
      "&lt;script&gt;<mark>alert</mark>(&#39;x&#39;)&lt;/script&gt;"
    );
  });

  test('escapes HTML special characters in text', () => {
    expect(highlightMatch('a & b', 'b')).toBe('a &amp; <mark>b</mark>');
  });

  test('handles query that is not found in text', () => {
    expect(highlightMatch('Hello World', 'xyz')).toBe('Hello World');
  });

  test('handles multiple matches', () => {
    expect(highlightMatch('abab', 'a')).toBe('<mark>a</mark>b<mark>a</mark>b');
  });

  test('handles XSS in query', () => {
    const result = highlightMatch('Hello <b>World</b>', '<b>');
    expect(result).not.toContain('<b>');
    expect(result).toContain('&lt;b&gt;');
  });

  test('handles unicode text and query', () => {
    expect(highlightMatch('こんにちは世界', '世界')).toBe('こんにちは<mark>世界</mark>');
  });

  test('handles very long strings', () => {
    const text = 'a'.repeat(1000) + 'needle' + 'a'.repeat(1000);
    const result = highlightMatch(text, 'needle');
    expect(result).toContain('<mark>needle</mark>');
  });

  test('handles whitespace-only query', () => {
    const result = highlightMatch('hello world', ' ');
    expect(result).toBe('hello<mark> </mark>world');
  });
});
