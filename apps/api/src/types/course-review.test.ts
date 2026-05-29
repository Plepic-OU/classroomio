import { ZCourseReview, ZCourseReviewQuery } from './course-review';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('ZCourseReview', () => {
  const valid = {
    rating: 3,
    reviewText: 'This course was genuinely helpful.',
    courseId: VALID_UUID
  };

  it('accepts valid input', () => {
    expect(ZCourseReview.safeParse(valid).success).toBe(true);
  });

  describe('rating', () => {
    it('accepts boundary values 1 and 5', () => {
      expect(ZCourseReview.safeParse({ ...valid, rating: 1 }).success).toBe(true);
      expect(ZCourseReview.safeParse({ ...valid, rating: 5 }).success).toBe(true);
    });

    it('rejects 0', () => {
      expect(ZCourseReview.safeParse({ ...valid, rating: 0 }).success).toBe(false);
    });

    it('rejects 6', () => {
      expect(ZCourseReview.safeParse({ ...valid, rating: 6 }).success).toBe(false);
    });

    it('rejects non-integer', () => {
      expect(ZCourseReview.safeParse({ ...valid, rating: 3.5 }).success).toBe(false);
    });
  });

  describe('reviewText', () => {
    it('accepts text at 10-character boundary', () => {
      expect(ZCourseReview.safeParse({ ...valid, reviewText: 'a'.repeat(10) }).success).toBe(true);
    });

    it('accepts text at 1000-character boundary', () => {
      expect(ZCourseReview.safeParse({ ...valid, reviewText: 'a'.repeat(1000) }).success).toBe(true);
    });

    it('rejects text shorter than 10 characters', () => {
      expect(ZCourseReview.safeParse({ ...valid, reviewText: 'Too short' }).success).toBe(false);
    });

    it('rejects text longer than 1000 characters', () => {
      expect(ZCourseReview.safeParse({ ...valid, reviewText: 'a'.repeat(1001) }).success).toBe(false);
    });
  });

  describe('courseId', () => {
    it('rejects a non-UUID string', () => {
      expect(ZCourseReview.safeParse({ ...valid, courseId: 'not-a-uuid' }).success).toBe(false);
    });
  });
});

describe('ZCourseReviewQuery', () => {
  const valid = { courseId: VALID_UUID };

  it('accepts valid input with only required field', () => {
    expect(ZCourseReviewQuery.safeParse(valid).success).toBe(true);
  });

  it('applies defaults for page, limit, and sortBy', () => {
    const result = ZCourseReviewQuery.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(10);
      expect(result.data.sortBy).toBe('newest');
    }
  });

  describe('courseId', () => {
    it('rejects a non-UUID string', () => {
      expect(ZCourseReviewQuery.safeParse({ ...valid, courseId: 'bad-id' }).success).toBe(false);
    });
  });

  describe('page', () => {
    it('coerces a string to a number', () => {
      const result = ZCourseReviewQuery.safeParse({ ...valid, page: '3' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.page).toBe(3);
    });

    it('rejects page less than 1', () => {
      expect(ZCourseReviewQuery.safeParse({ ...valid, page: 0 }).success).toBe(false);
    });
  });

  describe('limit', () => {
    it('accepts boundary values 1 and 50', () => {
      expect(ZCourseReviewQuery.safeParse({ ...valid, limit: 1 }).success).toBe(true);
      expect(ZCourseReviewQuery.safeParse({ ...valid, limit: 50 }).success).toBe(true);
    });

    it('rejects limit less than 1', () => {
      expect(ZCourseReviewQuery.safeParse({ ...valid, limit: 0 }).success).toBe(false);
    });

    it('rejects limit greater than 50', () => {
      expect(ZCourseReviewQuery.safeParse({ ...valid, limit: 51 }).success).toBe(false);
    });

    it('coerces a string to a number', () => {
      const result = ZCourseReviewQuery.safeParse({ ...valid, limit: '25' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.limit).toBe(25);
    });
  });

  describe('sortBy', () => {
    it('accepts all valid values', () => {
      for (const value of ['newest', 'oldest', 'highest', 'lowest'] as const) {
        expect(ZCourseReviewQuery.safeParse({ ...valid, sortBy: value }).success).toBe(true);
      }
    });

    it('rejects an invalid sortBy value', () => {
      expect(ZCourseReviewQuery.safeParse({ ...valid, sortBy: 'random' }).success).toBe(false);
    });
  });
});
