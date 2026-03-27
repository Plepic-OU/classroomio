import { calculateCompletionPercentage, formatProgressLabel, isComplete } from './courseProgress';

describe('calculateCompletionPercentage', () => {
  test('Should return 0 when totalLessons is 0', () => {
    const result = calculateCompletionPercentage(0, 0);
    expect(result).toBe(0);
  });

  test('Should return 0 when totalLessons is negative', () => {
    const result = calculateCompletionPercentage(5, -1);
    expect(result).toBe(0);
  });

  test('Should return 0 when inputs are NaN', () => {
    expect(calculateCompletionPercentage(NaN, 10)).toBe(0);
    expect(calculateCompletionPercentage(5, NaN)).toBe(0);
  });

  test('Should return correct percentage for partial progress', () => {
    const result = calculateCompletionPercentage(3, 4);
    expect(result).toBe(75);
  });

  test('Should round to nearest integer', () => {
    const result = calculateCompletionPercentage(1, 3);
    expect(result).toBe(33);
  });

  test('Should return 100 for full completion', () => {
    const result = calculateCompletionPercentage(10, 10);
    expect(result).toBe(100);
  });

  test('Should clamp to 100 when completedLessons exceeds totalLessons', () => {
    const result = calculateCompletionPercentage(15, 10);
    expect(result).toBe(100);
  });
});

describe('formatProgressLabel', () => {
  test('Should return "Not started" for 0', () => {
    const result = formatProgressLabel(0);
    expect(result).toBe('Not started');
  });

  test('Should return "Not started" for NaN', () => {
    const result = formatProgressLabel(NaN);
    expect(result).toBe('Not started');
  });

  test('Should return "Complete" for 100', () => {
    const result = formatProgressLabel(100);
    expect(result).toBe('Complete');
  });

  test('Should return "Complete" for values over 100', () => {
    const result = formatProgressLabel(150);
    expect(result).toBe('Complete');
  });

  test('Should return formatted label for partial progress', () => {
    const result = formatProgressLabel(75);
    expect(result).toBe('75% complete');
  });
});

describe('isComplete', () => {
  test('Should return false when totalLessons is 0', () => {
    const result = isComplete(0, 0);
    expect(result).toBe(false);
  });

  test('Should return false when totalLessons is negative', () => {
    const result = isComplete(5, -1);
    expect(result).toBe(false);
  });

  test('Should return false for NaN inputs', () => {
    expect(isComplete(NaN, 10)).toBe(false);
    expect(isComplete(5, NaN)).toBe(false);
  });

  test('Should return false for partial progress', () => {
    const result = isComplete(3, 10);
    expect(result).toBe(false);
  });

  test('Should return true when all lessons completed', () => {
    const result = isComplete(10, 10);
    expect(result).toBe(true);
  });

  test('Should return true when completedLessons exceeds totalLessons', () => {
    const result = isComplete(15, 10);
    expect(result).toBe(true);
  });
});
