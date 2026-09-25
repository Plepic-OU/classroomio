import { z } from 'zod';

export const courseReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().min(10).max(1000),
  courseId: z.uuid()
});

export type CourseReview = z.infer<typeof courseReviewSchema>;

// Query params arrive as strings, so numeric fields are coerced
export const courseReviewQuerySchema = z.object({
  courseId: z.uuid(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sortBy: z.enum(['newest', 'oldest', 'highest', 'lowest']).default('newest')
});

export type CourseReviewQuery = z.infer<typeof courseReviewQuerySchema>;
