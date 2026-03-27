import { describe, it, expect } from 'vitest';
import { canAccessFeature, getFeatureLimit } from './feature-access';

describe('canAccessFeature', () => {
  describe('free plan', () => {
    it('allows certificates', () => expect(canAccessFeature('free', 'certificates')).toBe(true));
    it('allows community', () => expect(canAccessFeature('free', 'community')).toBe(true));
    it('allows max_courses (limit > 0)', () => expect(canAccessFeature('free', 'max_courses')).toBe(true));
    it('allows max_students (limit > 0)', () => expect(canAccessFeature('free', 'max_students')).toBe(true));
    it('denies custom_domain', () => expect(canAccessFeature('free', 'custom_domain')).toBe(false));
    it('denies analytics', () => expect(canAccessFeature('free', 'analytics')).toBe(false));
    it('denies api_access', () => expect(canAccessFeature('free', 'api_access')).toBe(false));
  });

  describe('basic plan', () => {
    it('allows analytics', () => expect(canAccessFeature('basic', 'analytics')).toBe(true));
    it('allows certificates', () => expect(canAccessFeature('basic', 'certificates')).toBe(true));
    it('allows community', () => expect(canAccessFeature('basic', 'community')).toBe(true));
    it('allows max_courses', () => expect(canAccessFeature('basic', 'max_courses')).toBe(true));
    it('allows max_students', () => expect(canAccessFeature('basic', 'max_students')).toBe(true));
    it('denies custom_domain', () => expect(canAccessFeature('basic', 'custom_domain')).toBe(false));
    it('denies api_access', () => expect(canAccessFeature('basic', 'api_access')).toBe(false));
  });

  describe('pro plan', () => {
    it('allows all features', () => {
      const features = ['max_courses', 'max_students', 'custom_domain', 'analytics', 'certificates', 'community', 'api_access'] as const;
      for (const f of features) {
        expect(canAccessFeature('pro', f)).toBe(true);
      }
    });
  });

  describe('unknown plan defaults to free', () => {
    it('denies custom_domain for unknown plan', () => expect(canAccessFeature('enterprise', 'custom_domain')).toBe(false));
    it('denies analytics for unknown plan', () => expect(canAccessFeature('unknown', 'analytics')).toBe(false));
    it('allows certificates for unknown plan', () => expect(canAccessFeature('unknown', 'certificates')).toBe(true));
    it('is case-insensitive', () => expect(canAccessFeature('FREE', 'certificates')).toBe(true));
    it('is case-insensitive for basic', () => expect(canAccessFeature('BASIC', 'analytics')).toBe(true));
    it('is case-insensitive for pro', () => expect(canAccessFeature('PRO', 'api_access')).toBe(true));
  });
});

describe('getFeatureLimit', () => {
  describe('free plan', () => {
    it('returns 3 for max_courses', () => expect(getFeatureLimit('free', 'max_courses')).toBe(3));
    it('returns 30 for max_students', () => expect(getFeatureLimit('free', 'max_students')).toBe(30));
    it('returns false for custom_domain', () => expect(getFeatureLimit('free', 'custom_domain')).toBe(false));
    it('returns false for analytics', () => expect(getFeatureLimit('free', 'analytics')).toBe(false));
    it('returns true for certificates', () => expect(getFeatureLimit('free', 'certificates')).toBe(true));
    it('returns true for community', () => expect(getFeatureLimit('free', 'community')).toBe(true));
    it('returns false for api_access', () => expect(getFeatureLimit('free', 'api_access')).toBe(false));
  });

  describe('basic plan', () => {
    it('returns 25 for max_courses', () => expect(getFeatureLimit('basic', 'max_courses')).toBe(25));
    it('returns 200 for max_students', () => expect(getFeatureLimit('basic', 'max_students')).toBe(200));
    it('returns false for custom_domain', () => expect(getFeatureLimit('basic', 'custom_domain')).toBe(false));
    it('returns true for analytics', () => expect(getFeatureLimit('basic', 'analytics')).toBe(true));
    it('returns false for api_access', () => expect(getFeatureLimit('basic', 'api_access')).toBe(false));
  });

  describe('pro plan', () => {
    it('returns Infinity for max_courses', () => expect(getFeatureLimit('pro', 'max_courses')).toBe(Infinity));
    it('returns Infinity for max_students', () => expect(getFeatureLimit('pro', 'max_students')).toBe(Infinity));
    it('returns true for custom_domain', () => expect(getFeatureLimit('pro', 'custom_domain')).toBe(true));
    it('returns true for analytics', () => expect(getFeatureLimit('pro', 'analytics')).toBe(true));
    it('returns true for api_access', () => expect(getFeatureLimit('pro', 'api_access')).toBe(true));
  });

  describe('unknown plan defaults to free', () => {
    it('returns 3 for max_courses on unknown plan', () => expect(getFeatureLimit('unknown', 'max_courses')).toBe(3));
    it('returns false for analytics on unknown plan', () => expect(getFeatureLimit('xyz', 'analytics')).toBe(false));
  });
});
