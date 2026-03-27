import {
  truncateWithEllipsis,
  extractInitials,
  sanitizeSearchQuery,
  highlightMatch
} from './textFormatting';

describe('truncateWithEllipsis', () => {
  test('returns text unchanged when within maxLength', () => {
    expect(truncateWithEllipsis('hello', 10)).toEqual('hello');
  });

  test('truncates and appends ellipsis when text exceeds maxLength', () => {
    expect(truncateWithEllipsis('hello world', 8)).toEqual('hello...');
  });

  test('returns exact length string with ellipsis at boundary', () => {
    expect(truncateWithEllipsis('abcdef', 5)).toEqual('ab...');
  });

  test('returns text unchanged when maxLength equals text length', () => {
    expect(truncateWithEllipsis('hello', 5)).toEqual('hello');
  });

  test('returns text unchanged when maxLength is below minimum threshold of 4', () => {
    expect(truncateWithEllipsis('hello', 3)).toEqual('hello');
  });

  test('handles empty string', () => {
    expect(truncateWithEllipsis('', 10)).toEqual('');
  });

  test('handles unicode strings', () => {
    expect(truncateWithEllipsis('こんにちは世界', 5)).toEqual('こん...');
  });

  test('handles extended strings', () => {
    const long = 'a'.repeat(100);
    const result = truncateWithEllipsis(long, 10);
    expect(result).toEqual('aaaaaaa...');
    expect(result.length).toEqual(10);
  });
});

describe('extractInitials', () => {
  test('returns first and last initials for a multi-word name', () => {
    expect(extractInitials('Mary Jane Watson')).toEqual('MW');
  });

  test('returns single initial for a one-word name', () => {
    expect(extractInitials('Alice')).toEqual('A');
  });

  test('returns first and last initials for a two-word name', () => {
    expect(extractInitials('John Doe')).toEqual('JD');
  });

  test('handles extra whitespace between words', () => {
    expect(extractInitials('  Mary   Jane  Watson  ')).toEqual('MW');
  });

  test('returns empty string for empty input', () => {
    expect(extractInitials('')).toEqual('');
  });

  test('handles whitespace-only input', () => {
    expect(extractInitials('   ')).toEqual('');
  });

  test('returns uppercase initials', () => {
    expect(extractInitials('alice bob')).toEqual('AB');
  });
});

describe('sanitizeSearchQuery', () => {
  test('removes special characters except spaces and hyphens', () => {
    expect(sanitizeSearchQuery('hello! @world#')).toEqual('hello world');
  });

  test('preserves hyphens', () => {
    expect(sanitizeSearchQuery('e-learning platform')).toEqual('e-learning platform');
  });

  test('normalizes multiple spaces to single space', () => {
    expect(sanitizeSearchQuery('hello   world')).toEqual('hello world');
  });

  test('trims leading and trailing whitespace', () => {
    expect(sanitizeSearchQuery('  hello world  ')).toEqual('hello world');
  });

  test('handles empty string', () => {
    expect(sanitizeSearchQuery('')).toEqual('');
  });

  test('removes script injection attempts', () => {
    expect(sanitizeSearchQuery('<script>alert(1)</script>')).toEqual('scriptalert1script');
  });

  test('handles unicode characters', () => {
    expect(sanitizeSearchQuery('café résumé')).toEqual('caf rsum');
  });

  test('handles whitespace variations including tabs and newlines', () => {
    expect(sanitizeSearchQuery('hello\t\nworld')).toEqual('hello world');
  });
});

describe('highlightMatch', () => {
  test('wraps matching text in mark tags', () => {
    expect(highlightMatch('hello world', 'world')).toEqual('hello <mark>world</mark>');
  });

  test('is case-insensitive', () => {
    expect(highlightMatch('Hello World', 'hello')).toEqual('<mark>Hello</mark> World');
  });

  test('wraps all occurrences', () => {
    expect(highlightMatch('the cat sat on the mat', 'at')).toEqual(
      'the c<mark>at</mark> s<mark>at</mark> on the m<mark>at</mark>'
    );
  });

  test('returns escaped html when query is empty', () => {
    expect(highlightMatch('hello', '')).toEqual('hello');
  });

  test('escapes html in text to prevent XSS', () => {
    expect(highlightMatch('<script>alert(1)</script>', 'alert')).toEqual(
      '&lt;script&gt;<mark>alert</mark>(1)&lt;/script&gt;'
    );
  });

  test('escapes malicious script in text with no match', () => {
    expect(highlightMatch('<img src=x onerror=alert(1)>', 'missing')).toEqual(
      '&lt;img src=x onerror=alert(1)&gt;'
    );
  });

  test('handles empty text', () => {
    expect(highlightMatch('', 'query')).toEqual('');
  });

  test('handles unicode text and query', () => {
    expect(highlightMatch('こんにちは世界', '世界')).toEqual('こんにちは<mark>世界</mark>');
  });

  test('escapes ampersands and quotes in text', () => {
    expect(highlightMatch('Tom & Jerry "show"', 'Jerry')).toEqual(
      'Tom &amp; <mark>Jerry</mark> &quot;show&quot;'
    );
  });
});
