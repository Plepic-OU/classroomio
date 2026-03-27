import { describe, it, expect } from 'vitest';
import { courseReviewSchema, courseReviewQuerySchema } from './course-review';

const validUUID = '550e8400-e29b-41d4-a716-446655440000';

describe('courseReviewSchema', () => {
  const validReview = {
    rating: 4,
    reviewText: 'This is a great course with excellent content.',
    courseId: validUUID,
  };

  it('accepts valid input', () => {
    const result = courseReviewSchema.safeParse(validReview);
    expect(result.success).toBe(true);
  });

  it('accepts rating 1 and 5', () => {
    expect(courseReviewSchema.safeParse({ ...validReview, rating: 1 }).success).toBe(true);
    expect(courseReviewSchema.safeParse({ ...validReview, rating: 5 }).success).toBe(true);
  });

  it('rejects rating 0', () => {
    const result = courseReviewSchema.safeParse({ ...validReview, rating: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects rating 6', () => {
    const result = courseReviewSchema.safeParse({ ...validReview, rating: 6 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer rating', () => {
    const result = courseReviewSchema.safeParse({ ...validReview, rating: 3.5 });
    expect(result.success).toBe(false);
  });

  it('rejects reviewText shorter than 10 chars', () => {
    const result = courseReviewSchema.safeParse({ ...validReview, reviewText: 'Too short' });
    expect(result.success).toBe(false);
  });

  it('rejects reviewText longer than 1000 chars', () => {
    const result = courseReviewSchema.safeParse({ ...validReview, reviewText: 'a'.repeat(1001) });
    expect(result.success).toBe(false);
  });

  it('rejects invalid UUID for courseId', () => {
    const result = courseReviewSchema.safeParse({ ...validReview, courseId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    expect(courseReviewSchema.safeParse({}).success).toBe(false);
    expect(courseReviewSchema.safeParse({ rating: 3 }).success).toBe(false);
    expect(courseReviewSchema.safeParse({ reviewText: 'some review text here' }).success).toBe(false);
  });
});

describe('courseReviewQuerySchema', () => {
  it('accepts valid input with all fields', () => {
    const result = courseReviewQuerySchema.safeParse({
      courseId: validUUID,
      page: 2,
      limit: 20,
      sortBy: 'oldest',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(20);
      expect(result.data.sortBy).toBe('oldest');
    }
  });

  it('applies defaults for optional fields', () => {
    const result = courseReviewQuerySchema.safeParse({ courseId: validUUID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(10);
      expect(result.data.sortBy).toBe('newest');
    }
  });

  it('rejects invalid UUID for courseId', () => {
    const result = courseReviewQuerySchema.safeParse({ courseId: 'bad-id' });
    expect(result.success).toBe(false);
  });

  it('rejects page less than 1', () => {
    const result = courseReviewQuerySchema.safeParse({ courseId: validUUID, page: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects limit greater than 50', () => {
    const result = courseReviewQuerySchema.safeParse({ courseId: validUUID, limit: 51 });
    expect(result.success).toBe(false);
  });

  it('rejects limit less than 1', () => {
    const result = courseReviewQuerySchema.safeParse({ courseId: validUUID, limit: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects invalid sortBy value', () => {
    const result = courseReviewQuerySchema.safeParse({ courseId: validUUID, sortBy: 'random' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid sortBy values', () => {
    for (const sortBy of ['newest', 'oldest', 'highest', 'lowest']) {
      const result = courseReviewQuerySchema.safeParse({ courseId: validUUID, sortBy });
      expect(result.success).toBe(true);
    }
  });
});
