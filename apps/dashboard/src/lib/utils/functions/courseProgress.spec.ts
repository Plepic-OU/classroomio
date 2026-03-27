import { calculateCompletionPercentage, formatProgressLabel, isComplete } from './courseProgress';

describe('calculateCompletionPercentage', () => {
  test('Should return 0 when totalLessons is 0', () => {
    expect(calculateCompletionPercentage(0, 0)).toBe(0);
  });

  test('Should return 0 when totalLessons is negative', () => {
    expect(calculateCompletionPercentage(5, -10)).toBe(0);
  });

  test('Should return 0 when no lessons completed', () => {
    expect(calculateCompletionPercentage(0, 10)).toBe(0);
  });

  test('Should return correct percentage for partial progress', () => {
    expect(calculateCompletionPercentage(3, 4)).toBe(75);
  });

  test('Should round to nearest integer', () => {
    expect(calculateCompletionPercentage(1, 3)).toBe(33);
    expect(calculateCompletionPercentage(2, 3)).toBe(67);
  });

  test('Should return 100 when all lessons completed', () => {
    expect(calculateCompletionPercentage(10, 10)).toBe(100);
  });

  test('Should clamp to 100 when completedLessons exceeds totalLessons', () => {
    expect(calculateCompletionPercentage(15, 10)).toBe(100);
  });

  test('Should return 0 for negative completedLessons', () => {
    expect(calculateCompletionPercentage(-5, 10)).toBe(0);
  });

  test('Should return 0 when inputs are NaN', () => {
    expect(calculateCompletionPercentage(NaN, 10)).toBe(0);
    expect(calculateCompletionPercentage(5, NaN)).toBe(0);
    expect(calculateCompletionPercentage(NaN, NaN)).toBe(0);
  });
});

describe('formatProgressLabel', () => {
  test('Should return "Not started" for 0', () => {
    expect(formatProgressLabel(0)).toBe('Not started');
  });

  test('Should return "Complete" for 100', () => {
    expect(formatProgressLabel(100)).toBe('Complete');
  });

  test('Should return formatted label for partial progress', () => {
    expect(formatProgressLabel(75)).toBe('75% complete');
  });

  test('Should return formatted label for 50', () => {
    expect(formatProgressLabel(50)).toBe('50% complete');
  });
});

describe('isComplete', () => {
  test('Should return true when all lessons completed', () => {
    expect(isComplete(10, 10)).toBe(true);
  });

  test('Should return true when completedLessons exceeds totalLessons', () => {
    expect(isComplete(15, 10)).toBe(true);
  });

  test('Should return false when not all lessons completed', () => {
    expect(isComplete(5, 10)).toBe(false);
  });

  test('Should return false for 0 total lessons', () => {
    expect(isComplete(0, 0)).toBe(false);
  });

  test('Should return false for negative totalLessons', () => {
    expect(isComplete(5, -1)).toBe(false);
  });

  test('Should return false for NaN inputs', () => {
    expect(isComplete(NaN, 10)).toBe(false);
    expect(isComplete(5, NaN)).toBe(false);
  });
});
