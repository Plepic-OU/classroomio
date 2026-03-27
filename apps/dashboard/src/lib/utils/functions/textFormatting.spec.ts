import { truncateWithEllipsis, extractInitials, sanitizeSearchQuery, highlightMatch } from './textFormatting';

describe('truncateWithEllipsis', () => {
  it('returns original text if within limit', () => {
    expect(truncateWithEllipsis('Hello', 10)).toBe('Hello');
  });

  it('truncates and appends ellipsis when exceeded', () => {
    expect(truncateWithEllipsis('Hello World', 8)).toBe('Hello...');
  });

  it('returns empty string for null/undefined/empty input', () => {
    expect(truncateWithEllipsis(null, 10)).toBe('');
    expect(truncateWithEllipsis(undefined, 10)).toBe('');
    expect(truncateWithEllipsis('', 10)).toBe('');
  });

  it('returns text as-is if maxLength < 4', () => {
    expect(truncateWithEllipsis('Hello', 3)).toBe('Hello');
  });

  it('handles exact maxLength boundary', () => {
    expect(truncateWithEllipsis('Hello', 5)).toBe('Hello');
    expect(truncateWithEllipsis('Hello!', 5)).toBe('He...');
  });

  it('handles very long strings', () => {
    const long = 'a'.repeat(10000);
    const result = truncateWithEllipsis(long, 100);
    expect(result).toHaveLength(100);
    expect(result.endsWith('...')).toBe(true);
  });

  it('handles unicode strings', () => {
    expect(truncateWithEllipsis('Héllo Wörld', 8)).toBe('Héllo...');
  });

  it('handles maxLength of exactly 4', () => {
    expect(truncateWithEllipsis('Hello', 4)).toBe('H...');
  });
});

describe('extractInitials', () => {
  it('returns initials from two-word name', () => {
    expect(extractInitials('John Doe')).toBe('JD');
  });

  it('returns single initial for one-word name', () => {
    expect(extractInitials('Alice')).toBe('A');
  });

  it('returns first and last initials for multi-word name', () => {
    expect(extractInitials('Mary Jane Watson')).toBe('MW');
  });

  it('returns "?" for empty/null/undefined input', () => {
    expect(extractInitials('')).toBe('?');
    expect(extractInitials(null)).toBe('?');
    expect(extractInitials(undefined)).toBe('?');
  });

  it('handles multiple spaces between words', () => {
    expect(extractInitials('John    Doe')).toBe('JD');
  });

  it('handles leading and trailing spaces', () => {
    expect(extractInitials('  John Doe  ')).toBe('JD');
  });

  it('returns uppercase initials for lowercase names', () => {
    expect(extractInitials('john doe')).toBe('JD');
  });

  it('returns "?" for whitespace-only input', () => {
    expect(extractInitials('   ')).toBe('?');
  });

  it('handles unicode names', () => {
    expect(extractInitials('Ólafur Arnalds')).toBe('ÓA');
  });
});

describe('sanitizeSearchQuery', () => {
  it('strips special characters', () => {
    expect(sanitizeSearchQuery('hello@world!')).toBe('helloworld');
  });

  it('keeps spaces and hyphens', () => {
    expect(sanitizeSearchQuery('hello world')).toBe('hello world');
    expect(sanitizeSearchQuery('well-known')).toBe('well-known');
  });

  it('collapses multiple spaces', () => {
    expect(sanitizeSearchQuery('hello   world')).toBe('hello world');
  });

  it('trims leading and trailing spaces', () => {
    expect(sanitizeSearchQuery('  hello  ')).toBe('hello');
  });

  it('returns empty string for null/undefined', () => {
    expect(sanitizeSearchQuery(null)).toBe('');
    expect(sanitizeSearchQuery(undefined)).toBe('');
  });

  it('returns empty string for input with only special characters', () => {
    expect(sanitizeSearchQuery('!@#$%^&*()')).toBe('');
  });

  it('handles XSS input', () => {
    expect(sanitizeSearchQuery("<script>alert('x')</script>")).toBe('scriptalertxscript');
  });

  it('preserves unicode letters', () => {
    expect(sanitizeSearchQuery('café résumé')).toBe('café résumé');
  });
});

describe('highlightMatch', () => {
  it('wraps matching substring in mark tags', () => {
    expect(highlightMatch('Hello World', 'world')).toBe('Hello <mark>World</mark>');
  });

  it('is case-insensitive', () => {
    expect(highlightMatch('Hello World', 'HELLO')).toBe('<mark>Hello</mark> World');
  });

  it('returns escaped text if query is empty', () => {
    expect(highlightMatch('Hello', '')).toBe('Hello');
    expect(highlightMatch('Hello', null)).toBe('Hello');
  });

  it('returns empty string for null/undefined/empty text', () => {
    expect(highlightMatch(null, 'test')).toBe('');
    expect(highlightMatch(undefined, 'test')).toBe('');
    expect(highlightMatch('', 'test')).toBe('');
  });

  it('escapes HTML to prevent XSS', () => {
    expect(highlightMatch("<script>alert('x')</script>", 'script')).toBe(
      '&lt;<mark>script</mark>&gt;alert(&#x27;x&#x27;)&lt;/<mark>script</mark>&gt;'
    );
  });

  it('handles no match', () => {
    expect(highlightMatch('Hello World', 'xyz')).toBe('Hello World');
  });

  it('highlights multiple occurrences', () => {
    expect(highlightMatch('foo bar foo', 'foo')).toBe('<mark>foo</mark> bar <mark>foo</mark>');
  });

  it('handles regex special characters in query', () => {
    expect(highlightMatch('price is $100', '$100')).toBe('price is <mark>$100</mark>');
  });

  it('handles unicode text and query', () => {
    expect(highlightMatch('Héllo Wörld', 'wörld')).toBe('Héllo <mark>Wörld</mark>');
  });
});
