export function calculateCompletionPercentage(
  completedLessons: number,
  totalLessons: number
): number {
  if (!(totalLessons > 0)) return 0;

  const completed = Number(completedLessons);
  if (Number.isNaN(completed) || completed <= 0) return 0;

  const percentage = (Math.min(completed, totalLessons) / totalLessons) * 100;

  return Math.round(percentage);
}

export function formatProgressLabel(percentage: number): string {
  if (percentage >= 100) return 'Complete';
  if (!(percentage > 0)) return 'Not started';

  return `${percentage}% complete`;
}

export function isComplete(completedLessons: number, totalLessons: number): boolean {
  if (!(totalLessons > 0)) return false;

  const completed = Number(completedLessons);
  if (Number.isNaN(completed)) return false;

  return completed >= totalLessons;
}
