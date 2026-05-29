import {
  truncateWithEllipsis,
  extractInitials,
  sanitizeSearchQuery,
  highlightMatch
} from './textFormatting';

describe('truncateWithEllipsis', () => {
  test('appends ellipsis when text exceeds maxLength', () => {
    expect(truncateWithEllipsis('Hello, world!', 8)).toBe('Hello, …');
  });

  test('returns original text when within bounds', () => {
    expect(truncateWithEllipsis('Hi', 10)).toBe('Hi');
  });

  test('returns original text when length equals maxLength', () => {
    expect(truncateWithEllipsis('exact', 5)).toBe('exact');
  });

  test('returns empty string for null input', () => {
    expect(truncateWithEllipsis(null, 10)).toBe('');
  });

  test('returns empty string for undefined input', () => {
    expect(truncateWithEllipsis(undefined, 10)).toBe('');
  });

  test('returns empty string when input is empty', () => {
    expect(truncateWithEllipsis('', 10)).toBe('');
  });

  test('throws when maxLength is below 4', () => {
    expect(() => truncateWithEllipsis('hello', 3)).toThrow();
    expect(() => truncateWithEllipsis('hello', 0)).toThrow();
    expect(() => truncateWithEllipsis('hello', -1)).toThrow();
  });

  test('throws when maxLength is not a finite number', () => {
    expect(() => truncateWithEllipsis('hello', NaN)).toThrow();
    expect(() => truncateWithEllipsis('hello', Infinity)).toThrow();
  });

  test('handles Unicode characters by code point, not UTF-16 units', () => {
    const text = '👋🏽 hello world';
    const result = truncateWithEllipsis(text, 6);
    expect(Array.from(result)).toHaveLength(6);
    expect(result.endsWith('…')).toBe(true);
  });

  test('truncates very long strings', () => {
    const long = 'a'.repeat(10_000);
    const result = truncateWithEllipsis(long, 20);
    expect(result).toHaveLength(20);
    expect(result.endsWith('…')).toBe(true);
  });

  test('preserves whitespace inside truncated content', () => {
    expect(truncateWithEllipsis('one two three', 8)).toBe('one two…');
  });
});

describe('extractInitials', () => {
  test('returns initials of first and last names', () => {
    expect(extractInitials('John Doe')).toBe('JD');
  });

  test('returns first letter only for single name', () => {
    expect(extractInitials('Madonna')).toBe('M');
  });

  test('returns ? for empty string', () => {
    expect(extractInitials('')).toBe('?');
  });

  test('returns ? for whitespace-only string', () => {
    expect(extractInitials('   ')).toBe('?');
  });

  test('returns ? for null', () => {
    expect(extractInitials(null)).toBe('?');
  });

  test('returns ? for undefined', () => {
    expect(extractInitials(undefined)).toBe('?');
  });

  test('handles multiple consecutive spaces', () => {
    expect(extractInitials('John     Doe')).toBe('JD');
  });

  test('uses first and last token when middle names exist', () => {
    expect(extractInitials('John Michael Doe')).toBe('JD');
  });

  test('trims leading and trailing whitespace', () => {
    expect(extractInitials('  John Doe  ')).toBe('JD');
  });

  test('uppercases lowercase input', () => {
    expect(extractInitials('john doe')).toBe('JD');
  });

  test('handles Unicode names', () => {
    expect(extractInitials('Élise Müller')).toBe('ÉM');
  });

  test('handles emoji codepoint as the initial', () => {
    expect(extractInitials('🎉 Greeter')).toBe('🎉G');
  });

  test('handles tab-separated names as whitespace', () => {
    expect(extractInitials('John\tDoe')).toBe('JD');
  });
});

describe('sanitizeSearchQuery', () => {
  test('preserves alphanumerics, spaces, and hyphens', () => {
    expect(sanitizeSearchQuery('hello-world 123')).toBe('hello-world 123');
  });

  test('removes special characters', () => {
    expect(sanitizeSearchQuery('hello@world!')).toBe('helloworld');
  });

  test('consolidates repeated whitespace', () => {
    expect(sanitizeSearchQuery('foo    bar')).toBe('foo bar');
  });

  test('trims edges', () => {
    expect(sanitizeSearchQuery('  foo bar  ')).toBe('foo bar');
  });

  test('returns empty string when input is only special characters', () => {
    expect(sanitizeSearchQuery('!@#$%^&*()')).toBe('');
  });

  test('returns empty string for null input', () => {
    expect(sanitizeSearchQuery(null)).toBe('');
  });

  test('returns empty string for undefined input', () => {
    expect(sanitizeSearchQuery(undefined)).toBe('');
  });

  test('returns empty string for empty input', () => {
    expect(sanitizeSearchQuery('')).toBe('');
  });

  test('preserves Unicode letters', () => {
    expect(sanitizeSearchQuery('café résumé')).toBe('café résumé');
  });

  test('preserves Unicode digits and removes punctuation around them', () => {
    expect(sanitizeSearchQuery('price: $100.00!')).toBe('price 10000');
  });

  test('handles tabs and newlines as whitespace', () => {
    expect(sanitizeSearchQuery('foo\tbar\nbaz')).toBe('foo bar baz');
  });

  test('strips angle brackets that could form HTML', () => {
    expect(sanitizeSearchQuery('<script>alert(1)</script>')).toBe('scriptalert1script');
  });
});

describe('highlightMatch', () => {
  test('wraps matches in <mark> tags', () => {
    expect(highlightMatch('hello world', 'world')).toBe('hello <mark>world</mark>');
  });

  test('is case-insensitive', () => {
    expect(highlightMatch('Hello World', 'world')).toBe('Hello <mark>World</mark>');
  });

  test('preserves original casing of matched substring', () => {
    expect(highlightMatch('HELLO world', 'hello')).toBe('<mark>HELLO</mark> world');
  });

  test('highlights all occurrences', () => {
    expect(highlightMatch('foo bar foo', 'foo')).toBe(
      '<mark>foo</mark> bar <mark>foo</mark>'
    );
  });

  test('returns escaped text when query is empty', () => {
    expect(highlightMatch('hello', '')).toBe('hello');
  });

  test('returns escaped text when query is null', () => {
    expect(highlightMatch('hello', null)).toBe('hello');
  });

  test('returns empty string when text is null', () => {
    expect(highlightMatch(null, 'foo')).toBe('');
  });

  test('returns empty string when text is undefined', () => {
    expect(highlightMatch(undefined, 'foo')).toBe('');
  });

  test('escapes HTML in text to prevent XSS', () => {
    const out = highlightMatch('<script>alert(1)</script>', 'alert');
    expect(out).toBe('&lt;script&gt;<mark>alert</mark>(1)&lt;/script&gt;');
    expect(out).not.toContain('<script>');
  });

  test('escapes HTML in query before matching', () => {
    const out = highlightMatch('<b>bold</b>', '<b>');
    expect(out).toBe('<mark>&lt;b&gt;</mark>bold&lt;/b&gt;');
  });

  test('escapes ampersands, quotes, and apostrophes', () => {
    expect(highlightMatch(`Tom & Jerry's "show"`, 'jerry')).toBe(
      `Tom &amp; <mark>Jerry</mark>&#39;s &quot;show&quot;`
    );
  });

  test('does not interpret regex metacharacters in query', () => {
    expect(highlightMatch('a.b.c', '.')).toBe('a<mark>.</mark>b<mark>.</mark>c');
    expect(highlightMatch('a+b', '+')).toBe('a<mark>+</mark>b');
  });

  test('handles common XSS payload safely', () => {
    const payload = `"><img src=x onerror=alert(1)>`;
    const out = highlightMatch(payload, 'img');
    expect(out).not.toContain('<img');
    expect(out).toContain('<mark>');
  });

  test('handles Unicode matches', () => {
    expect(highlightMatch('café résumé', 'café')).toBe('<mark>café</mark> résumé');
  });
});
