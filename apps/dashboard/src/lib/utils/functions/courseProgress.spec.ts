import { calculateCompletionPercentage, formatProgressLabel, isComplete } from './courseProgress';

describe('calculateCompletionPercentage', () => {
  test('returns 0 when totalLessons is 0', () => {
    expect(calculateCompletionPercentage(0, 0)).toBe(0);
  });

  test('returns 0 when totalLessons is negative', () => {
    expect(calculateCompletionPercentage(5, -1)).toBe(0);
  });

  test('returns 0 when completedLessons is 0', () => {
    expect(calculateCompletionPercentage(0, 10)).toBe(0);
  });

  test('returns 0 when completedLessons is negative', () => {
    expect(calculateCompletionPercentage(-3, 10)).toBe(0);
  });

  test('returns 0 when completedLessons is NaN', () => {
    expect(calculateCompletionPercentage(NaN, 10)).toBe(0);
  });

  test('returns 0 when totalLessons is NaN', () => {
    expect(calculateCompletionPercentage(5, NaN)).toBe(0);
  });

  test('returns correct percentage for partial progress', () => {
    expect(calculateCompletionPercentage(3, 10)).toBe(30);
  });

  test('rounds to nearest integer', () => {
    expect(calculateCompletionPercentage(1, 3)).toBe(33);
  });

  test('returns 100 for full completion', () => {
    expect(calculateCompletionPercentage(10, 10)).toBe(100);
  });

  test('caps at 100 when completedLessons exceeds totalLessons', () => {
    expect(calculateCompletionPercentage(15, 10)).toBe(100);
  });
});

describe('formatProgressLabel', () => {
  test('returns "Not started" for 0', () => {
    expect(formatProgressLabel(0)).toBe('Not started');
  });

  test('returns "Not started" for negative values', () => {
    expect(formatProgressLabel(-5)).toBe('Not started');
  });

  test('returns "Complete" for 100', () => {
    expect(formatProgressLabel(100)).toBe('Complete');
  });

  test('returns "Complete" for values above 100', () => {
    expect(formatProgressLabel(110)).toBe('Complete');
  });

  test('returns formatted label for partial progress', () => {
    expect(formatProgressLabel(75)).toBe('75% complete');
  });

  test('returns formatted label for 1%', () => {
    expect(formatProgressLabel(1)).toBe('1% complete');
  });

  test('returns formatted label for 99%', () => {
    expect(formatProgressLabel(99)).toBe('99% complete');
  });
});

describe('isComplete', () => {
  test('returns false when totalLessons is 0', () => {
    expect(isComplete(0, 0)).toBe(false);
  });

  test('returns false when totalLessons is negative', () => {
    expect(isComplete(5, -1)).toBe(false);
  });

  test('returns false when totalLessons is NaN', () => {
    expect(isComplete(5, NaN)).toBe(false);
  });

  test('returns false for partial completion', () => {
    expect(isComplete(3, 10)).toBe(false);
  });

  test('returns false when no lessons completed', () => {
    expect(isComplete(0, 10)).toBe(false);
  });

  test('returns true when all lessons completed', () => {
    expect(isComplete(10, 10)).toBe(true);
  });

  test('returns true when completedLessons exceeds totalLessons', () => {
    expect(isComplete(11, 10)).toBe(true);
  });
});
