import { calculateCompletionPercentage, formatProgressLabel, isComplete } from './courseProgress';

describe('calculateCompletionPercentage', () => {
  test('Should return 0 when there are zero lessons', () => {
    expect(calculateCompletionPercentage(0, 0)).toBe(0);
    expect(calculateCompletionPercentage(5, 0)).toBe(0);
  });

  test('Should return 0 when total lessons is negative', () => {
    expect(calculateCompletionPercentage(3, -10)).toBe(0);
  });

  test('Should return 0 when completed lessons is negative', () => {
    expect(calculateCompletionPercentage(-3, 10)).toBe(0);
  });

  test('Should return the rounded percentage for partial progress', () => {
    expect(calculateCompletionPercentage(3, 4)).toBe(75);
    expect(calculateCompletionPercentage(1, 3)).toBe(33);
    expect(calculateCompletionPercentage(2, 3)).toBe(67);
  });

  test('Should return 100 for full completion', () => {
    expect(calculateCompletionPercentage(10, 10)).toBe(100);
  });

  test('Should clamp to 100 when completed lessons exceed total', () => {
    expect(calculateCompletionPercentage(12, 10)).toBe(100);
  });

  test('Should return 0 when inputs are Not A Number', () => {
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

  test('Should return percentage label for partial progress', () => {
    expect(formatProgressLabel(75)).toBe('75% complete');
    expect(formatProgressLabel(1)).toBe('1% complete');
    expect(formatProgressLabel(99)).toBe('99% complete');
  });

  test('Should round fractional percentages', () => {
    expect(formatProgressLabel(33.3)).toBe('33% complete');
  });

  test('Should clamp out-of-range values', () => {
    expect(formatProgressLabel(-20)).toBe('Not started');
    expect(formatProgressLabel(150)).toBe('Complete');
  });

  test('Should return "Not started" when percentage is Not A Number', () => {
    expect(formatProgressLabel(NaN)).toBe('Not started');
  });
});

describe('isComplete', () => {
  test('Should return true when all lessons are completed', () => {
    expect(isComplete(10, 10)).toBeTruthy();
  });

  test('Should return false for partial progress', () => {
    expect(isComplete(9, 10)).toBeFalsy();
  });

  test('Should return false when there are zero lessons', () => {
    expect(isComplete(0, 0)).toBeFalsy();
  });

  test('Should return true when completed lessons exceed total', () => {
    expect(isComplete(12, 10)).toBeTruthy();
  });

  test('Should return false for negative numbers', () => {
    expect(isComplete(-1, -1)).toBeFalsy();
    expect(isComplete(-1, 10)).toBeFalsy();
  });

  test('Should return false when inputs are Not A Number', () => {
    expect(isComplete(NaN, 10)).toBeFalsy();
    expect(isComplete(10, NaN)).toBeFalsy();
  });
});
