import { describe, expect, it } from 'vitest';
import { courseReviewQuerySchema, courseReviewSchema } from './course-review';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('courseReviewSchema', () => {
  it('accepts valid input', () => {
    const result = courseReviewSchema.safeParse({
      rating: 3,
      reviewText: 'This course was helpful.',
      courseId: VALID_UUID
    });
    expect(result.success).toBe(true);
  });

  it('accepts boundary ratings 1 and 5', () => {
    expect(courseReviewSchema.safeParse({ rating: 1, reviewText: 'Short review ok.', courseId: VALID_UUID }).success).toBe(true);
    expect(courseReviewSchema.safeParse({ rating: 5, reviewText: 'Short review ok.', courseId: VALID_UUID }).success).toBe(true);
  });

  it('rejects rating 0', () => {
    const result = courseReviewSchema.safeParse({ rating: 0, reviewText: 'Some review text here.', courseId: VALID_UUID });
    expect(result.success).toBe(false);
  });

  it('rejects rating 6', () => {
    const result = courseReviewSchema.safeParse({ rating: 6, reviewText: 'Some review text here.', courseId: VALID_UUID });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer rating', () => {
    const result = courseReviewSchema.safeParse({ rating: 3.5, reviewText: 'Some review text here.', courseId: VALID_UUID });
    expect(result.success).toBe(false);
  });

  it('rejects reviewText shorter than 10 chars', () => {
    const result = courseReviewSchema.safeParse({ rating: 3, reviewText: 'Too short', courseId: VALID_UUID });
    expect(result.success).toBe(false);
  });

  it('rejects reviewText longer than 1000 chars', () => {
    const result = courseReviewSchema.safeParse({ rating: 3, reviewText: 'a'.repeat(1001), courseId: VALID_UUID });
    expect(result.success).toBe(false);
  });

  it('accepts reviewText at exactly 10 and 1000 chars', () => {
    expect(courseReviewSchema.safeParse({ rating: 3, reviewText: 'a'.repeat(10), courseId: VALID_UUID }).success).toBe(true);
    expect(courseReviewSchema.safeParse({ rating: 3, reviewText: 'a'.repeat(1000), courseId: VALID_UUID }).success).toBe(true);
  });

  it('rejects invalid UUID for courseId', () => {
    const result = courseReviewSchema.safeParse({ rating: 3, reviewText: 'Some review text here.', courseId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    expect(courseReviewSchema.safeParse({}).success).toBe(false);
    expect(courseReviewSchema.safeParse({ rating: 3 }).success).toBe(false);
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
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(25);
      expect(result.data.sortBy).toBe('highest');
    }
  });

  it('applies default page=1 when omitted', () => {
    const result = courseReviewQuerySchema.safeParse({ courseId: VALID_UUID });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.page).toBe(1);
  });

  it('applies default limit=10 when omitted', () => {
    const result = courseReviewQuerySchema.safeParse({ courseId: VALID_UUID });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(10);
  });

  it('applies default sortBy="newest" when omitted', () => {
    const result = courseReviewQuerySchema.safeParse({ courseId: VALID_UUID });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.sortBy).toBe('newest');
  });

  it('coerces string page and limit to numbers', () => {
    const result = courseReviewQuerySchema.safeParse({ courseId: VALID_UUID, page: '3', limit: '20' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.limit).toBe(20);
    }
  });

  it('rejects invalid UUID for courseId', () => {
    const result = courseReviewQuerySchema.safeParse({ courseId: 'bad-id' });
    expect(result.success).toBe(false);
  });

  it('rejects page less than 1', () => {
    const result = courseReviewQuerySchema.safeParse({ courseId: VALID_UUID, page: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects limit greater than 50', () => {
    const result = courseReviewQuerySchema.safeParse({ courseId: VALID_UUID, limit: 51 });
    expect(result.success).toBe(false);
  });

  it('rejects limit less than 1', () => {
    const result = courseReviewQuerySchema.safeParse({ courseId: VALID_UUID, limit: 0 });
    expect(result.success).toBe(false);
  });

  it('accepts all valid sortBy values', () => {
    for (const sortBy of ['newest', 'oldest', 'highest', 'lowest'] as const) {
      const result = courseReviewQuerySchema.safeParse({ courseId: VALID_UUID, sortBy });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid sortBy value', () => {
    const result = courseReviewQuerySchema.safeParse({ courseId: VALID_UUID, sortBy: 'random' });
    expect(result.success).toBe(false);
  });

  it('rejects missing courseId', () => {
    const result = courseReviewQuerySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
