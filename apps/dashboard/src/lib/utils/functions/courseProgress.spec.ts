import { calculateCompletionPercentage, formatProgressLabel, isComplete } from './courseProgress';

describe('calculateCompletionPercentage', () => {
  test('should return 0 when totalLessons is 0', () => {
    expect(calculateCompletionPercentage(0, 0)).toBe(0);
  });

  test('should return 0 when totalLessons is negative', () => {
    expect(calculateCompletionPercentage(5, -10)).toBe(0);
  });

  test('should calculate correct percentage for partial progress', () => {
    expect(calculateCompletionPercentage(2, 4)).toBe(50);
    expect(calculateCompletionPercentage(1, 3)).toBe(33);
    expect(calculateCompletionPercentage(3, 4)).toBe(75);
  });

  test('should return 100 for full completion', () => {
    expect(calculateCompletionPercentage(5, 5)).toBe(100);
  });

  test('should clamp to 100 if completedLessons exceeds totalLessons', () => {
    expect(calculateCompletionPercentage(10, 5)).toBe(100);
  });

  test('should round to nearest integer', () => {
    expect(calculateCompletionPercentage(1, 3)).toBe(33);
    expect(calculateCompletionPercentage(2, 3)).toBe(67);
  });

  test('should handle NaN inputs', () => {
    expect(calculateCompletionPercentage(NaN, 5)).toBe(0);
    expect(calculateCompletionPercentage(5, NaN)).toBe(0);
  });
});

describe('formatProgressLabel', () => {
  test('should return "Not started" for 0%', () => {
    expect(formatProgressLabel(0)).toBe('Not started');
  });

  test('should return "Complete" for 100%', () => {
    expect(formatProgressLabel(100)).toBe('Complete');
  });

  test('should return formatted string for partial progress', () => {
    expect(formatProgressLabel(75)).toBe('75% complete');
    expect(formatProgressLabel(50)).toBe('50% complete');
    expect(formatProgressLabel(25)).toBe('25% complete');
  });
});

describe('isComplete', () => {
  test('should return true when all lessons are completed', () => {
    expect(isComplete(5, 5)).toBe(true);
  });

  test('should return false for partial completion', () => {
    expect(isComplete(3, 5)).toBe(false);
    expect(isComplete(1, 5)).toBe(false);
  });

  test('should return false when totalLessons is 0', () => {
    expect(isComplete(0, 0)).toBe(false);
  });

  test('should return false when totalLessons is negative', () => {
    expect(isComplete(5, -10)).toBe(false);
  });

  test('should return true when completedLessons exceeds totalLessons', () => {
    expect(isComplete(10, 5)).toBe(true);
  });

  test('should handle NaN inputs', () => {
    expect(isComplete(NaN, 5)).toBe(false);
    expect(isComplete(5, NaN)).toBe(false);
  });
});
