import { describe, it, expect } from 'vitest';
import { canAccessFeature, getFeatureLimit, FEATURE_LIMITS, type FeatureName } from './feature-access';
import { PLAN } from '../plans/constants';

const ALL_FEATURES: FeatureName[] = [
  'max_courses',
  'max_students',
  'custom_domain',
  'analytics',
  'certificates',
  'community',
  'api_access'
];

describe('FEATURE_LIMITS', () => {
  it('defines limits for all three plan tiers', () => {
    expect(FEATURE_LIMITS[PLAN.BASIC]).toBeDefined();
    expect(FEATURE_LIMITS[PLAN.EARLY_ADOPTER]).toBeDefined();
    expect(FEATURE_LIMITS[PLAN.ENTERPRISE]).toBeDefined();
  });
});

describe('canAccessFeature', () => {
  describe('free tier (BASIC)', () => {
    it('allows certificates and community', () => {
      expect(canAccessFeature(PLAN.BASIC, 'certificates')).toBe(true);
      expect(canAccessFeature(PLAN.BASIC, 'community')).toBe(true);
    });

    it('allows courses and students (limit > 0)', () => {
      expect(canAccessFeature(PLAN.BASIC, 'max_courses')).toBe(true);
      expect(canAccessFeature(PLAN.BASIC, 'max_students')).toBe(true);
    });

    it('denies custom_domain, analytics, and api_access', () => {
      expect(canAccessFeature(PLAN.BASIC, 'custom_domain')).toBe(false);
      expect(canAccessFeature(PLAN.BASIC, 'analytics')).toBe(false);
      expect(canAccessFeature(PLAN.BASIC, 'api_access')).toBe(false);
    });
  });

  describe('basic tier (EARLY_ADOPTER)', () => {
    it('allows analytics, certificates, and community', () => {
      expect(canAccessFeature(PLAN.EARLY_ADOPTER, 'analytics')).toBe(true);
      expect(canAccessFeature(PLAN.EARLY_ADOPTER, 'certificates')).toBe(true);
      expect(canAccessFeature(PLAN.EARLY_ADOPTER, 'community')).toBe(true);
    });

    it('denies custom_domain and api_access', () => {
      expect(canAccessFeature(PLAN.EARLY_ADOPTER, 'custom_domain')).toBe(false);
      expect(canAccessFeature(PLAN.EARLY_ADOPTER, 'api_access')).toBe(false);
    });
  });

  describe('pro tier (ENTERPRISE)', () => {
    it('allows all features', () => {
      for (const feature of ALL_FEATURES) {
        expect(canAccessFeature(PLAN.ENTERPRISE, feature)).toBe(true);
      }
    });
  });

  describe('unknown plan defaults to free tier', () => {
    it('treats unknown plan as BASIC', () => {
      for (const feature of ALL_FEATURES) {
        expect(canAccessFeature('UNKNOWN_PLAN', feature)).toBe(
          canAccessFeature(PLAN.BASIC, feature)
        );
      }
    });
  });
});

describe('getFeatureLimit', () => {
  describe('free tier (BASIC)', () => {
    it('returns 3 courses and 30 students', () => {
      expect(getFeatureLimit(PLAN.BASIC, 'max_courses')).toBe(3);
      expect(getFeatureLimit(PLAN.BASIC, 'max_students')).toBe(30);
    });

    it('returns correct booleans', () => {
      expect(getFeatureLimit(PLAN.BASIC, 'custom_domain')).toBe(false);
      expect(getFeatureLimit(PLAN.BASIC, 'analytics')).toBe(false);
      expect(getFeatureLimit(PLAN.BASIC, 'certificates')).toBe(true);
      expect(getFeatureLimit(PLAN.BASIC, 'community')).toBe(true);
      expect(getFeatureLimit(PLAN.BASIC, 'api_access')).toBe(false);
    });
  });

  describe('basic tier (EARLY_ADOPTER)', () => {
    it('returns 25 courses and 200 students', () => {
      expect(getFeatureLimit(PLAN.EARLY_ADOPTER, 'max_courses')).toBe(25);
      expect(getFeatureLimit(PLAN.EARLY_ADOPTER, 'max_students')).toBe(200);
    });

    it('returns correct booleans', () => {
      expect(getFeatureLimit(PLAN.EARLY_ADOPTER, 'custom_domain')).toBe(false);
      expect(getFeatureLimit(PLAN.EARLY_ADOPTER, 'analytics')).toBe(true);
      expect(getFeatureLimit(PLAN.EARLY_ADOPTER, 'certificates')).toBe(true);
      expect(getFeatureLimit(PLAN.EARLY_ADOPTER, 'community')).toBe(true);
      expect(getFeatureLimit(PLAN.EARLY_ADOPTER, 'api_access')).toBe(false);
    });
  });

  describe('pro tier (ENTERPRISE)', () => {
    it('returns Infinity for courses and students', () => {
      expect(getFeatureLimit(PLAN.ENTERPRISE, 'max_courses')).toBe(Infinity);
      expect(getFeatureLimit(PLAN.ENTERPRISE, 'max_students')).toBe(Infinity);
    });

    it('returns true for all boolean features', () => {
      expect(getFeatureLimit(PLAN.ENTERPRISE, 'custom_domain')).toBe(true);
      expect(getFeatureLimit(PLAN.ENTERPRISE, 'analytics')).toBe(true);
      expect(getFeatureLimit(PLAN.ENTERPRISE, 'certificates')).toBe(true);
      expect(getFeatureLimit(PLAN.ENTERPRISE, 'community')).toBe(true);
      expect(getFeatureLimit(PLAN.ENTERPRISE, 'api_access')).toBe(true);
    });
  });

  describe('unknown plan defaults to free tier', () => {
    it('returns same limits as BASIC', () => {
      for (const feature of ALL_FEATURES) {
        expect(getFeatureLimit('NONEXISTENT', feature)).toBe(
          getFeatureLimit(PLAN.BASIC, feature)
        );
      }
    });
  });
});
