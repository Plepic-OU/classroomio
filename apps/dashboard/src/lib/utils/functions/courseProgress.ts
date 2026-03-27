export function calculateCompletionPercentage(completedLessons: number, totalLessons: number): number {
  if (!totalLessons || totalLessons <= 0 || isNaN(completedLessons) || isNaN(totalLessons)) return 0;
  return Math.round(Math.min(completedLessons / totalLessons, 1) * 100);
}

export function formatProgressLabel(percentage: number): string {
  if (percentage <= 0) return 'Not started';
  if (percentage >= 100) return 'Complete';
  return `${percentage}% complete`;
}

export function isComplete(completedLessons: number, totalLessons: number): boolean {
  if (!totalLessons || totalLessons <= 0) return false;
  return completedLessons >= totalLessons;
}
