import { describe, it, expect } from 'vitest';
import { canAccessFeature, getFeatureLimit, FEATURE_LIMITS } from './feature-access';

describe('FEATURE_LIMITS', () => {
  it('defines limits for all three plan tiers', () => {
    expect(FEATURE_LIMITS.free).toBeDefined();
    expect(FEATURE_LIMITS.basic).toBeDefined();
    expect(FEATURE_LIMITS.pro).toBeDefined();
  });
});

describe('getFeatureLimit', () => {
  describe('free plan', () => {
    it('returns 3 for max_courses', () => {
      expect(getFeatureLimit('free', 'max_courses')).toBe(3);
    });

    it('returns 30 for max_students', () => {
      expect(getFeatureLimit('free', 'max_students')).toBe(30);
    });

    it('returns false for custom_domain', () => {
      expect(getFeatureLimit('free', 'custom_domain')).toBe(false);
    });

    it('returns false for analytics', () => {
      expect(getFeatureLimit('free', 'analytics')).toBe(false);
    });

    it('returns true for certificates', () => {
      expect(getFeatureLimit('free', 'certificates')).toBe(true);
    });

    it('returns true for community', () => {
      expect(getFeatureLimit('free', 'community')).toBe(true);
    });

    it('returns false for api_access', () => {
      expect(getFeatureLimit('free', 'api_access')).toBe(false);
    });
  });

  describe('basic plan', () => {
    it('returns 25 for max_courses', () => {
      expect(getFeatureLimit('basic', 'max_courses')).toBe(25);
    });

    it('returns 200 for max_students', () => {
      expect(getFeatureLimit('basic', 'max_students')).toBe(200);
    });

    it('returns false for custom_domain', () => {
      expect(getFeatureLimit('basic', 'custom_domain')).toBe(false);
    });

    it('returns true for analytics', () => {
      expect(getFeatureLimit('basic', 'analytics')).toBe(true);
    });

    it('returns true for certificates', () => {
      expect(getFeatureLimit('basic', 'certificates')).toBe(true);
    });

    it('returns true for community', () => {
      expect(getFeatureLimit('basic', 'community')).toBe(true);
    });

    it('returns false for api_access', () => {
      expect(getFeatureLimit('basic', 'api_access')).toBe(false);
    });
  });

  describe('pro plan', () => {
    it('returns Infinity for max_courses', () => {
      expect(getFeatureLimit('pro', 'max_courses')).toBe(Infinity);
    });

    it('returns Infinity for max_students', () => {
      expect(getFeatureLimit('pro', 'max_students')).toBe(Infinity);
    });

    it('returns true for custom_domain', () => {
      expect(getFeatureLimit('pro', 'custom_domain')).toBe(true);
    });

    it('returns true for analytics', () => {
      expect(getFeatureLimit('pro', 'analytics')).toBe(true);
    });

    it('returns true for certificates', () => {
      expect(getFeatureLimit('pro', 'certificates')).toBe(true);
    });

    it('returns true for community', () => {
      expect(getFeatureLimit('pro', 'community')).toBe(true);
    });

    it('returns true for api_access', () => {
      expect(getFeatureLimit('pro', 'api_access')).toBe(true);
    });
  });

  describe('unknown plan', () => {
    it('defaults to free tier limits', () => {
      expect(getFeatureLimit('unknown', 'max_courses')).toBe(3);
      expect(getFeatureLimit('unknown', 'max_students')).toBe(30);
      expect(getFeatureLimit('unknown', 'custom_domain')).toBe(false);
    });

    it('defaults to free for empty string plan', () => {
      expect(getFeatureLimit('', 'max_courses')).toBe(3);
    });
  });
});

describe('canAccessFeature', () => {
  describe('free plan', () => {
    it('can access max_courses (numeric > 0)', () => {
      expect(canAccessFeature('free', 'max_courses')).toBe(true);
    });

    it('can access max_students (numeric > 0)', () => {
      expect(canAccessFeature('free', 'max_students')).toBe(true);
    });

    it('cannot access custom_domain', () => {
      expect(canAccessFeature('free', 'custom_domain')).toBe(false);
    });

    it('cannot access analytics', () => {
      expect(canAccessFeature('free', 'analytics')).toBe(false);
    });

    it('can access certificates', () => {
      expect(canAccessFeature('free', 'certificates')).toBe(true);
    });

    it('can access community', () => {
      expect(canAccessFeature('free', 'community')).toBe(true);
    });

    it('cannot access api_access', () => {
      expect(canAccessFeature('free', 'api_access')).toBe(false);
    });
  });

  describe('basic plan', () => {
    it('can access max_courses', () => {
      expect(canAccessFeature('basic', 'max_courses')).toBe(true);
    });

    it('can access max_students', () => {
      expect(canAccessFeature('basic', 'max_students')).toBe(true);
    });

    it('cannot access custom_domain', () => {
      expect(canAccessFeature('basic', 'custom_domain')).toBe(false);
    });

    it('can access analytics', () => {
      expect(canAccessFeature('basic', 'analytics')).toBe(true);
    });

    it('can access certificates', () => {
      expect(canAccessFeature('basic', 'certificates')).toBe(true);
    });

    it('can access community', () => {
      expect(canAccessFeature('basic', 'community')).toBe(true);
    });

    it('cannot access api_access', () => {
      expect(canAccessFeature('basic', 'api_access')).toBe(false);
    });
  });

  describe('pro plan', () => {
    it('can access all features', () => {
      const features = [
        'max_courses',
        'max_students',
        'custom_domain',
        'analytics',
        'certificates',
        'community',
        'api_access'
      ] as const;
      for (const feature of features) {
        expect(canAccessFeature('pro', feature)).toBe(true);
      }
    });
  });

  describe('unknown plan', () => {
    it('defaults to free tier access rules', () => {
      expect(canAccessFeature('unknown', 'custom_domain')).toBe(false);
      expect(canAccessFeature('unknown', 'certificates')).toBe(true);
      expect(canAccessFeature('unknown', 'analytics')).toBe(false);
    });
  });
});
