import { z } from 'zod';

export const courseReviewSchema = z.object({
  rating: z.int().min(1).max(5),
  reviewText: z.string().min(10).max(1000),
  courseId: z.string().uuid()
});

export type CourseReview = z.infer<typeof courseReviewSchema>;

export const courseReviewQuerySchema = z.object({
  courseId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10).optional(),
  sortBy: z.enum(['newest', 'oldest', 'highest', 'lowest']).default('newest').optional()
});

export type CourseReviewQuery = z.infer<typeof courseReviewQuerySchema>;
