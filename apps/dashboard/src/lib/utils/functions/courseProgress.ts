export function calculateCompletionPercentage(
  completedLessons: number,
  totalLessons: number
): number {
  if (!Number.isFinite(completedLessons) || !Number.isFinite(totalLessons)) return 0;
  if (totalLessons <= 0) return 0;
  if (completedLessons <= 0) return 0;
  if (completedLessons >= totalLessons) return 100;
  return Math.round((completedLessons / totalLessons) * 100);
}

export function formatProgressLabel(percentage: number): string {
  if (percentage === 0) return 'Not started';
  if (percentage === 100) return 'Complete';
  return `${percentage}% complete`;
}

export function isComplete(completedLessons: number, totalLessons: number): boolean {
  if (!Number.isFinite(completedLessons) || !Number.isFinite(totalLessons)) return false;
  if (totalLessons <= 0) return false;
  return completedLessons >= totalLessons;
}
