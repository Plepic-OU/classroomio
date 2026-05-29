export const calculateCompletionPercentage = (completedLessons: number, totalLessons: number): number => {
  if (!Number.isFinite(completedLessons) || !Number.isFinite(totalLessons)) return 0;
  if (totalLessons <= 0) return 0;
  if (completedLessons > totalLessons) return 100;

  const percentage = (completedLessons / totalLessons) * 100;
  return Math.round(percentage);
};

export const formatProgressLabel = (percentage: number): string => {
  if (percentage === 0) return 'Not started';
  if (percentage === 100) return 'Complete';
  return `${percentage}% complete`;
};

export const isComplete = (completedLessons: number, totalLessons: number): boolean => {
  if (!Number.isFinite(completedLessons) || !Number.isFinite(totalLessons)) return false;
  if (totalLessons <= 0) return false;
  return completedLessons >= totalLessons;
};
