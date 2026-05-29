import { describe, it, expect } from 'vitest';
import { canAccessFeature, getFeatureLimit, FEATURE_LIMITS } from './feature-access';

describe('FEATURE_LIMITS', () => {
  it('free plan has 3 max_courses', () => {
    expect(FEATURE_LIMITS.free.max_courses).toBe(3);
  });

  it('basic plan has 25 max_courses', () => {
    expect(FEATURE_LIMITS.basic.max_courses).toBe(25);
  });

  it('pro plan has Infinity max_courses', () => {
    expect(FEATURE_LIMITS.pro.max_courses).toBe(Infinity);
  });
});

describe('canAccessFeature', () => {
  describe('free plan', () => {
    it('allows certificates and community', () => {
      expect(canAccessFeature('free', 'certificates')).toBe(true);
      expect(canAccessFeature('free', 'community')).toBe(true);
    });

    it('denies custom_domain, analytics, api_access', () => {
      expect(canAccessFeature('free', 'custom_domain')).toBe(false);
      expect(canAccessFeature('free', 'analytics')).toBe(false);
      expect(canAccessFeature('free', 'api_access')).toBe(false);
    });

    it('allows max_courses and max_students (limits > 0)', () => {
      expect(canAccessFeature('free', 'max_courses')).toBe(true);
      expect(canAccessFeature('free', 'max_students')).toBe(true);
    });
  });

  describe('basic plan', () => {
    it('allows analytics, certificates, community', () => {
      expect(canAccessFeature('basic', 'analytics')).toBe(true);
      expect(canAccessFeature('basic', 'certificates')).toBe(true);
      expect(canAccessFeature('basic', 'community')).toBe(true);
    });

    it('denies custom_domain and api_access', () => {
      expect(canAccessFeature('basic', 'custom_domain')).toBe(false);
      expect(canAccessFeature('basic', 'api_access')).toBe(false);
    });
  });

  describe('pro plan', () => {
    it('allows all features', () => {
      expect(canAccessFeature('pro', 'max_courses')).toBe(true);
      expect(canAccessFeature('pro', 'max_students')).toBe(true);
      expect(canAccessFeature('pro', 'custom_domain')).toBe(true);
      expect(canAccessFeature('pro', 'analytics')).toBe(true);
      expect(canAccessFeature('pro', 'certificates')).toBe(true);
      expect(canAccessFeature('pro', 'community')).toBe(true);
      expect(canAccessFeature('pro', 'api_access')).toBe(true);
    });
  });

  describe('unknown plan (falls back to free tier)', () => {
    it('denies premium features', () => {
      expect(canAccessFeature('enterprise', 'analytics')).toBe(false);
      expect(canAccessFeature('enterprise', 'api_access')).toBe(false);
      expect(canAccessFeature('enterprise', 'custom_domain')).toBe(false);
    });

    it('allows free-tier features', () => {
      expect(canAccessFeature('unknown', 'certificates')).toBe(true);
      expect(canAccessFeature('unknown', 'community')).toBe(true);
    });
  });

  it('returns false for unknown feature', () => {
    expect(canAccessFeature('free', 'video_upload')).toBe(false);
    expect(canAccessFeature('pro', '')).toBe(false);
  });
});

describe('getFeatureLimit', () => {
  describe('free plan', () => {
    it('returns numeric limits for max_courses and max_students', () => {
      expect(getFeatureLimit('free', 'max_courses')).toBe(3);
      expect(getFeatureLimit('free', 'max_students')).toBe(30);
    });

    it('returns false for disabled boolean features', () => {
      expect(getFeatureLimit('free', 'custom_domain')).toBe(false);
      expect(getFeatureLimit('free', 'analytics')).toBe(false);
      expect(getFeatureLimit('free', 'api_access')).toBe(false);
    });

    it('returns true for enabled boolean features', () => {
      expect(getFeatureLimit('free', 'certificates')).toBe(true);
      expect(getFeatureLimit('free', 'community')).toBe(true);
    });
  });

  describe('basic plan', () => {
    it('returns correct numeric limits', () => {
      expect(getFeatureLimit('basic', 'max_courses')).toBe(25);
      expect(getFeatureLimit('basic', 'max_students')).toBe(200);
    });

    it('returns true for enabled features', () => {
      expect(getFeatureLimit('basic', 'analytics')).toBe(true);
    });
  });

  describe('pro plan', () => {
    it('returns Infinity for unlimited numeric features', () => {
      expect(getFeatureLimit('pro', 'max_courses')).toBe(Infinity);
      expect(getFeatureLimit('pro', 'max_students')).toBe(Infinity);
    });

    it('returns true for all boolean features', () => {
      expect(getFeatureLimit('pro', 'custom_domain')).toBe(true);
      expect(getFeatureLimit('pro', 'api_access')).toBe(true);
    });
  });

  describe('unknown plan (falls back to free tier)', () => {
    it('returns free-tier limits', () => {
      expect(getFeatureLimit('unknown', 'max_courses')).toBe(3);
      expect(getFeatureLimit('unknown', 'max_students')).toBe(30);
      expect(getFeatureLimit('unknown', 'analytics')).toBe(false);
    });
  });

  it('returns false for unknown feature', () => {
    expect(getFeatureLimit('free', 'video_upload')).toBe(false);
  });
});
