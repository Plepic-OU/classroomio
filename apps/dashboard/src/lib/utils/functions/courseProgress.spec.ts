import { calculateCompletionPercentage, formatProgressLabel, isComplete } from './courseProgress';

describe('courseProgress.ts', () => {
  describe('calculateCompletionPercentage', () => {
    test('Returns 0 when totalLessons is 0', () => {
      expect(calculateCompletionPercentage(0, 0)).toBe(0);
    });

    test('Returns 0 when totalLessons is negative', () => {
      expect(calculateCompletionPercentage(5, -1)).toBe(0);
    });

    test('Returns 0 when completedLessons is NaN', () => {
      expect(calculateCompletionPercentage(NaN, 10)).toBe(0);
    });

    test('Returns 0 when totalLessons is NaN', () => {
      expect(calculateCompletionPercentage(5, NaN)).toBe(0);
    });

    test('Returns correct percentage for partial progress', () => {
      expect(calculateCompletionPercentage(3, 4)).toBe(75);
    });

    test('Returns 100 for full completion', () => {
      expect(calculateCompletionPercentage(10, 10)).toBe(100);
    });

    test('Clamps to 100 when completedLessons exceeds totalLessons', () => {
      expect(calculateCompletionPercentage(12, 10)).toBe(100);
    });

    test('Rounds to nearest integer', () => {
      expect(calculateCompletionPercentage(1, 3)).toBe(33);
    });
  });

  describe('formatProgressLabel', () => {
    test('Returns "Not started" for 0%', () => {
      expect(formatProgressLabel(0)).toBe('Not started');
    });

    test('Returns "Not started" for negative percentage', () => {
      expect(formatProgressLabel(-5)).toBe('Not started');
    });

    test('Returns percentage label for partial progress', () => {
      expect(formatProgressLabel(75)).toBe('75% complete');
    });

    test('Returns "Complete" for 100%', () => {
      expect(formatProgressLabel(100)).toBe('Complete');
    });
  });

  describe('isComplete', () => {
    test('Returns false when totalLessons is 0', () => {
      expect(isComplete(0, 0)).toBe(false);
    });

    test('Returns false when totalLessons is negative', () => {
      expect(isComplete(5, -1)).toBe(false);
    });

    test('Returns false when completedLessons is NaN', () => {
      expect(isComplete(NaN, 10)).toBe(false);
    });

    test('Returns false when totalLessons is NaN', () => {
      expect(isComplete(5, NaN)).toBe(false);
    });

    test('Returns false for partial progress', () => {
      expect(isComplete(3, 10)).toBe(false);
    });

    test('Returns true when all lessons are completed', () => {
      expect(isComplete(10, 10)).toBe(true);
    });

    test('Returns true when completedLessons exceeds totalLessons', () => {
      expect(isComplete(12, 10)).toBe(true);
    });
  });
});
