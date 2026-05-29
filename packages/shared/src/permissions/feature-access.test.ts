import { describe, it, expect } from 'vitest';
import { canAccessFeature, getFeatureLimit, FEATURE_LIMITS } from './feature-access';

describe('FEATURE_LIMITS', () => {
  it('defines limits for all three plan tiers', () => {
    expect(FEATURE_LIMITS).toHaveProperty('free');
    expect(FEATURE_LIMITS).toHaveProperty('basic');
    expect(FEATURE_LIMITS).toHaveProperty('pro');
  });
});

describe('canAccessFeature', () => {
  describe('free plan', () => {
    it('can access courses (limit > 0)', () => expect(canAccessFeature('free', 'max_courses')).toBe(true));
    it('can access students (limit > 0)', () => expect(canAccessFeature('free', 'max_students')).toBe(true));
    it('cannot access custom_domain', () => expect(canAccessFeature('free', 'custom_domain')).toBe(false));
    it('cannot access analytics', () => expect(canAccessFeature('free', 'analytics')).toBe(false));
    it('can access certificates', () => expect(canAccessFeature('free', 'certificates')).toBe(true));
    it('can access community', () => expect(canAccessFeature('free', 'community')).toBe(true));
    it('cannot access api_access', () => expect(canAccessFeature('free', 'api_access')).toBe(false));
  });

  describe('basic plan', () => {
    it('can access courses', () => expect(canAccessFeature('basic', 'max_courses')).toBe(true));
    it('can access students', () => expect(canAccessFeature('basic', 'max_students')).toBe(true));
    it('cannot access custom_domain', () => expect(canAccessFeature('basic', 'custom_domain')).toBe(false));
    it('can access analytics', () => expect(canAccessFeature('basic', 'analytics')).toBe(true));
    it('can access certificates', () => expect(canAccessFeature('basic', 'certificates')).toBe(true));
    it('can access community', () => expect(canAccessFeature('basic', 'community')).toBe(true));
    it('cannot access api_access', () => expect(canAccessFeature('basic', 'api_access')).toBe(false));
  });

  describe('pro plan', () => {
    it('can access courses', () => expect(canAccessFeature('pro', 'max_courses')).toBe(true));
    it('can access students', () => expect(canAccessFeature('pro', 'max_students')).toBe(true));
    it('can access custom_domain', () => expect(canAccessFeature('pro', 'custom_domain')).toBe(true));
    it('can access analytics', () => expect(canAccessFeature('pro', 'analytics')).toBe(true));
    it('can access certificates', () => expect(canAccessFeature('pro', 'certificates')).toBe(true));
    it('can access community', () => expect(canAccessFeature('pro', 'community')).toBe(true));
    it('can access api_access', () => expect(canAccessFeature('pro', 'api_access')).toBe(true));
  });

  describe('unknown plan defaults to free', () => {
    it('treats unknown plan as free for custom_domain', () =>
      expect(canAccessFeature('enterprise_x', 'custom_domain')).toBe(false));
    it('treats unknown plan as free for analytics', () =>
      expect(canAccessFeature('unknown', 'analytics')).toBe(false));
    it('treats unknown plan as free for certificates', () =>
      expect(canAccessFeature('', 'certificates')).toBe(true));
    it('treats unknown plan as free for max_courses limit', () =>
      expect(canAccessFeature('legacy', 'max_courses')).toBe(true));
  });
});

describe('getFeatureLimit', () => {
  describe('free plan', () => {
    it('max_courses = 3', () => expect(getFeatureLimit('free', 'max_courses')).toBe(3));
    it('max_students = 30', () => expect(getFeatureLimit('free', 'max_students')).toBe(30));
    it('custom_domain = false', () => expect(getFeatureLimit('free', 'custom_domain')).toBe(false));
    it('analytics = false', () => expect(getFeatureLimit('free', 'analytics')).toBe(false));
    it('certificates = true', () => expect(getFeatureLimit('free', 'certificates')).toBe(true));
    it('community = true', () => expect(getFeatureLimit('free', 'community')).toBe(true));
    it('api_access = false', () => expect(getFeatureLimit('free', 'api_access')).toBe(false));
  });

  describe('basic plan', () => {
    it('max_courses = 25', () => expect(getFeatureLimit('basic', 'max_courses')).toBe(25));
    it('max_students = 200', () => expect(getFeatureLimit('basic', 'max_students')).toBe(200));
    it('custom_domain = false', () => expect(getFeatureLimit('basic', 'custom_domain')).toBe(false));
    it('analytics = true', () => expect(getFeatureLimit('basic', 'analytics')).toBe(true));
    it('certificates = true', () => expect(getFeatureLimit('basic', 'certificates')).toBe(true));
    it('community = true', () => expect(getFeatureLimit('basic', 'community')).toBe(true));
    it('api_access = false', () => expect(getFeatureLimit('basic', 'api_access')).toBe(false));
  });

  describe('pro plan', () => {
    it('max_courses = Infinity', () => expect(getFeatureLimit('pro', 'max_courses')).toBe(Infinity));
    it('max_students = Infinity', () => expect(getFeatureLimit('pro', 'max_students')).toBe(Infinity));
    it('custom_domain = true', () => expect(getFeatureLimit('pro', 'custom_domain')).toBe(true));
    it('analytics = true', () => expect(getFeatureLimit('pro', 'analytics')).toBe(true));
    it('certificates = true', () => expect(getFeatureLimit('pro', 'certificates')).toBe(true));
    it('community = true', () => expect(getFeatureLimit('pro', 'community')).toBe(true));
    it('api_access = true', () => expect(getFeatureLimit('pro', 'api_access')).toBe(true));
  });

  describe('unknown plan defaults to free', () => {
    it('max_courses = 3 for unknown plan', () =>
      expect(getFeatureLimit('unknown', 'max_courses')).toBe(3));
    it('max_students = 30 for unknown plan', () =>
      expect(getFeatureLimit('unknown', 'max_students')).toBe(30));
    it('custom_domain = false for unknown plan', () =>
      expect(getFeatureLimit('unknown', 'custom_domain')).toBe(false));
  });
});
