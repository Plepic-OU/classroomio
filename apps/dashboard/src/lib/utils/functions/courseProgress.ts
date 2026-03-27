export const calculateCompletionPercentage = (
  completedLessons: number,
  totalLessons: number
): number => {
  if (!Number.isFinite(totalLessons) || !Number.isFinite(completedLessons) || totalLessons <= 0) {
    return 0;
  }

  const percentage = (completedLessons / totalLessons) * 100;

  return Math.min(Math.round(Math.max(percentage, 0)), 100);
};

export const formatProgressLabel = (percentage: number): string => {
  if (percentage === 0) return 'Not started';
  if (percentage === 100) return 'Complete';
  return `${percentage}% complete`;
};

export const isComplete = (completedLessons: number, totalLessons: number): boolean => {
  if (totalLessons <= 0 || !Number.isFinite(totalLessons) || !Number.isFinite(completedLessons)) {
    return false;
  }

  return completedLessons >= totalLessons;
};
