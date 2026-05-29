import {
  truncateWithEllipsis,
  extractInitials,
  sanitizeSearchQuery,
  highlightMatch
} from './textFormatting';

describe('truncateWithEllipsis', () => {
  test('returns text unchanged when within maxLength', () => {
    expect(truncateWithEllipsis('hello', 10)).toBe('hello');
  });

  test('truncates and appends ellipsis when over maxLength', () => {
    expect(truncateWithEllipsis('Hello World', 8)).toBe('Hello...');
  });

  test('returns text unchanged when exactly maxLength', () => {
    expect(truncateWithEllipsis('abcd', 4)).toBe('abcd');
  });

  test('returns empty string for null', () => {
    expect(truncateWithEllipsis(null, 10)).toBe('');
  });

  test('returns empty string for undefined', () => {
    expect(truncateWithEllipsis(undefined, 10)).toBe('');
  });

  test('throws when maxLength < 4', () => {
    expect(() => truncateWithEllipsis('hello', 3)).toThrow();
  });

  test('handles unicode characters', () => {
    expect(truncateWithEllipsis('héllo wörld', 8)).toBe('héllo...');
  });

  test('handles very long strings', () => {
    const long = 'a'.repeat(1000);
    const result = truncateWithEllipsis(long, 10);
    expect(result).toBe('aaaaaaa...');
    expect(result.length).toBe(10);
  });
});

describe('extractInitials', () => {
  test('extracts initials from two-word name', () => {
    expect(extractInitials('John Doe')).toBe('JD');
  });

  test('extracts initials from single name', () => {
    expect(extractInitials('Alice')).toBe('A');
  });

  test('returns ? for empty string', () => {
    expect(extractInitials('')).toBe('?');
  });

  test('returns ? for null', () => {
    expect(extractInitials(null)).toBe('?');
  });

  test('returns ? for undefined', () => {
    expect(extractInitials(undefined)).toBe('?');
  });

  test('returns ? for whitespace-only string', () => {
    expect(extractInitials('   ')).toBe('?');
  });

  test('handles multiple spaces between words', () => {
    expect(extractInitials('John   Doe')).toBe('JD');
  });

  test('handles three-word name', () => {
    expect(extractInitials('John Middle Doe')).toBe('JMD');
  });

  test('uppercases initials from lowercase input', () => {
    expect(extractInitials('john doe')).toBe('JD');
  });

  test('handles unicode names', () => {
    expect(extractInitials('Ève Müller')).toBe('ÈM');
  });
});

describe('sanitizeSearchQuery', () => {
  test('removes special characters', () => {
    expect(sanitizeSearchQuery('hello!@#world')).toBe('helloworld');
  });

  test('preserves spaces and hyphens', () => {
    expect(sanitizeSearchQuery('hello world - foo')).toBe('hello world - foo');
  });

  test('collapses multiple spaces', () => {
    expect(sanitizeSearchQuery('hello   world')).toBe('hello world');
  });

  test('returns empty string for null', () => {
    expect(sanitizeSearchQuery(null)).toBe('');
  });

  test('returns empty string for undefined', () => {
    expect(sanitizeSearchQuery(undefined)).toBe('');
  });

  test('returns empty string when only special characters', () => {
    expect(sanitizeSearchQuery('!@#$%^&*()')).toBe('');
  });

  test('trims leading and trailing whitespace', () => {
    expect(sanitizeSearchQuery('  hello  ')).toBe('hello');
  });

  test('preserves alphanumeric characters', () => {
    expect(sanitizeSearchQuery('abc123')).toBe('abc123');
  });
});

describe('highlightMatch', () => {
  test('wraps match in mark tags', () => {
    expect(highlightMatch('Hello World', 'World')).toBe('Hello <mark>World</mark>');
  });

  test('is case-insensitive', () => {
    expect(highlightMatch('Hello World', 'hello')).toBe('<mark>Hello</mark> World');
  });

  test('wraps all occurrences', () => {
    expect(highlightMatch('foo bar foo', 'foo')).toBe('<mark>foo</mark> bar <mark>foo</mark>');
  });

  test('returns escaped text when query is empty', () => {
    expect(highlightMatch('Hello', '')).toBe('Hello');
  });

  test('escapes HTML in text to prevent XSS', () => {
    expect(highlightMatch('<script>alert(1)</script>', 'alert')).toBe(
      '&lt;script&gt;<mark>alert</mark>(1)&lt;/script&gt;'
    );
  });

  test('escapes XSS payload in text without match', () => {
    expect(highlightMatch('<img src=x onerror=alert(1)>', 'missing')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;'
    );
  });

  test('handles no match found', () => {
    expect(highlightMatch('Hello World', 'xyz')).toBe('Hello World');
  });

  test('handles unicode text and query', () => {
    expect(highlightMatch('Héllo Wörld', 'Wörld')).toBe('Héllo <mark>Wörld</mark>');
  });

  test('escapes ampersands and quotes in text', () => {
    expect(highlightMatch('Tom & Jerry', 'Jerry')).toBe('Tom &amp; <mark>Jerry</mark>');
  });
});
