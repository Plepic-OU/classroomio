import { describe, it, expect } from 'vitest';
import { courseReviewSchema, courseReviewQuerySchema } from './course-review';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('courseReviewSchema', () => {
  const validInput = {
    rating: 3,
    reviewText: 'This is a valid review text.',
    courseId: VALID_UUID
  };

  it('accepts valid input', () => {
    expect(() => courseReviewSchema.parse(validInput)).not.toThrow();
  });

  it('rejects rating 0', () => {
    expect(() => courseReviewSchema.parse({ ...validInput, rating: 0 })).toThrow();
  });

  it('rejects rating 6', () => {
    expect(() => courseReviewSchema.parse({ ...validInput, rating: 6 })).toThrow();
  });

  it('rejects non-integer rating', () => {
    expect(() => courseReviewSchema.parse({ ...validInput, rating: 2.5 })).toThrow();
  });

  it('rejects reviewText shorter than 10 chars', () => {
    expect(() => courseReviewSchema.parse({ ...validInput, reviewText: 'Short' })).toThrow();
  });

  it('rejects reviewText longer than 1000 chars', () => {
    expect(() =>
      courseReviewSchema.parse({ ...validInput, reviewText: 'a'.repeat(1001) })
    ).toThrow();
  });

  it('accepts reviewText at boundary lengths', () => {
    expect(() =>
      courseReviewSchema.parse({ ...validInput, reviewText: 'a'.repeat(10) })
    ).not.toThrow();
    expect(() =>
      courseReviewSchema.parse({ ...validInput, reviewText: 'a'.repeat(1000) })
    ).not.toThrow();
  });

  it('rejects invalid UUID for courseId', () => {
    expect(() => courseReviewSchema.parse({ ...validInput, courseId: 'not-a-uuid' })).toThrow();
  });

  it('rejects missing required fields', () => {
    expect(() => courseReviewSchema.parse({})).toThrow();
  });
});

describe('courseReviewQuerySchema', () => {
  const validQuery = { courseId: VALID_UUID };

  it('accepts valid input with only required fields', () => {
    const result = courseReviewQuerySchema.parse(validQuery);
    expect(result.courseId).toBe(VALID_UUID);
  });

  it('applies default page of 1', () => {
    const result = courseReviewQuerySchema.parse(validQuery);
    expect(result.page).toBe(1);
  });

  it('applies default limit of 10', () => {
    const result = courseReviewQuerySchema.parse(validQuery);
    expect(result.limit).toBe(10);
  });

  it('applies default sortBy of newest', () => {
    const result = courseReviewQuerySchema.parse(validQuery);
    expect(result.sortBy).toBe('newest');
  });

  it('accepts valid optional fields', () => {
    const result = courseReviewQuerySchema.parse({
      ...validQuery,
      page: 2,
      limit: 25,
      sortBy: 'highest'
    });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(25);
    expect(result.sortBy).toBe('highest');
  });

  it('accepts all sortBy values', () => {
    for (const sortBy of ['newest', 'oldest', 'highest', 'lowest'] as const) {
      const result = courseReviewQuerySchema.parse({ ...validQuery, sortBy });
      expect(result.sortBy).toBe(sortBy);
    }
  });

  it('rejects invalid sortBy', () => {
    expect(() =>
      courseReviewQuerySchema.parse({ ...validQuery, sortBy: 'random' })
    ).toThrow();
  });

  it('rejects invalid UUID for courseId', () => {
    expect(() => courseReviewQuerySchema.parse({ courseId: 'not-a-uuid' })).toThrow();
  });

  it('rejects page less than 1', () => {
    expect(() => courseReviewQuerySchema.parse({ ...validQuery, page: 0 })).toThrow();
  });

  it('rejects limit of 0', () => {
    expect(() => courseReviewQuerySchema.parse({ ...validQuery, limit: 0 })).toThrow();
  });

  it('rejects limit greater than 50', () => {
    expect(() => courseReviewQuerySchema.parse({ ...validQuery, limit: 51 })).toThrow();
  });

  it('coerces string page to number', () => {
    const result = courseReviewQuerySchema.parse({ ...validQuery, page: '3' });
    expect(result.page).toBe(3);
  });
});
