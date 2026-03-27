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

  test('returns empty string for null/undefined/empty input', () => {
    expect(truncateWithEllipsis(null, 10)).toBe('');
    expect(truncateWithEllipsis(undefined, 10)).toBe('');
    expect(truncateWithEllipsis('', 10)).toBe('');
  });

  test('returns text as-is when maxLength < 4', () => {
    expect(truncateWithEllipsis('Hello', 3)).toBe('Hello');
    expect(truncateWithEllipsis('Hello', 1)).toBe('Hello');
  });

  test('handles exact maxLength boundary', () => {
    expect(truncateWithEllipsis('Hello', 5)).toBe('Hello');
    expect(truncateWithEllipsis('Hello!', 5)).toBe('He...');
  });

  test('handles very long strings', () => {
    const long = 'a'.repeat(10000);
    const result = truncateWithEllipsis(long, 100);
    expect(result).toHaveLength(100);
    expect(result.endsWith('...')).toBe(true);
  });

  test('handles unicode strings', () => {
    expect(truncateWithEllipsis('Hej verden!', 8)).toBe('Hej v...');
  });

  test('maxLength of exactly 4 allows 1 char + ellipsis', () => {
    expect(truncateWithEllipsis('Hello', 4)).toBe('H...');
  });
});

describe('extractInitials', () => {
  test('extracts initials from two-word name', () => {
    expect(extractInitials('John Doe')).toBe('JD');
  });

  test('extracts single initial from one-word name', () => {
    expect(extractInitials('Alice')).toBe('A');
  });

  test('uses first and last word for multi-word names', () => {
    expect(extractInitials('Mary Jane Watson')).toBe('MW');
  });

  test('returns ? for empty/null/undefined input', () => {
    expect(extractInitials('')).toBe('?');
    expect(extractInitials(null)).toBe('?');
    expect(extractInitials(undefined)).toBe('?');
    expect(extractInitials('   ')).toBe('?');
  });

  test('handles multiple spaces between words', () => {
    expect(extractInitials('John    Doe')).toBe('JD');
  });

  test('handles leading/trailing whitespace', () => {
    expect(extractInitials('  John Doe  ')).toBe('JD');
  });

  test('uppercases lowercase initials', () => {
    expect(extractInitials('john doe')).toBe('JD');
  });

  test('handles unicode names', () => {
    expect(extractInitials('Jose Garcia')).toBe('JG');
  });
});

describe('sanitizeSearchQuery', () => {
  test('strips special characters', () => {
    expect(sanitizeSearchQuery('hello@world!')).toBe('helloworld');
  });

  test('preserves spaces and hyphens', () => {
    expect(sanitizeSearchQuery('hello world')).toBe('hello world');
    expect(sanitizeSearchQuery('well-known')).toBe('well-known');
  });

  test('collapses multiple spaces', () => {
    expect(sanitizeSearchQuery('hello   world')).toBe('hello world');
  });

  test('trims whitespace', () => {
    expect(sanitizeSearchQuery('  hello  ')).toBe('hello');
  });

  test('returns empty string for null/undefined/empty', () => {
    expect(sanitizeSearchQuery(null)).toBe('');
    expect(sanitizeSearchQuery(undefined)).toBe('');
    expect(sanitizeSearchQuery('')).toBe('');
  });

  test('returns empty string for only special characters', () => {
    expect(sanitizeSearchQuery('!@#$%^&*()')).toBe('');
  });

  test('strips XSS input', () => {
    expect(sanitizeSearchQuery("<script>alert('x')</script>")).toBe('scriptalertxscript');
  });

  test('preserves unicode letters', () => {
    expect(sanitizeSearchQuery('cafe latte')).toBe('cafe latte');
  });
});

describe('highlightMatch', () => {
  test('wraps matching substring in mark tags', () => {
    expect(highlightMatch('Hello World', 'world')).toBe('Hello <mark>World</mark>');
  });

  test('case-insensitive matching', () => {
    expect(highlightMatch('Hello World', 'HELLO')).toBe('<mark>Hello</mark> World');
  });

  test('returns escaped text when query is empty/null', () => {
    expect(highlightMatch('Hello', '')).toBe('Hello');
    expect(highlightMatch('Hello', null)).toBe('Hello');
  });

  test('returns empty string for null/undefined text', () => {
    expect(highlightMatch(null, 'test')).toBe('');
    expect(highlightMatch(undefined, 'test')).toBe('');
  });

  test('escapes HTML in text to prevent XSS', () => {
    expect(highlightMatch("<script>alert('x')</script>", 'script')).toBe(
      '&lt;<mark>script</mark>&gt;alert(&#x27;x&#x27;)&lt;/<mark>script</mark>&gt;'
    );
  });

  test('handles no match', () => {
    expect(highlightMatch('Hello World', 'xyz')).toBe('Hello World');
  });

  test('highlights multiple occurrences', () => {
    expect(highlightMatch('ab ab ab', 'ab')).toBe('<mark>ab</mark> <mark>ab</mark> <mark>ab</mark>');
  });

  test('handles special regex characters in query', () => {
    expect(highlightMatch('price is $100', '$100')).toBe('price is <mark>$100</mark>');
  });

  test('handles empty text', () => {
    expect(highlightMatch('', 'test')).toBe('');
  });
});
