import { z } from 'zod';

export const ZCourseReview = z.object({
  rating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5'),
  reviewText: z
    .string()
    .min(10, 'Review text must be at least 10 characters')
    .max(1000, 'Review text must be at most 1000 characters'),
  courseId: z.string().uuid('Course ID must be a valid UUID')
});

export type TCourseReview = z.infer<typeof ZCourseReview>;

export const ZCourseReviewQuery = z.object({
  courseId: z.string().uuid('Course ID must be a valid UUID').optional(),
  page: z.number().int().positive('Page must be a positive number').default(1),
  limit: z.number().int().positive('Limit must be a positive number').default(10),
  sortBy: z.enum(['rating', 'createdAt', 'helpful']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export type TCourseReviewQuery = z.infer<typeof ZCourseReviewQuery>;
