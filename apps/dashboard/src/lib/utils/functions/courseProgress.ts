const clampPercentage = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

export function calculateCompletionPercentage(completedLessons: number, totalLessons: number) {
  // `!(x > 0)` also catches NaN
  if (!(totalLessons > 0) || !(completedLessons > 0)) return 0;

  return clampPercentage((completedLessons / totalLessons) * 100);
}

export function formatProgressLabel(percentage: number) {
  const value = Number.isNaN(percentage) ? 0 : clampPercentage(percentage);

  if (value === 0) return 'Not started';
  if (value === 100) return 'Complete';

  return `${value}% complete`;
}

export function isComplete(completedLessons: number, totalLessons: number) {
  return totalLessons > 0 && completedLessons >= totalLessons;
}
