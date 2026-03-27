import { describe, it, expect } from 'vitest';
import { canAccessFeature, getFeatureLimit, FEATURE_LIMITS } from './feature-access';

describe('FEATURE_LIMITS', () => {
  it('free plan has correct limits', () => {
    expect(FEATURE_LIMITS.free.max_courses).toBe(3);
    expect(FEATURE_LIMITS.free.max_students).toBe(30);
    expect(FEATURE_LIMITS.free.custom_domain).toBe(false);
    expect(FEATURE_LIMITS.free.analytics).toBe(false);
    expect(FEATURE_LIMITS.free.certificates).toBe(true);
    expect(FEATURE_LIMITS.free.community).toBe(true);
    expect(FEATURE_LIMITS.free.api_access).toBe(false);
  });

  it('basic plan has correct limits', () => {
    expect(FEATURE_LIMITS.basic.max_courses).toBe(25);
    expect(FEATURE_LIMITS.basic.max_students).toBe(200);
    expect(FEATURE_LIMITS.basic.custom_domain).toBe(false);
    expect(FEATURE_LIMITS.basic.analytics).toBe(true);
    expect(FEATURE_LIMITS.basic.certificates).toBe(true);
    expect(FEATURE_LIMITS.basic.community).toBe(true);
    expect(FEATURE_LIMITS.basic.api_access).toBe(false);
  });

  it('pro plan has correct limits', () => {
    expect(FEATURE_LIMITS.pro.max_courses).toBe(Infinity);
    expect(FEATURE_LIMITS.pro.max_students).toBe(Infinity);
    expect(FEATURE_LIMITS.pro.custom_domain).toBe(true);
    expect(FEATURE_LIMITS.pro.analytics).toBe(true);
    expect(FEATURE_LIMITS.pro.certificates).toBe(true);
    expect(FEATURE_LIMITS.pro.community).toBe(true);
    expect(FEATURE_LIMITS.pro.api_access).toBe(true);
  });
});

describe('canAccessFeature', () => {
  describe('free plan', () => {
    it('can access certificates', () => expect(canAccessFeature('free', 'certificates')).toBe(true));
    it('can access community', () => expect(canAccessFeature('free', 'community')).toBe(true));
    it('cannot access custom_domain', () => expect(canAccessFeature('free', 'custom_domain')).toBe(false));
    it('cannot access analytics', () => expect(canAccessFeature('free', 'analytics')).toBe(false));
    it('cannot access api_access', () => expect(canAccessFeature('free', 'api_access')).toBe(false));
    it('can access max_courses (> 0)', () => expect(canAccessFeature('free', 'max_courses')).toBe(true));
    it('can access max_students (> 0)', () => expect(canAccessFeature('free', 'max_students')).toBe(true));
  });

  describe('basic plan', () => {
    it('can access analytics', () => expect(canAccessFeature('basic', 'analytics')).toBe(true));
    it('can access certificates', () => expect(canAccessFeature('basic', 'certificates')).toBe(true));
    it('can access community', () => expect(canAccessFeature('basic', 'community')).toBe(true));
    it('cannot access custom_domain', () => expect(canAccessFeature('basic', 'custom_domain')).toBe(false));
    it('cannot access api_access', () => expect(canAccessFeature('basic', 'api_access')).toBe(false));
    it('can access max_courses (> 0)', () => expect(canAccessFeature('basic', 'max_courses')).toBe(true));
    it('can access max_students (> 0)', () => expect(canAccessFeature('basic', 'max_students')).toBe(true));
  });

  describe('pro plan', () => {
    it('can access all features', () => {
      expect(canAccessFeature('pro', 'max_courses')).toBe(true);
      expect(canAccessFeature('pro', 'max_students')).toBe(true);
      expect(canAccessFeature('pro', 'custom_domain')).toBe(true);
      expect(canAccessFeature('pro', 'analytics')).toBe(true);
      expect(canAccessFeature('pro', 'certificates')).toBe(true);
      expect(canAccessFeature('pro', 'community')).toBe(true);
      expect(canAccessFeature('pro', 'api_access')).toBe(true);
    });
  });

  describe('unknown plan defaults to free', () => {
    it('unknown plan cannot access analytics', () => expect(canAccessFeature('unknown', 'analytics')).toBe(false));
    it('unknown plan can access certificates', () => expect(canAccessFeature('unknown', 'certificates')).toBe(true));
    it('unknown plan cannot access api_access', () => expect(canAccessFeature('unknown', 'api_access')).toBe(false));
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
    it('returns true for api_access', () => expect(getFeatureLimit('pro', 'api_access')).toBe(true));
  });

  describe('unknown plan defaults to free', () => {
    it('unknown plan returns 3 for max_courses', () => expect(getFeatureLimit('unknown', 'max_courses')).toBe(3));
    it('unknown plan returns false for custom_domain', () => expect(getFeatureLimit('unknown', 'custom_domain')).toBe(false));
  });
});
