import { calculateCompletionPercentage, formatProgressLabel, isComplete } from './courseProgress';

describe('courseProgress.ts', () => {
  describe('calculateCompletionPercentage', () => {
    test('Should return 0 when totalLessons is 0', () => {
      expect(calculateCompletionPercentage(0, 0)).toBe(0);
    });

    test('Should return 0 when totalLessons is negative', () => {
      expect(calculateCompletionPercentage(5, -1)).toBe(0);
    });

    test('Should return 0 when completedLessons is NaN', () => {
      expect(calculateCompletionPercentage(NaN, 10)).toBe(0);
    });

    test('Should return 0 when totalLessons is NaN', () => {
      expect(calculateCompletionPercentage(5, NaN)).toBe(0);
    });

    test('Should return partial progress rounded to nearest integer', () => {
      expect(calculateCompletionPercentage(1, 3)).toBe(33);
    });

    test('Should return 75 for 3 of 4 lessons completed', () => {
      expect(calculateCompletionPercentage(3, 4)).toBe(75);
    });

    test('Should return 100 for full completion', () => {
      expect(calculateCompletionPercentage(5, 5)).toBe(100);
    });

    test('Should clamp to 100 when completedLessons exceeds totalLessons', () => {
      expect(calculateCompletionPercentage(10, 5)).toBe(100);
    });
  });

  describe('formatProgressLabel', () => {
    test('Should return "Not started" for 0%', () => {
      expect(formatProgressLabel(0)).toBe('Not started');
    });

    test('Should return "Not started" for negative percentage', () => {
      expect(formatProgressLabel(-5)).toBe('Not started');
    });

    test('Should return "Complete" for 100%', () => {
      expect(formatProgressLabel(100)).toBe('Complete');
    });

    test('Should return "Complete" for percentage above 100', () => {
      expect(formatProgressLabel(110)).toBe('Complete');
    });

    test('Should return "75% complete" for 75%', () => {
      expect(formatProgressLabel(75)).toBe('75% complete');
    });

    test('Should return "50% complete" for 50%', () => {
      expect(formatProgressLabel(50)).toBe('50% complete');
    });
  });

  describe('isComplete', () => {
    test('Should return false when totalLessons is 0', () => {
      expect(isComplete(0, 0)).toBe(false);
    });

    test('Should return false when totalLessons is negative', () => {
      expect(isComplete(5, -1)).toBe(false);
    });

    test('Should return false for partial progress', () => {
      expect(isComplete(3, 5)).toBe(false);
    });

    test('Should return true when all lessons are completed', () => {
      expect(isComplete(5, 5)).toBe(true);
    });

    test('Should return true when completedLessons exceeds totalLessons', () => {
      expect(isComplete(10, 5)).toBe(true);
    });
  });
});
