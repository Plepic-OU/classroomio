import { describe, it, expect } from 'vitest';
import { courseReviewSchema, courseReviewQuerySchema } from './course-review';

const validCourseId = '123e4567-e89b-12d3-a456-426614174000';

describe('courseReviewSchema', () => {
  it('accepts a valid review', () => {
    const result = courseReviewSchema.safeParse({
      rating: 4,
      reviewText: 'This is a great course.',
      courseId: validCourseId
    });
    expect(result.success).toBe(true);
  });

  it('rejects rating below 1', () => {
    const result = courseReviewSchema.safeParse({
      rating: 0,
      reviewText: 'This is a great course.',
      courseId: validCourseId
    });
    expect(result.success).toBe(false);
  });

  it('rejects rating above 5', () => {
    const result = courseReviewSchema.safeParse({
      rating: 6,
      reviewText: 'This is a great course.',
      courseId: validCourseId
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer rating', () => {
    const result = courseReviewSchema.safeParse({
      rating: 3.5,
      reviewText: 'This is a great course.',
      courseId: validCourseId
    });
    expect(result.success).toBe(false);
  });

  it('rejects reviewText shorter than 10 chars', () => {
    const result = courseReviewSchema.safeParse({
      rating: 4,
      reviewText: 'short',
      courseId: validCourseId
    });
    expect(result.success).toBe(false);
  });

  it('rejects reviewText longer than 1000 chars', () => {
    const result = courseReviewSchema.safeParse({
      rating: 4,
      reviewText: 'a'.repeat(1001),
      courseId: validCourseId
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid courseId UUID', () => {
    const result = courseReviewSchema.safeParse({
      rating: 4,
      reviewText: 'This is a great course.',
      courseId: 'not-a-uuid'
    });
    expect(result.success).toBe(false);
  });
});

describe('courseReviewQuerySchema', () => {
  it('accepts valid query params', () => {
    const result = courseReviewQuerySchema.safeParse({
      courseId: validCourseId,
      page: 2,
      limit: 20,
      sortBy: 'oldest'
    });
    expect(result.success).toBe(true);
  });

  it('applies defaults for optional fields', () => {
    const result = courseReviewQuerySchema.safeParse({ courseId: validCourseId });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(10);
      expect(result.data.sortBy).toBe('newest');
    }
  });

  it('rejects an invalid courseId UUID', () => {
    const result = courseReviewQuerySchema.safeParse({ courseId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-positive page', () => {
    const result = courseReviewQuerySchema.safeParse({ courseId: validCourseId, page: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects a limit above 50', () => {
    const result = courseReviewQuerySchema.safeParse({ courseId: validCourseId, limit: 51 });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid sortBy value', () => {
    const result = courseReviewQuerySchema.safeParse({
      courseId: validCourseId,
      sortBy: 'trending'
    });
    expect(result.success).toBe(false);
  });
});
