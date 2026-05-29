import { describe, it, expect } from 'vitest';
import {
  FEATURE_LIMITS,
  canAccessFeature,
  getFeatureLimit,
  type FeatureName,
  type PlanTier
} from './feature-access';

describe('FEATURE_LIMITS', () => {
  it('defines free tier with 3 courses, 30 students, certificates + community only', () => {
    expect(FEATURE_LIMITS.free).toEqual({
      max_courses: 3,
      max_students: 30,
      custom_domain: false,
      analytics: false,
      certificates: true,
      community: true,
      api_access: false
    });
  });

  it('defines basic tier with 25 courses, 200 students, analytics + certificates + community', () => {
    expect(FEATURE_LIMITS.basic).toEqual({
      max_courses: 25,
      max_students: 200,
      custom_domain: false,
      analytics: true,
      certificates: true,
      community: true,
      api_access: false
    });
  });

  it('defines pro tier with unlimited courses/students and every feature enabled', () => {
    expect(FEATURE_LIMITS.pro).toEqual({
      max_courses: Infinity,
      max_students: Infinity,
      custom_domain: true,
      analytics: true,
      certificates: true,
      community: true,
      api_access: true
    });
  });
});

describe('canAccessFeature', () => {
  describe('free tier', () => {
    it('grants quota features (max_courses, max_students) because limits are positive', () => {
      expect(canAccessFeature('free', 'max_courses')).toBe(true);
      expect(canAccessFeature('free', 'max_students')).toBe(true);
    });

    it('grants certificates and community', () => {
      expect(canAccessFeature('free', 'certificates')).toBe(true);
      expect(canAccessFeature('free', 'community')).toBe(true);
    });

    it('denies custom_domain, analytics, and api_access', () => {
      expect(canAccessFeature('free', 'custom_domain')).toBe(false);
      expect(canAccessFeature('free', 'analytics')).toBe(false);
      expect(canAccessFeature('free', 'api_access')).toBe(false);
    });
  });

  describe('basic tier', () => {
    it('grants quota features', () => {
      expect(canAccessFeature('basic', 'max_courses')).toBe(true);
      expect(canAccessFeature('basic', 'max_students')).toBe(true);
    });

    it('grants analytics, certificates, and community', () => {
      expect(canAccessFeature('basic', 'analytics')).toBe(true);
      expect(canAccessFeature('basic', 'certificates')).toBe(true);
      expect(canAccessFeature('basic', 'community')).toBe(true);
    });

    it('denies custom_domain and api_access', () => {
      expect(canAccessFeature('basic', 'custom_domain')).toBe(false);
      expect(canAccessFeature('basic', 'api_access')).toBe(false);
    });
  });

  describe('pro tier', () => {
    it('grants every feature', () => {
      const features: FeatureName[] = [
        'max_courses',
        'max_students',
        'custom_domain',
        'analytics',
        'certificates',
        'community',
        'api_access'
      ];
      for (const feature of features) {
        expect(canAccessFeature('pro', feature)).toBe(true);
      }
    });
  });

  describe('edge cases', () => {
    it('returns false for an unknown plan', () => {
      expect(canAccessFeature('enterprise' as PlanTier, 'analytics')).toBe(false);
      expect(canAccessFeature('' as PlanTier, 'max_courses')).toBe(false);
    });

    it('returns false for an unknown feature', () => {
      expect(canAccessFeature('free', 'beta_access' as FeatureName)).toBe(false);
      expect(canAccessFeature('pro', '' as FeatureName)).toBe(false);
    });

    it('returns false when both plan and feature are unknown', () => {
      expect(canAccessFeature('mystery' as PlanTier, 'mystery' as FeatureName)).toBe(false);
    });
  });
});

describe('getFeatureLimit', () => {
  describe('free tier', () => {
    it('returns numeric limits for quota features', () => {
      expect(getFeatureLimit('free', 'max_courses')).toBe(3);
      expect(getFeatureLimit('free', 'max_students')).toBe(30);
    });

    it('returns boolean flags for toggle features', () => {
      expect(getFeatureLimit('free', 'custom_domain')).toBe(false);
      expect(getFeatureLimit('free', 'analytics')).toBe(false);
      expect(getFeatureLimit('free', 'certificates')).toBe(true);
      expect(getFeatureLimit('free', 'community')).toBe(true);
      expect(getFeatureLimit('free', 'api_access')).toBe(false);
    });
  });

  describe('basic tier', () => {
    it('returns numeric limits for quota features', () => {
      expect(getFeatureLimit('basic', 'max_courses')).toBe(25);
      expect(getFeatureLimit('basic', 'max_students')).toBe(200);
    });

    it('returns boolean flags for toggle features', () => {
      expect(getFeatureLimit('basic', 'custom_domain')).toBe(false);
      expect(getFeatureLimit('basic', 'analytics')).toBe(true);
      expect(getFeatureLimit('basic', 'certificates')).toBe(true);
      expect(getFeatureLimit('basic', 'community')).toBe(true);
      expect(getFeatureLimit('basic', 'api_access')).toBe(false);
    });
  });

  describe('pro tier', () => {
    it('returns Infinity for unlimited quota features', () => {
      expect(getFeatureLimit('pro', 'max_courses')).toBe(Infinity);
      expect(getFeatureLimit('pro', 'max_students')).toBe(Infinity);
    });

    it('returns true for every toggle feature', () => {
      expect(getFeatureLimit('pro', 'custom_domain')).toBe(true);
      expect(getFeatureLimit('pro', 'analytics')).toBe(true);
      expect(getFeatureLimit('pro', 'certificates')).toBe(true);
      expect(getFeatureLimit('pro', 'community')).toBe(true);
      expect(getFeatureLimit('pro', 'api_access')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('returns false for an unknown plan', () => {
      expect(getFeatureLimit('enterprise' as PlanTier, 'max_courses')).toBe(false);
      expect(getFeatureLimit('' as PlanTier, 'analytics')).toBe(false);
    });

    it('returns false for an unknown feature', () => {
      expect(getFeatureLimit('free', 'beta_access' as FeatureName)).toBe(false);
      expect(getFeatureLimit('pro', '' as FeatureName)).toBe(false);
    });

    it('returns false when both plan and feature are unknown', () => {
      expect(getFeatureLimit('mystery' as PlanTier, 'mystery' as FeatureName)).toBe(false);
    });
  });
});
