export function calculateCompletionPercentage(completedLessons: number, totalLessons: number): number {
  if (!totalLessons || totalLessons <= 0 || isNaN(totalLessons) || isNaN(completedLessons)) return 0;
  return Math.min(100, Math.round((completedLessons / totalLessons) * 100));
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
