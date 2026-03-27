import { describe, it, expect } from 'vitest';
import { courseReviewSchema, courseReviewQuerySchema } from './course-review';

const validUUID = '550e8400-e29b-41d4-a716-446655440000';

describe('courseReviewSchema', () => {
  it('accepts valid input', () => {
    const result = courseReviewSchema.safeParse({
      rating: 4,
      reviewText: 'This is a great course with excellent content!',
      courseId: validUUID
    });
    expect(result.success).toBe(true);
  });

  it('rejects rating of 0', () => {
    const result = courseReviewSchema.safeParse({
      rating: 0,
      reviewText: 'This is a valid review text.',
      courseId: validUUID
    });
    expect(result.success).toBe(false);
  });

  it('rejects rating of 6', () => {
    const result = courseReviewSchema.safeParse({
      rating: 6,
      reviewText: 'This is a valid review text.',
      courseId: validUUID
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer rating', () => {
    const result = courseReviewSchema.safeParse({
      rating: 3.5,
      reviewText: 'This is a valid review text.',
      courseId: validUUID
    });
    expect(result.success).toBe(false);
  });

  it('rejects reviewText shorter than 10 characters', () => {
    const result = courseReviewSchema.safeParse({
      rating: 3,
      reviewText: 'Too short',
      courseId: validUUID
    });
    expect(result.success).toBe(false);
  });

  it('rejects reviewText longer than 1000 characters', () => {
    const result = courseReviewSchema.safeParse({
      rating: 3,
      reviewText: 'a'.repeat(1001),
      courseId: validUUID
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid UUID for courseId', () => {
    const result = courseReviewSchema.safeParse({
      rating: 3,
      reviewText: 'This is a valid review text.',
      courseId: 'not-a-uuid'
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const result = courseReviewSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('courseReviewQuerySchema', () => {
  it('accepts valid input with all fields', () => {
    const result = courseReviewQuerySchema.safeParse({
      courseId: validUUID,
      page: 2,
      limit: 20,
      sortBy: 'oldest'
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(20);
      expect(result.data.sortBy).toBe('oldest');
    }
  });

  it('applies defaults for optional fields', () => {
    const result = courseReviewQuerySchema.safeParse({
      courseId: validUUID
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(10);
      expect(result.data.sortBy).toBe('newest');
    }
  });

  it('rejects invalid UUID for courseId', () => {
    const result = courseReviewQuerySchema.safeParse({
      courseId: 'invalid'
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid sortBy value', () => {
    const result = courseReviewQuerySchema.safeParse({
      courseId: validUUID,
      sortBy: 'random'
    });
    expect(result.success).toBe(false);
  });

  it('rejects page less than 1', () => {
    const result = courseReviewQuerySchema.safeParse({
      courseId: validUUID,
      page: 0
    });
    expect(result.success).toBe(false);
  });

  it('rejects limit greater than 50', () => {
    const result = courseReviewQuerySchema.safeParse({
      courseId: validUUID,
      limit: 51
    });
    expect(result.success).toBe(false);
  });

  it('rejects limit less than 1', () => {
    const result = courseReviewQuerySchema.safeParse({
      courseId: validUUID,
      limit: 0
    });
    expect(result.success).toBe(false);
  });
});
