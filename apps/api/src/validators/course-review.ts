import { z } from 'zod';

export const courseReviewSchema = z.object({
  rating: z.int().min(1).max(5),
  reviewText: z.string().min(10).max(1000),
  courseId: z.uuid(),
});

export const courseReviewQuerySchema = z.object({
  courseId: z.uuid(),
  page: z.int().min(1).optional().default(1),
  limit: z.int().min(1).max(50).optional().default(10),
  sortBy: z.enum(['newest', 'oldest', 'highest', 'lowest']).optional().default('newest'),
});

export type CourseReview = z.infer<typeof courseReviewSchema>;
export type CourseReviewQuery = z.infer<typeof courseReviewQuerySchema>;
