import {
  truncateWithEllipsis,
  extractInitials,
  sanitizeSearchQuery,
  highlightMatch
} from './textFormatting';

describe('truncateWithEllipsis', () => {
  test('returns the original text when within the limit', () => {
    expect(truncateWithEllipsis('hello', 10)).toEqual('hello');
  });

  test('returns the original text when exactly at the limit', () => {
    expect(truncateWithEllipsis('hello', 5)).toEqual('hello');
  });

  test('truncates and appends an ellipsis when exceeded', () => {
    expect(truncateWithEllipsis('hello world', 8)).toEqual('hello...');
  });

  test('keeps the result within maxLength including the ellipsis', () => {
    const result = truncateWithEllipsis('classroomio', 6);
    expect(result).toEqual('cla...');
    expect(result.length).toEqual(6);
  });

  test('returns text unchanged when maxLength is below 4', () => {
    expect(truncateWithEllipsis('hello', 3)).toEqual('hello');
    expect(truncateWithEllipsis('hello', 0)).toEqual('hello');
  });

  test('returns an empty string for empty, null or undefined input', () => {
    expect(truncateWithEllipsis('', 10)).toEqual('');
    // @ts-expect-error testing null input
    expect(truncateWithEllipsis(null, 10)).toEqual('');
    // @ts-expect-error testing undefined input
    expect(truncateWithEllipsis(undefined, 10)).toEqual('');
  });

  test('handles very long strings', () => {
    const long = 'a'.repeat(1000);
    const result = truncateWithEllipsis(long, 10);
    expect(result).toEqual('aaaaaaa...');
    expect(result.length).toEqual(10);
  });

  test('does not split multi-byte unicode characters', () => {
    const result = truncateWithEllipsis('😀😀😀😀😀', 4);
    // 1 emoji + ellipsis, not a broken surrogate half
    expect(result).toEqual('😀...');
  });
});

describe('extractInitials', () => {
  test('returns first and last initials for a two-word name', () => {
    expect(extractInitials('John Doe')).toEqual('JD');
  });

  test('returns a single initial for a one-word name', () => {
    expect(extractInitials('Alice')).toEqual('A');
  });

  test('uses the first and last word for three or more words', () => {
    expect(extractInitials('Mary Jane Watson')).toEqual('MW');
  });

  test('returns "?" for empty or whitespace-only input', () => {
    expect(extractInitials('')).toEqual('?');
    expect(extractInitials('   ')).toEqual('?');
    // @ts-expect-error testing null input
    expect(extractInitials(null)).toEqual('?');
    // @ts-expect-error testing undefined input
    expect(extractInitials(undefined)).toEqual('?');
  });

  test('handles multiple spaces between words', () => {
    expect(extractInitials('John    Doe')).toEqual('JD');
    expect(extractInitials('  Mary   Jane   Watson  ')).toEqual('MW');
  });

  test('uppercases lowercase names', () => {
    expect(extractInitials('john doe')).toEqual('JD');
  });

  test('handles unicode names', () => {
    expect(extractInitials('Ärni Ülane')).toEqual('ÄÜ');
  });
});

describe('sanitizeSearchQuery', () => {
  test('strips non-alphanumeric characters except spaces and hyphens', () => {
    expect(sanitizeSearchQuery('hello@world!')).toEqual('helloworld');
    expect(sanitizeSearchQuery('well-known #topic')).toEqual('well-known topic');
  });

  test('collapses multiple spaces and trims', () => {
    expect(sanitizeSearchQuery('  hello    world  ')).toEqual('hello world');
  });

  test('returns an empty string for input that is only special characters', () => {
    expect(sanitizeSearchQuery('@#$%^&*()')).toEqual('');
  });

  test('returns an empty string for empty, null or undefined input', () => {
    expect(sanitizeSearchQuery('')).toEqual('');
    // @ts-expect-error testing null input
    expect(sanitizeSearchQuery(null)).toEqual('');
    // @ts-expect-error testing undefined input
    expect(sanitizeSearchQuery(undefined)).toEqual('');
  });

  test('keeps unicode letters and numbers', () => {
    expect(sanitizeSearchQuery('café 123')).toEqual('café 123');
  });

  test('strips XSS-style input down to plain text', () => {
    expect(sanitizeSearchQuery("<script>alert('x')</script>")).toEqual('scriptalertxscript');
  });
});

describe('highlightMatch', () => {
  test('wraps a case-insensitive match in <mark> tags', () => {
    expect(highlightMatch('Hello World', 'world')).toEqual('Hello <mark>World</mark>');
  });

  test('preserves the original casing of the matched text', () => {
    expect(highlightMatch('JavaScript', 'javascript')).toEqual('<mark>JavaScript</mark>');
  });

  test('highlights all occurrences', () => {
    expect(highlightMatch('abab', 'a')).toEqual('<mark>a</mark>b<mark>a</mark>b');
  });

  test('returns escaped text unchanged when there is no match', () => {
    expect(highlightMatch('Hello World', 'xyz')).toEqual('Hello World');
  });

  test('returns an empty string for empty, null or undefined text', () => {
    expect(highlightMatch('', 'x')).toEqual('');
    // @ts-expect-error testing null input
    expect(highlightMatch(null, 'x')).toEqual('');
    // @ts-expect-error testing undefined input
    expect(highlightMatch(undefined, 'x')).toEqual('');
  });

  test('returns escaped text when the query is empty', () => {
    expect(highlightMatch('Hello World', '')).toEqual('Hello World');
    expect(highlightMatch('Hello World', '   ')).toEqual('Hello World');
  });

  test('escapes HTML in the text to prevent XSS', () => {
    const result = highlightMatch("<script>alert('x')</script>", 'alert');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
    expect(result).toContain('<mark>alert</mark>');
  });

  test('treats regex special characters in the query literally', () => {
    expect(highlightMatch('price is $5.00', '$5.00')).toEqual('price is <mark>$5.00</mark>');
  });
});
