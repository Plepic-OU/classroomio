import { describe, it, expect } from 'vitest';
import { PLAN } from '../plans/constants';
import { canAccessFeature, getFeatureLimit, FEATURE_LIMITS, type FeatureName } from './feature-access';

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
  it('defines limits for all plan tiers', () => {
    expect(FEATURE_LIMITS[PLAN.BASIC]).toBeDefined();
    expect(FEATURE_LIMITS[PLAN.EARLY_ADOPTER]).toBeDefined();
    expect(FEATURE_LIMITS[PLAN.ENTERPRISE]).toBeDefined();
  });

  it('includes all features for each plan', () => {
    for (const plan of [PLAN.BASIC, PLAN.EARLY_ADOPTER, PLAN.ENTERPRISE]) {
      for (const feature of ALL_FEATURES) {
        expect(FEATURE_LIMITS[plan][feature]).toBeDefined();
      }
    }
  });
});

describe('canAccessFeature', () => {
  describe('BASIC (free tier)', () => {
    it('allows certificates and community', () => {
      expect(canAccessFeature(PLAN.BASIC, 'certificates')).toBe(true);
      expect(canAccessFeature(PLAN.BASIC, 'community')).toBe(true);
    });

    it('allows courses and students (has numeric limits > 0)', () => {
      expect(canAccessFeature(PLAN.BASIC, 'max_courses')).toBe(true);
      expect(canAccessFeature(PLAN.BASIC, 'max_students')).toBe(true);
    });

    it('denies custom_domain, analytics, and api_access', () => {
      expect(canAccessFeature(PLAN.BASIC, 'custom_domain')).toBe(false);
      expect(canAccessFeature(PLAN.BASIC, 'analytics')).toBe(false);
      expect(canAccessFeature(PLAN.BASIC, 'api_access')).toBe(false);
    });
  });

  describe('EARLY_ADOPTER (basic tier)', () => {
    it('allows analytics, certificates, and community', () => {
      expect(canAccessFeature(PLAN.EARLY_ADOPTER, 'analytics')).toBe(true);
      expect(canAccessFeature(PLAN.EARLY_ADOPTER, 'certificates')).toBe(true);
      expect(canAccessFeature(PLAN.EARLY_ADOPTER, 'community')).toBe(true);
    });

    it('allows courses and students', () => {
      expect(canAccessFeature(PLAN.EARLY_ADOPTER, 'max_courses')).toBe(true);
      expect(canAccessFeature(PLAN.EARLY_ADOPTER, 'max_students')).toBe(true);
    });

    it('denies custom_domain and api_access', () => {
      expect(canAccessFeature(PLAN.EARLY_ADOPTER, 'custom_domain')).toBe(false);
      expect(canAccessFeature(PLAN.EARLY_ADOPTER, 'api_access')).toBe(false);
    });
  });

  describe('ENTERPRISE (pro tier)', () => {
    it('allows all features', () => {
      for (const feature of ALL_FEATURES) {
        expect(canAccessFeature(PLAN.ENTERPRISE, feature)).toBe(true);
      }
    });
  });

  describe('unknown plan', () => {
    it('defaults to free tier limits', () => {
      expect(canAccessFeature('UNKNOWN_PLAN', 'custom_domain')).toBe(false);
      expect(canAccessFeature('UNKNOWN_PLAN', 'certificates')).toBe(true);
      expect(canAccessFeature('UNKNOWN_PLAN', 'max_courses')).toBe(true);
    });
  });

  describe('unknown feature', () => {
    it('returns false for unrecognized features', () => {
      expect(canAccessFeature(PLAN.ENTERPRISE, 'nonexistent' as FeatureName)).toBe(false);
    });
  });
});

describe('getFeatureLimit', () => {
  describe('BASIC (free tier)', () => {
    it('returns numeric limits for courses and students', () => {
      expect(getFeatureLimit(PLAN.BASIC, 'max_courses')).toBe(3);
      expect(getFeatureLimit(PLAN.BASIC, 'max_students')).toBe(30);
    });

    it('returns boolean for toggle features', () => {
      expect(getFeatureLimit(PLAN.BASIC, 'custom_domain')).toBe(false);
      expect(getFeatureLimit(PLAN.BASIC, 'analytics')).toBe(false);
      expect(getFeatureLimit(PLAN.BASIC, 'certificates')).toBe(true);
      expect(getFeatureLimit(PLAN.BASIC, 'community')).toBe(true);
      expect(getFeatureLimit(PLAN.BASIC, 'api_access')).toBe(false);
    });
  });

  describe('EARLY_ADOPTER (basic tier)', () => {
    it('returns numeric limits for courses and students', () => {
      expect(getFeatureLimit(PLAN.EARLY_ADOPTER, 'max_courses')).toBe(25);
      expect(getFeatureLimit(PLAN.EARLY_ADOPTER, 'max_students')).toBe(200);
    });

    it('returns boolean for toggle features', () => {
      expect(getFeatureLimit(PLAN.EARLY_ADOPTER, 'custom_domain')).toBe(false);
      expect(getFeatureLimit(PLAN.EARLY_ADOPTER, 'analytics')).toBe(true);
      expect(getFeatureLimit(PLAN.EARLY_ADOPTER, 'certificates')).toBe(true);
      expect(getFeatureLimit(PLAN.EARLY_ADOPTER, 'community')).toBe(true);
      expect(getFeatureLimit(PLAN.EARLY_ADOPTER, 'api_access')).toBe(false);
    });
  });

  describe('ENTERPRISE (pro tier)', () => {
    it('returns Infinity for numeric limits', () => {
      expect(getFeatureLimit(PLAN.ENTERPRISE, 'max_courses')).toBe(Infinity);
      expect(getFeatureLimit(PLAN.ENTERPRISE, 'max_students')).toBe(Infinity);
    });

    it('returns true for all toggle features', () => {
      expect(getFeatureLimit(PLAN.ENTERPRISE, 'custom_domain')).toBe(true);
      expect(getFeatureLimit(PLAN.ENTERPRISE, 'analytics')).toBe(true);
      expect(getFeatureLimit(PLAN.ENTERPRISE, 'certificates')).toBe(true);
      expect(getFeatureLimit(PLAN.ENTERPRISE, 'community')).toBe(true);
      expect(getFeatureLimit(PLAN.ENTERPRISE, 'api_access')).toBe(true);
    });
  });

  describe('unknown plan', () => {
    it('defaults to free tier limits', () => {
      expect(getFeatureLimit('UNKNOWN_PLAN', 'max_courses')).toBe(3);
      expect(getFeatureLimit('UNKNOWN_PLAN', 'max_students')).toBe(30);
      expect(getFeatureLimit('UNKNOWN_PLAN', 'certificates')).toBe(true);
    });
  });

  describe('unknown feature', () => {
    it('returns false for unrecognized features', () => {
      expect(getFeatureLimit(PLAN.ENTERPRISE, 'nonexistent' as FeatureName)).toBe(false);
    });
  });
});
