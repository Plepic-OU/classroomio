import { describe, it, expect } from 'vitest';
import { ZCourseReview, ZCourseReviewQuery } from './review';

describe('ZCourseReview', () => {
  describe('valid inputs', () => {
    it('should accept a valid review with rating 1', () => {
      const result = ZCourseReview.safeParse({
        rating: 1,
        reviewText: 'This course is bad',
        courseId: '123e4567-e89b-12d3-a456-426614174000'
      });
      expect(result.success).toBe(true);
    });

    it('should accept a valid review with rating 5', () => {
      const result = ZCourseReview.safeParse({
        rating: 5,
        reviewText: 'This course is excellent and well structured',
        courseId: '123e4567-e89b-12d3-a456-426614174000'
      });
      expect(result.success).toBe(true);
    });

    it('should accept a valid review with minimum review text length', () => {
      const result = ZCourseReview.safeParse({
        rating: 3,
        reviewText: '1234567890',
        courseId: '123e4567-e89b-12d3-a456-426614174000'
      });
      expect(result.success).toBe(true);
    });

    it('should accept a valid review with maximum review text length', () => {
      const result = ZCourseReview.safeParse({
        rating: 4,
        reviewText: 'a'.repeat(1000),
        courseId: '123e4567-e89b-12d3-a456-426614174000'
      });
      expect(result.success).toBe(true);
    });
  });

  describe('invalid rating', () => {
    it('should reject rating below 1', () => {
      const result = ZCourseReview.safeParse({
        rating: 0,
        reviewText: 'This course is okay',
        courseId: '123e4567-e89b-12d3-a456-426614174000'
      });
      expect(result.success).toBe(false);
    });

    it('should reject rating above 5', () => {
      const result = ZCourseReview.safeParse({
        rating: 6,
        reviewText: 'This course is great',
        courseId: '123e4567-e89b-12d3-a456-426614174000'
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer rating', () => {
      const result = ZCourseReview.safeParse({
        rating: 3.5,
        reviewText: 'This course is good',
        courseId: '123e4567-e89b-12d3-a456-426614174000'
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing rating', () => {
      const result = ZCourseReview.safeParse({
        reviewText: 'This course is okay',
        courseId: '123e4567-e89b-12d3-a456-426614174000'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('invalid review text', () => {
    it('should reject review text below 10 characters', () => {
      const result = ZCourseReview.safeParse({
        rating: 3,
        reviewText: '123456789',
        courseId: '123e4567-e89b-12d3-a456-426614174000'
      });
      expect(result.success).toBe(false);
    });

    it('should reject review text above 1000 characters', () => {
      const result = ZCourseReview.safeParse({
        rating: 3,
        reviewText: 'a'.repeat(1001),
        courseId: '123e4567-e89b-12d3-a456-426614174000'
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing review text', () => {
      const result = ZCourseReview.safeParse({
        rating: 3,
        courseId: '123e4567-e89b-12d3-a456-426614174000'
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty review text', () => {
      const result = ZCourseReview.safeParse({
        rating: 3,
        reviewText: '',
        courseId: '123e4567-e89b-12d3-a456-426614174000'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('invalid course ID', () => {
    it('should reject invalid UUID format', () => {
      const result = ZCourseReview.safeParse({
        rating: 3,
        reviewText: 'This course is okay',
        courseId: 'not-a-uuid'
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing course ID', () => {
      const result = ZCourseReview.safeParse({
        rating: 3,
        reviewText: 'This course is okay'
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty course ID', () => {
      const result = ZCourseReview.safeParse({
        rating: 3,
        reviewText: 'This course is okay',
        courseId: ''
      });
      expect(result.success).toBe(false);
    });

    it('should accept uppercase UUID', () => {
      const result = ZCourseReview.safeParse({
        rating: 3,
        reviewText: 'This course is okay',
        courseId: '123E4567-E89B-12D3-A456-426614174000'
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('ZCourseReviewQuery', () => {
  describe('valid inputs', () => {
    it('should accept query with all fields', () => {
      const result = ZCourseReviewQuery.safeParse({
        courseId: '123e4567-e89b-12d3-a456-426614174000',
        page: 1,
        limit: 20,
        sortBy: 'rating',
        sortOrder: 'desc'
      });
      expect(result.success).toBe(true);
    });

    it('should accept query with only courseId', () => {
      const result = ZCourseReviewQuery.safeParse({
        courseId: '123e4567-e89b-12d3-a456-426614174000'
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty query object', () => {
      const result = ZCourseReviewQuery.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should apply default values', () => {
      const result = ZCourseReviewQuery.safeParse({});
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(10);
        expect(result.data.sortBy).toBe('createdAt');
        expect(result.data.sortOrder).toBe('desc');
      }
    });

    it('should accept all valid sortBy values', () => {
      const validSortValues = ['rating', 'createdAt', 'helpful'];

      validSortValues.forEach((sortValue) => {
        const result = ZCourseReviewQuery.safeParse({
          sortBy: sortValue
        });
        expect(result.success).toBe(true);
      });
    });

    it('should accept all valid sortOrder values', () => {
      const validSortOrders = ['asc', 'desc'];

      validSortOrders.forEach((sortOrder) => {
        const result = ZCourseReviewQuery.safeParse({
          sortOrder: sortOrder
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('invalid course ID', () => {
    it('should reject invalid courseId UUID format', () => {
      const result = ZCourseReviewQuery.safeParse({
        courseId: 'invalid-uuid'
      });
      expect(result.success).toBe(false);
    });

    it('should accept undefined courseId (optional)', () => {
      const result = ZCourseReviewQuery.safeParse({
        courseId: undefined
      });
      expect(result.success).toBe(true);
    });
  });

  describe('invalid pagination', () => {
    it('should reject page 0', () => {
      const result = ZCourseReviewQuery.safeParse({
        page: 0
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative page', () => {
      const result = ZCourseReviewQuery.safeParse({
        page: -1
      });
      expect(result.success).toBe(false);
    });

    it('should reject limit 0', () => {
      const result = ZCourseReviewQuery.safeParse({
        limit: 0
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative limit', () => {
      const result = ZCourseReviewQuery.safeParse({
        limit: -10
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer page', () => {
      const result = ZCourseReviewQuery.safeParse({
        page: 1.5
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer limit', () => {
      const result = ZCourseReviewQuery.safeParse({
        limit: 10.5
      });
      expect(result.success).toBe(false);
    });
  });

  describe('invalid sort options', () => {
    it('should reject invalid sortBy value', () => {
      const result = ZCourseReviewQuery.safeParse({
        sortBy: 'invalid'
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid sortOrder value', () => {
      const result = ZCourseReviewQuery.safeParse({
        sortOrder: 'ascending'
      });
      expect(result.success).toBe(false);
    });
  });
});
