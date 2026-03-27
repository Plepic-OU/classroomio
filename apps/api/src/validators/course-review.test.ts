import { describe, it, expect } from 'vitest';
import { courseReviewSchema, courseReviewQuerySchema } from './course-review';

const validUUID = '550e8400-e29b-41d4-a716-446655440000';

describe('courseReviewSchema', () => {
  it('accepts valid input', () => {
    const result = courseReviewSchema.parse({
      rating: 3,
      reviewText: 'This is a great course!',
      courseId: validUUID,
    });
    expect(result.rating).toBe(3);
    expect(result.reviewText).toBe('This is a great course!');
    expect(result.courseId).toBe(validUUID);
  });

  it('rejects rating of 0', () => {
    expect(() =>
      courseReviewSchema.parse({ rating: 0, reviewText: 'Valid review text', courseId: validUUID })
    ).toThrow();
  });

  it('rejects rating of 6', () => {
    expect(() =>
      courseReviewSchema.parse({ rating: 6, reviewText: 'Valid review text', courseId: validUUID })
    ).toThrow();
  });

  it('rejects non-integer rating', () => {
    expect(() =>
      courseReviewSchema.parse({ rating: 3.5, reviewText: 'Valid review text', courseId: validUUID })
    ).toThrow();
  });

  it('rejects reviewText shorter than 10 characters', () => {
    expect(() =>
      courseReviewSchema.parse({ rating: 3, reviewText: 'Short', courseId: validUUID })
    ).toThrow();
  });

  it('rejects reviewText longer than 1000 characters', () => {
    expect(() =>
      courseReviewSchema.parse({ rating: 3, reviewText: 'a'.repeat(1001), courseId: validUUID })
    ).toThrow();
  });

  it('rejects invalid UUID', () => {
    expect(() =>
      courseReviewSchema.parse({ rating: 3, reviewText: 'Valid review text', courseId: 'not-a-uuid' })
    ).toThrow();
  });
});

describe('courseReviewQuerySchema', () => {
  it('accepts valid input with all fields', () => {
    const result = courseReviewQuerySchema.parse({
      courseId: validUUID,
      page: 2,
      limit: 20,
      sortBy: 'oldest',
    });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(20);
    expect(result.sortBy).toBe('oldest');
  });

  it('applies defaults for optional fields', () => {
    const result = courseReviewQuerySchema.parse({ courseId: validUUID });
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.sortBy).toBe('newest');
  });

  it('rejects invalid UUID for courseId', () => {
    expect(() => courseReviewQuerySchema.parse({ courseId: 'bad' })).toThrow();
  });

  it('rejects invalid sortBy value', () => {
    expect(() =>
      courseReviewQuerySchema.parse({ courseId: validUUID, sortBy: 'random' })
    ).toThrow();
  });

  it('rejects page less than 1', () => {
    expect(() =>
      courseReviewQuerySchema.parse({ courseId: validUUID, page: 0 })
    ).toThrow();
  });

  it('rejects limit greater than 50', () => {
    expect(() =>
      courseReviewQuerySchema.parse({ courseId: validUUID, limit: 51 })
    ).toThrow();
  });
});
