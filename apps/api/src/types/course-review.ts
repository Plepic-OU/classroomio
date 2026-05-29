import { z } from 'zod';

export const ZCourseReview = z.object({
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().min(10).max(1000),
  courseId: z.string().uuid()
});

export type TCourseReview = z.infer<typeof ZCourseReview>;

export const ZCourseReviewQuery = z.object({
  courseId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sortBy: z.enum(['newest', 'oldest', 'highest', 'lowest']).default('newest')
});

export type TCourseReviewQuery = z.infer<typeof ZCourseReviewQuery>;
