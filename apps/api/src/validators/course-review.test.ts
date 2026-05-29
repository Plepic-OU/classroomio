import { describe, it, expect } from 'vitest';

import { courseReviewQuerySchema, courseReviewSchema } from './course-review';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_REVIEW_TEXT = 'This course was thoroughly enjoyable.';

describe('courseReviewSchema', () => {
  it('accepts a valid review payload', () => {
    const result = courseReviewSchema.safeParse({
      rating: 4,
      reviewText: VALID_REVIEW_TEXT,
      courseId: VALID_UUID
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        rating: 4,
        reviewText: VALID_REVIEW_TEXT,
        courseId: VALID_UUID
      });
    }
  });

  it.each([0, -1, 6, 100])('rejects rating outside 1..5 (%s)', (rating) => {
    const result = courseReviewSchema.safeParse({
      rating,
      reviewText: VALID_REVIEW_TEXT,
      courseId: VALID_UUID
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer rating', () => {
    const result = courseReviewSchema.safeParse({
      rating: 3.5,
      reviewText: VALID_REVIEW_TEXT,
      courseId: VALID_UUID
    });
    expect(result.success).toBe(false);
  });

  it('rejects reviewText shorter than 10 characters', () => {
    const result = courseReviewSchema.safeParse({
      rating: 5,
      reviewText: 'too short',
      courseId: VALID_UUID
    });
    expect(result.success).toBe(false);
  });

  it('rejects reviewText longer than 1000 characters', () => {
    const result = courseReviewSchema.safeParse({
      rating: 5,
      reviewText: 'a'.repeat(1001),
      courseId: VALID_UUID
    });
    expect(result.success).toBe(false);
  });

  it('accepts reviewText at the 10 and 1000 character boundaries', () => {
    const min = courseReviewSchema.safeParse({
      rating: 5,
      reviewText: 'a'.repeat(10),
      courseId: VALID_UUID
    });
    const max = courseReviewSchema.safeParse({
      rating: 5,
      reviewText: 'a'.repeat(1000),
      courseId: VALID_UUID
    });

    expect(min.success).toBe(true);
    expect(max.success).toBe(true);
  });

  it('rejects an invalid courseId UUID', () => {
    const result = courseReviewSchema.safeParse({
      rating: 5,
      reviewText: VALID_REVIEW_TEXT,
      courseId: 'not-a-uuid'
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    expect(courseReviewSchema.safeParse({}).success).toBe(false);
    expect(
      courseReviewSchema.safeParse({ rating: 4, reviewText: VALID_REVIEW_TEXT }).success
    ).toBe(false);
  });
});

describe('courseReviewQuerySchema', () => {
  it('applies defaults when only courseId is provided', () => {
    const result = courseReviewQuerySchema.parse({ courseId: VALID_UUID });

    expect(result).toEqual({
      courseId: VALID_UUID,
      page: 1,
      limit: 10,
      sortBy: 'newest'
    });
  });

  it('accepts a fully populated query', () => {
    const result = courseReviewQuerySchema.safeParse({
      courseId: VALID_UUID,
      page: 3,
      limit: 25,
      sortBy: 'highest'
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        courseId: VALID_UUID,
        page: 3,
        limit: 25,
        sortBy: 'highest'
      });
    }
  });

  it('rejects an invalid courseId UUID', () => {
    const result = courseReviewQuerySchema.safeParse({ courseId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it.each([0, -1, 1.5])('rejects non-positive / non-integer page (%s)', (page) => {
    const result = courseReviewQuerySchema.safeParse({ courseId: VALID_UUID, page });
    expect(result.success).toBe(false);
  });

  it.each([0, 51, 100, 2.5])('rejects out-of-range / non-integer limit (%s)', (limit) => {
    const result = courseReviewQuerySchema.safeParse({ courseId: VALID_UUID, limit });
    expect(result.success).toBe(false);
  });

  it.each(['newest', 'oldest', 'highest', 'lowest'] as const)(
    'accepts sortBy value %s',
    (sortBy) => {
      const result = courseReviewQuerySchema.safeParse({ courseId: VALID_UUID, sortBy });
      expect(result.success).toBe(true);
    }
  );

  it.each(['', 'NEWEST', 'best', 'random'])('rejects invalid sortBy (%s)', (sortBy) => {
    const result = courseReviewQuerySchema.safeParse({ courseId: VALID_UUID, sortBy });
    expect(result.success).toBe(false);
  });
});
