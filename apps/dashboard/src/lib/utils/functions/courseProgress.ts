export function calculateCompletionPercentage(completedLessons: number, totalLessons: number): number {
  if (!Number.isFinite(totalLessons) || totalLessons <= 0) return 0;
  if (!Number.isFinite(completedLessons) || completedLessons <= 0) return 0;
  return Math.min(100, Math.round((completedLessons / totalLessons) * 100));
}

export function formatProgressLabel(percentage: number): string {
  if (percentage <= 0) return 'Not started';
  if (percentage >= 100) return 'Complete';
  return `${percentage}% complete`;
}

export function isComplete(completedLessons: number, totalLessons: number): boolean {
  if (!Number.isFinite(totalLessons) || totalLessons <= 0) return false;
  return completedLessons >= totalLessons;
}
