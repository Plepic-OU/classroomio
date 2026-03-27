import { describe, it, expect } from 'vitest';
import { courseReviewSchema, courseReviewQuerySchema } from './course-review';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('courseReviewSchema', () => {
  it('accepts valid input', () => {
    const result = courseReviewSchema.safeParse({
      rating: 3,
      reviewText: 'This is a valid review text.',
      courseId: VALID_UUID
    });
    expect(result.success).toBe(true);
  });

  it('rejects rating 0', () => {
    const result = courseReviewSchema.safeParse({
      rating: 0,
      reviewText: 'This is a valid review text.',
      courseId: VALID_UUID
    });
    expect(result.success).toBe(false);
  });

  it('rejects rating 6', () => {
    const result = courseReviewSchema.safeParse({
      rating: 6,
      reviewText: 'This is a valid review text.',
      courseId: VALID_UUID
    });
    expect(result.success).toBe(false);
  });

  it('rejects reviewText shorter than 10 chars', () => {
    const result = courseReviewSchema.safeParse({
      rating: 4,
      reviewText: 'Too short',
      courseId: VALID_UUID
    });
    expect(result.success).toBe(false);
  });

  it('rejects reviewText longer than 1000 chars', () => {
    const result = courseReviewSchema.safeParse({
      rating: 4,
      reviewText: 'a'.repeat(1001),
      courseId: VALID_UUID
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid UUID', () => {
    const result = courseReviewSchema.safeParse({
      rating: 4,
      reviewText: 'This is a valid review text.',
      courseId: 'not-a-uuid'
    });
    expect(result.success).toBe(false);
  });
});

describe('courseReviewQuerySchema', () => {
  it('accepts valid input with all fields', () => {
    const result = courseReviewQuerySchema.safeParse({
      courseId: VALID_UUID,
      page: 2,
      limit: 25,
      sortBy: 'highest'
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ courseId: VALID_UUID, page: 2, limit: 25, sortBy: 'highest' });
    }
  });

  it('applies defaults for optional fields', () => {
    const result = courseReviewQuerySchema.safeParse({ courseId: VALID_UUID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(10);
      expect(result.data.sortBy).toBe('newest');
    }
  });

  it('rejects invalid UUID', () => {
    const result = courseReviewQuerySchema.safeParse({ courseId: 'bad-id' });
    expect(result.success).toBe(false);
  });

  it('rejects limit greater than 50', () => {
    const result = courseReviewQuerySchema.safeParse({ courseId: VALID_UUID, limit: 51 });
    expect(result.success).toBe(false);
  });

  it('rejects page less than 1', () => {
    const result = courseReviewQuerySchema.safeParse({ courseId: VALID_UUID, page: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects invalid sortBy value', () => {
    const result = courseReviewQuerySchema.safeParse({ courseId: VALID_UUID, sortBy: 'random' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid sortBy values', () => {
    for (const sortBy of ['newest', 'oldest', 'highest', 'lowest'] as const) {
      const result = courseReviewQuerySchema.safeParse({ courseId: VALID_UUID, sortBy });
      expect(result.success).toBe(true);
    }
  });
});
