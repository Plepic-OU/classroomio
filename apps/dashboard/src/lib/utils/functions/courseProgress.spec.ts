import {
  calculateCompletionPercentage,
  formatProgressLabel,
  isComplete
} from './courseProgress';

describe('courseProgress.ts', () => {
  describe('calculateCompletionPercentage', () => {
    test('Should return 0 when totalLessons is 0', () => {
      expect(calculateCompletionPercentage(0, 0)).toBe(0);
    });

    test('Should return 0 when totalLessons is negative', () => {
      expect(calculateCompletionPercentage(2, -5)).toBe(0);
    });

    test('Should return rounded percentage for partial progress', () => {
      expect(calculateCompletionPercentage(1, 4)).toBe(25);
      expect(calculateCompletionPercentage(3, 4)).toBe(75);
      expect(calculateCompletionPercentage(1, 3)).toBe(33);
    });

    test('Should return 100 when all lessons are completed', () => {
      expect(calculateCompletionPercentage(10, 10)).toBe(100);
    });

    test('Should cap at 100 when completedLessons exceeds totalLessons', () => {
      expect(calculateCompletionPercentage(15, 10)).toBe(100);
    });

    test('Should return 0 when completedLessons is negative', () => {
      expect(calculateCompletionPercentage(-3, 10)).toBe(0);
    });

    test('Should return 0 when completedLessons is NaN', () => {
      expect(calculateCompletionPercentage(NaN, 10)).toBe(0);
    });

    test('Should return 0 when totalLessons is NaN', () => {
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

    test('Should return "{n}% complete" for partial progress', () => {
      expect(formatProgressLabel(75)).toBe('75% complete');
      expect(formatProgressLabel(1)).toBe('1% complete');
      expect(formatProgressLabel(99)).toBe('99% complete');
    });
  });

  describe('isComplete', () => {
    test('Should return false when totalLessons is 0', () => {
      expect(isComplete(0, 0)).toBe(false);
    });

    test('Should return false for partial progress', () => {
      expect(isComplete(3, 10)).toBe(false);
    });

    test('Should return true when all lessons are completed', () => {
      expect(isComplete(10, 10)).toBe(true);
    });

    test('Should return true when completedLessons exceeds totalLessons', () => {
      expect(isComplete(12, 10)).toBe(true);
    });

    test('Should return false when totalLessons is negative', () => {
      expect(isComplete(5, -1)).toBe(false);
    });

    test('Should return false when completedLessons is NaN', () => {
      expect(isComplete(NaN, 10)).toBe(false);
    });

    test('Should return false when totalLessons is NaN', () => {
      expect(isComplete(10, NaN)).toBe(false);
    });
  });
});
