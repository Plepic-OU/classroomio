import { describe, expect, it } from 'vitest';

import { courseReviewQuerySchema, courseReviewSchema } from './course-review';

const courseId = '3f2b8c1e-4d5a-4b6c-9e7f-0a1b2c3d4e5f';

describe('courseReviewSchema', () => {
  const validReview = {
    rating: 4,
    reviewText: 'Great course, learned a lot.',
    courseId
  };

  it('accepts a valid review', () => {
    expect(courseReviewSchema.parse(validReview)).toEqual(validReview);
  });

  it.each([1, 5])('accepts boundary rating %i', (rating) => {
    expect(courseReviewSchema.safeParse({ ...validReview, rating }).success).toBe(true);
  });

  it.each([0, 6])('rejects rating %i', (rating) => {
    expect(courseReviewSchema.safeParse({ ...validReview, rating }).success).toBe(false);
  });

  it('rejects a non-integer rating', () => {
    expect(courseReviewSchema.safeParse({ ...validReview, rating: 3.5 }).success).toBe(false);
  });

  it('accepts reviewText at the length boundaries', () => {
    expect(
      courseReviewSchema.safeParse({ ...validReview, reviewText: 'a'.repeat(10) }).success
    ).toBe(true);
    expect(
      courseReviewSchema.safeParse({ ...validReview, reviewText: 'a'.repeat(1000) }).success
    ).toBe(true);
  });

  it('rejects reviewText that is too short', () => {
    expect(
      courseReviewSchema.safeParse({ ...validReview, reviewText: 'a'.repeat(9) }).success
    ).toBe(false);
  });

  it('rejects reviewText that is too long', () => {
    expect(
      courseReviewSchema.safeParse({ ...validReview, reviewText: 'a'.repeat(1001) }).success
    ).toBe(false);
  });

  it('rejects an invalid courseId', () => {
    expect(courseReviewSchema.safeParse({ ...validReview, courseId: 'not-a-uuid' }).success).toBe(
      false
    );
  });

  it.each(['rating', 'reviewText', 'courseId'])('rejects a missing %s', (field) => {
    const { [field as keyof typeof validReview]: _, ...rest } = validReview;
    expect(courseReviewSchema.safeParse(rest).success).toBe(false);
  });
});

describe('courseReviewQuerySchema', () => {
  it('applies defaults for optional fields', () => {
    expect(courseReviewQuerySchema.parse({ courseId })).toEqual({
      courseId,
      page: 1,
      limit: 10,
      sortBy: 'newest'
    });
  });

  it('accepts explicit valid values', () => {
    expect(
      courseReviewQuerySchema.parse({ courseId, page: 3, limit: 50, sortBy: 'highest' })
    ).toEqual({ courseId, page: 3, limit: 50, sortBy: 'highest' });
  });

  it('coerces string query params to numbers', () => {
    expect(courseReviewQuerySchema.parse({ courseId, page: '2', limit: '25' })).toMatchObject({
      page: 2,
      limit: 25
    });
  });

  it.each(['newest', 'oldest', 'highest', 'lowest'])('accepts sortBy %s', (sortBy) => {
    expect(courseReviewQuerySchema.safeParse({ courseId, sortBy }).success).toBe(true);
  });

  it('rejects an invalid sortBy', () => {
    expect(courseReviewQuerySchema.safeParse({ courseId, sortBy: 'popular' }).success).toBe(false);
  });

  it('rejects an invalid courseId', () => {
    expect(courseReviewQuerySchema.safeParse({ courseId: '1234' }).success).toBe(false);
  });

  it('rejects a missing courseId', () => {
    expect(courseReviewQuerySchema.safeParse({}).success).toBe(false);
  });

  it.each([0, -1, 1.5])('rejects page %s', (page) => {
    expect(courseReviewQuerySchema.safeParse({ courseId, page }).success).toBe(false);
  });

  it.each([0, 51])('rejects limit %i', (limit) => {
    expect(courseReviewQuerySchema.safeParse({ courseId, limit }).success).toBe(false);
  });
});
