import {
  calculateCompletionPercentage,
  formatProgressLabel,
  isComplete
} from './courseProgress';

describe('courseProgress.ts', () => {
  describe('calculateCompletionPercentage', () => {
    test('Should return 0 when there are zero lessons', () => {
      expect(calculateCompletionPercentage(0, 0)).toBe(0);
      expect(calculateCompletionPercentage(5, 0)).toBe(0);
    });

    test('Should return 0 when totalLessons is negative', () => {
      expect(calculateCompletionPercentage(2, -10)).toBe(0);
    });

    test('Should return the rounded percentage for partial progress', () => {
      expect(calculateCompletionPercentage(1, 3)).toBe(33);
      expect(calculateCompletionPercentage(2, 3)).toBe(67);
      expect(calculateCompletionPercentage(3, 4)).toBe(75);
    });

    test('Should return 100 for full completion', () => {
      expect(calculateCompletionPercentage(4, 4)).toBe(100);
    });

    test('Should clamp to 100 when completed exceeds total', () => {
      expect(calculateCompletionPercentage(10, 4)).toBe(100);
    });

    test('Should return 0 when completedLessons is negative', () => {
      expect(calculateCompletionPercentage(-5, 10)).toBe(0);
    });

    test('Should return 0 when inputs are Not A Number', () => {
      expect(calculateCompletionPercentage(NaN, 10)).toBe(0);
      expect(calculateCompletionPercentage(5, NaN)).toBe(0);
    });
  });

  describe('formatProgressLabel', () => {
    test('Should return "Not started" for 0', () => {
      expect(formatProgressLabel(0)).toBe('Not started');
    });

    test('Should return "Complete" for 100', () => {
      expect(formatProgressLabel(100)).toBe('Complete');
    });

    test('Should return a percentage label for partial progress', () => {
      expect(formatProgressLabel(75)).toBe('75% complete');
    });
  });

  describe('isComplete', () => {
    test('Should return false for zero lessons', () => {
      expect(isComplete(0, 0)).toBe(false);
    });

    test('Should return true only when all lessons are completed', () => {
      expect(isComplete(4, 4)).toBe(true);
      expect(isComplete(2, 4)).toBe(false);
    });

    test('Should return true when completed exceeds total', () => {
      expect(isComplete(10, 4)).toBe(true);
    });

    test('Should return false for negative total lessons', () => {
      expect(isComplete(2, -5)).toBe(false);
    });

    test('Should return false for Not A Number inputs', () => {
      expect(isComplete(NaN, 4)).toBe(false);
      expect(isComplete(4, NaN)).toBe(false);
    });
  });
});
