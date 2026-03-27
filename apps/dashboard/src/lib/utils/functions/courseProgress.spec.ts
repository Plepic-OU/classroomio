import {
  calculateCompletionPercentage,
  formatProgressLabel,
  isComplete
} from './courseProgress';

describe('calculateCompletionPercentage', () => {
  test('Should return 0 when totalLessons is 0', () => {
    const result = calculateCompletionPercentage(0, 0);
    expect(result).toBe(0);
  });

  test('Should return 0 when totalLessons is negative', () => {
    const result = calculateCompletionPercentage(5, -1);
    expect(result).toBe(0);
  });

  test('Should return 0 when no lessons are completed', () => {
    const result = calculateCompletionPercentage(0, 10);
    expect(result).toBe(0);
  });

  test('Should return correct percentage for partial progress', () => {
    const result = calculateCompletionPercentage(3, 4);
    expect(result).toBe(75);
  });

  test('Should round to nearest integer', () => {
    const result = calculateCompletionPercentage(1, 3);
    expect(result).toBe(33);
  });

  test('Should return 100 when all lessons are completed', () => {
    const result = calculateCompletionPercentage(10, 10);
    expect(result).toBe(100);
  });

  test('Should clamp to 100 when completedLessons exceeds totalLessons', () => {
    const result = calculateCompletionPercentage(15, 10);
    expect(result).toBe(100);
  });

  test('Should return 0 when completedLessons is negative', () => {
    const result = calculateCompletionPercentage(-5, 10);
    expect(result).toBe(0);
  });

  test('Should return 0 when completedLessons is NaN', () => {
    const result = calculateCompletionPercentage(NaN, 10);
    expect(result).toBe(0);
  });

  test('Should return 0 when totalLessons is NaN', () => {
    const result = calculateCompletionPercentage(5, NaN);
    expect(result).toBe(0);
  });
});

describe('formatProgressLabel', () => {
  test('Should return "Not started" when percentage is 0', () => {
    const result = formatProgressLabel(0);
    expect(result).toBe('Not started');
  });

  test('Should return "Complete" when percentage is 100', () => {
    const result = formatProgressLabel(100);
    expect(result).toBe('Complete');
  });

  test('Should return formatted label for partial progress', () => {
    const result = formatProgressLabel(75);
    expect(result).toBe('75% complete');
  });

  test('Should return formatted label for low progress', () => {
    const result = formatProgressLabel(1);
    expect(result).toBe('1% complete');
  });
});

describe('isComplete', () => {
  test('Should return true when all lessons are completed', () => {
    const result = isComplete(10, 10);
    expect(result).toBeTruthy();
  });

  test('Should return true when completedLessons exceeds totalLessons', () => {
    const result = isComplete(15, 10);
    expect(result).toBeTruthy();
  });

  test('Should return false when not all lessons are completed', () => {
    const result = isComplete(5, 10);
    expect(result).toBeFalsy();
  });

  test('Should return false when totalLessons is 0', () => {
    const result = isComplete(0, 0);
    expect(result).toBeFalsy();
  });

  test('Should return false when totalLessons is negative', () => {
    const result = isComplete(5, -1);
    expect(result).toBeFalsy();
  });

  test('Should return false when completedLessons is NaN', () => {
    const result = isComplete(NaN, 10);
    expect(result).toBeFalsy();
  });

  test('Should return false when totalLessons is NaN', () => {
    const result = isComplete(5, NaN);
    expect(result).toBeFalsy();
  });
});
