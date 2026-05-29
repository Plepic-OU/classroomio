import { z } from 'zod';

export const courseReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().min(10).max(1000),
  courseId: z.string().uuid()
});

export type CourseReview = z.infer<typeof courseReviewSchema>;

export const courseReviewQuerySchema = z.object({
  courseId: z.string().uuid(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(50).default(10),
  sortBy: z.enum(['newest', 'oldest', 'highest', 'lowest']).default('newest')
});

export type CourseReviewQuery = z.infer<typeof courseReviewQuerySchema>;
