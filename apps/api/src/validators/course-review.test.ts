import { describe, it, expect } from 'vitest';
import { courseReviewSchema, courseReviewQuerySchema } from './course-review';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('courseReviewSchema', () => {
  it('accepts a valid review', () => {
    const result = courseReviewSchema.parse({
      rating: 4,
      reviewText: 'This course was very helpful and well structured.',
      courseId: VALID_UUID
    });
    expect(result.rating).toBe(4);
  });

  it('rejects rating of 0', () => {
    expect(() =>
      courseReviewSchema.parse({ rating: 0, reviewText: 'Great course!!!!', courseId: VALID_UUID })
    ).toThrow();
  });

  it('rejects rating of 6', () => {
    expect(() =>
      courseReviewSchema.parse({ rating: 6, reviewText: 'Great course!!!!', courseId: VALID_UUID })
    ).toThrow();
  });

  it('rejects reviewText shorter than 10 characters', () => {
    expect(() =>
      courseReviewSchema.parse({ rating: 3, reviewText: 'Too short', courseId: VALID_UUID })
    ).toThrow();
  });

  it('rejects reviewText longer than 1000 characters', () => {
    expect(() =>
      courseReviewSchema.parse({ rating: 3, reviewText: 'a'.repeat(1001), courseId: VALID_UUID })
    ).toThrow();
  });

  it('accepts reviewText at boundary lengths (10 and 1000)', () => {
    expect(() =>
      courseReviewSchema.parse({ rating: 1, reviewText: 'a'.repeat(10), courseId: VALID_UUID })
    ).not.toThrow();
    expect(() =>
      courseReviewSchema.parse({ rating: 5, reviewText: 'a'.repeat(1000), courseId: VALID_UUID })
    ).not.toThrow();
  });

  it('rejects an invalid UUID for courseId', () => {
    expect(() =>
      courseReviewSchema.parse({ rating: 3, reviewText: 'Valid review text here.', courseId: 'not-a-uuid' })
    ).toThrow();
  });
});

describe('courseReviewQuerySchema', () => {
  it('accepts a valid query with all fields', () => {
    const result = courseReviewQuerySchema.parse({
      courseId: VALID_UUID,
      page: 2,
      limit: 25,
      sortBy: 'highest'
    });
    expect(result).toMatchObject({ courseId: VALID_UUID, page: 2, limit: 25, sortBy: 'highest' });
  });

  it('applies defaults for page, limit, and sortBy', () => {
    const result = courseReviewQuerySchema.parse({ courseId: VALID_UUID });
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.sortBy).toBe('newest');
  });

  it('coerces string page and limit to numbers', () => {
    const result = courseReviewQuerySchema.parse({ courseId: VALID_UUID, page: '3', limit: '5' });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(5);
  });

  it('rejects page less than 1', () => {
    expect(() =>
      courseReviewQuerySchema.parse({ courseId: VALID_UUID, page: 0 })
    ).toThrow();
  });

  it('rejects limit greater than 50', () => {
    expect(() =>
      courseReviewQuerySchema.parse({ courseId: VALID_UUID, limit: 51 })
    ).toThrow();
  });

  it('rejects an invalid UUID for courseId', () => {
    expect(() =>
      courseReviewQuerySchema.parse({ courseId: 'bad-id' })
    ).toThrow();
  });

  it('rejects invalid sortBy value', () => {
    expect(() =>
      courseReviewQuerySchema.parse({ courseId: VALID_UUID, sortBy: 'random' })
    ).toThrow();
  });

  it('accepts all valid sortBy values', () => {
    for (const sortBy of ['newest', 'oldest', 'highest', 'lowest'] as const) {
      expect(() =>
        courseReviewQuerySchema.parse({ courseId: VALID_UUID, sortBy })
      ).not.toThrow();
    }
  });
});
