import {
  truncateWithEllipsis,
  extractInitials,
  sanitizeSearchQuery,
  highlightMatch
} from './textFormatting';

describe('truncateWithEllipsis', () => {
  test('should return original text if within limit', () => {
    expect(truncateWithEllipsis('Hello', 10)).toBe('Hello');
  });

  test('should truncate and append ellipsis when text exceeds maxLength', () => {
    expect(truncateWithEllipsis('Hello World', 8)).toBe('Hello...');
  });

  test('should return empty string for null input', () => {
    expect(truncateWithEllipsis(null, 10)).toBe('');
  });

  test('should return empty string for undefined input', () => {
    expect(truncateWithEllipsis(undefined, 10)).toBe('');
  });

  test('should return empty string for empty string input', () => {
    expect(truncateWithEllipsis('', 10)).toBe('');
  });

  test('should return text as-is when maxLength is less than 4', () => {
    expect(truncateWithEllipsis('Hello', 3)).toBe('Hello');
  });

  test('should handle exact maxLength boundary', () => {
    expect(truncateWithEllipsis('Hello', 5)).toBe('Hello');
  });

  test('should handle maxLength of exactly 4', () => {
    expect(truncateWithEllipsis('Hello World', 4)).toBe('H...');
  });

  test('should handle very long strings', () => {
    const long = 'a'.repeat(10000);
    const result = truncateWithEllipsis(long, 100);
    expect(result.length).toBe(100);
    expect(result.endsWith('...')).toBe(true);
  });

  test('should handle unicode strings', () => {
    expect(truncateWithEllipsis('こんにちは世界', 6)).toBe('こんに...');
  });
});

describe('extractInitials', () => {
  test('should extract initials from two-word name', () => {
    expect(extractInitials('John Doe')).toBe('JD');
  });

  test('should extract single initial from one-word name', () => {
    expect(extractInitials('Alice')).toBe('A');
  });

  test('should use first and last name for three-word names', () => {
    expect(extractInitials('Mary Jane Watson')).toBe('MW');
  });

  test('should return "?" for empty string', () => {
    expect(extractInitials('')).toBe('?');
  });

  test('should return "?" for null input', () => {
    expect(extractInitials(null)).toBe('?');
  });

  test('should return "?" for undefined input', () => {
    expect(extractInitials(undefined)).toBe('?');
  });

  test('should return "?" for whitespace-only input', () => {
    expect(extractInitials('   ')).toBe('?');
  });

  test('should handle multiple spaces between words', () => {
    expect(extractInitials('John    Doe')).toBe('JD');
  });

  test('should uppercase initials from lowercase names', () => {
    expect(extractInitials('john doe')).toBe('JD');
  });

  test('should handle unicode names', () => {
    expect(extractInitials('Ólafur Arnalds')).toBe('ÓA');
  });
});

describe('sanitizeSearchQuery', () => {
  test('should return alphanumeric text unchanged', () => {
    expect(sanitizeSearchQuery('hello world')).toBe('hello world');
  });

  test('should preserve hyphens', () => {
    expect(sanitizeSearchQuery('well-known')).toBe('well-known');
  });

  test('should strip special characters', () => {
    expect(sanitizeSearchQuery('hello@world!#$%')).toBe('helloworld');
  });

  test('should collapse multiple spaces', () => {
    expect(sanitizeSearchQuery('hello   world')).toBe('hello world');
  });

  test('should trim leading and trailing spaces', () => {
    expect(sanitizeSearchQuery('  hello  ')).toBe('hello');
  });

  test('should return empty string for only special characters', () => {
    expect(sanitizeSearchQuery('!@#$%^&*()')).toBe('');
  });

  test('should return empty string for null input', () => {
    expect(sanitizeSearchQuery(null)).toBe('');
  });

  test('should return empty string for undefined input', () => {
    expect(sanitizeSearchQuery(undefined)).toBe('');
  });

  test('should handle XSS input', () => {
    expect(sanitizeSearchQuery("<script>alert('x')</script>")).toBe('scriptalertxscript');
  });

  test('should preserve unicode letters', () => {
    expect(sanitizeSearchQuery('café résumé')).toBe('café résumé');
  });
});

describe('highlightMatch', () => {
  test('should wrap matching substring in mark tags', () => {
    expect(highlightMatch('Hello World', 'world')).toBe('Hello <mark>World</mark>');
  });

  test('should be case-insensitive', () => {
    expect(highlightMatch('Hello World', 'HELLO')).toBe('<mark>Hello</mark> World');
  });

  test('should highlight all occurrences', () => {
    expect(highlightMatch('foo bar foo', 'foo')).toBe('<mark>foo</mark> bar <mark>foo</mark>');
  });

  test('should return escaped text when query is empty', () => {
    expect(highlightMatch('Hello World', '')).toBe('Hello World');
  });

  test('should return empty string for null text', () => {
    expect(highlightMatch(null, 'query')).toBe('');
  });

  test('should return empty string for empty text', () => {
    expect(highlightMatch('', 'query')).toBe('');
  });

  test('should escape HTML in text to prevent XSS', () => {
    expect(highlightMatch("<script>alert('x')</script>", 'script')).toBe(
      '&lt;<mark>script</mark>&gt;alert(&#x27;x&#x27;)&lt;/<mark>script</mark>&gt;'
    );
  });

  test('should handle special regex characters in query', () => {
    expect(highlightMatch('price is $100.00', '$100')).toBe(
      'price is <mark>$100</mark>.00'
    );
  });

  test('should handle unicode text', () => {
    expect(highlightMatch('café latte', 'café')).toBe('<mark>café</mark> latte');
  });

  test('should return escaped text when no match is found', () => {
    expect(highlightMatch('Hello World', 'xyz')).toBe('Hello World');
  });
});
