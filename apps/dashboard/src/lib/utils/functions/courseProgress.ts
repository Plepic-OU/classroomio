export function calculateCompletionPercentage(
  completedLessons: number,
  totalLessons: number
): number {
  if (!Number.isFinite(totalLessons) || !Number.isFinite(completedLessons) || totalLessons <= 0) {
    return 0;
  }

  const percentage = (completedLessons / totalLessons) * 100;

  if (percentage >= 100) return 100;
  if (percentage <= 0) return 0;

  return Math.round(percentage);
}

export function formatProgressLabel(percentage: number): string {
  if (percentage === 0) return 'Not started';
  if (percentage === 100) return 'Complete';
  return `${percentage}% complete`;
}

export function isComplete(completedLessons: number, totalLessons: number): boolean {
  if (!Number.isFinite(totalLessons) || !Number.isFinite(completedLessons) || totalLessons <= 0) {
    return false;
  }

  return completedLessons >= totalLessons;
}
