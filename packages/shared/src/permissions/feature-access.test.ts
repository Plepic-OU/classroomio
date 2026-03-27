import { describe, it, expect } from 'vitest';
import { canAccessFeature, getFeatureLimit, FEATURE_LIMITS } from './feature-access';
import { PLAN } from '../plans/constants';

describe('FEATURE_LIMITS', () => {
  it('defines limits for all known plans', () => {
    expect(FEATURE_LIMITS[PLAN.BASIC]).toBeDefined();
    expect(FEATURE_LIMITS[PLAN.EARLY_ADOPTER]).toBeDefined();
    expect(FEATURE_LIMITS[PLAN.ENTERPRISE]).toBeDefined();
  });
});

describe('canAccessFeature', () => {
  describe('BASIC (free) plan', () => {
    it('allows up to max_courses', () => expect(canAccessFeature(PLAN.BASIC, 'max_courses')).toBe(true));
    it('allows up to max_students', () => expect(canAccessFeature(PLAN.BASIC, 'max_students')).toBe(true));
    it('denies custom_domain', () => expect(canAccessFeature(PLAN.BASIC, 'custom_domain')).toBe(false));
    it('denies analytics', () => expect(canAccessFeature(PLAN.BASIC, 'analytics')).toBe(false));
    it('allows certificates', () => expect(canAccessFeature(PLAN.BASIC, 'certificates')).toBe(true));
    it('allows community', () => expect(canAccessFeature(PLAN.BASIC, 'community')).toBe(true));
    it('denies api_access', () => expect(canAccessFeature(PLAN.BASIC, 'api_access')).toBe(false));
  });

  describe('EARLY_ADOPTER (basic) plan', () => {
    it('allows max_courses', () => expect(canAccessFeature(PLAN.EARLY_ADOPTER, 'max_courses')).toBe(true));
    it('allows max_students', () => expect(canAccessFeature(PLAN.EARLY_ADOPTER, 'max_students')).toBe(true));
    it('denies custom_domain', () => expect(canAccessFeature(PLAN.EARLY_ADOPTER, 'custom_domain')).toBe(false));
    it('allows analytics', () => expect(canAccessFeature(PLAN.EARLY_ADOPTER, 'analytics')).toBe(true));
    it('allows certificates', () => expect(canAccessFeature(PLAN.EARLY_ADOPTER, 'certificates')).toBe(true));
    it('allows community', () => expect(canAccessFeature(PLAN.EARLY_ADOPTER, 'community')).toBe(true));
    it('denies api_access', () => expect(canAccessFeature(PLAN.EARLY_ADOPTER, 'api_access')).toBe(false));
  });

  describe('ENTERPRISE (pro) plan', () => {
    it('allows max_courses', () => expect(canAccessFeature(PLAN.ENTERPRISE, 'max_courses')).toBe(true));
    it('allows max_students', () => expect(canAccessFeature(PLAN.ENTERPRISE, 'max_students')).toBe(true));
    it('allows custom_domain', () => expect(canAccessFeature(PLAN.ENTERPRISE, 'custom_domain')).toBe(true));
    it('allows analytics', () => expect(canAccessFeature(PLAN.ENTERPRISE, 'analytics')).toBe(true));
    it('allows certificates', () => expect(canAccessFeature(PLAN.ENTERPRISE, 'certificates')).toBe(true));
    it('allows community', () => expect(canAccessFeature(PLAN.ENTERPRISE, 'community')).toBe(true));
    it('allows api_access', () => expect(canAccessFeature(PLAN.ENTERPRISE, 'api_access')).toBe(true));
  });

  describe('unknown plan', () => {
    it('defaults to free (BASIC) tier', () => {
      expect(canAccessFeature('UNKNOWN_PLAN', 'analytics')).toBe(false);
      expect(canAccessFeature('UNKNOWN_PLAN', 'certificates')).toBe(true);
      expect(canAccessFeature('UNKNOWN_PLAN', 'max_courses')).toBe(true);
    });
  });
});

describe('getFeatureLimit', () => {
  describe('BASIC plan numeric limits', () => {
    it('returns 3 for max_courses', () => expect(getFeatureLimit(PLAN.BASIC, 'max_courses')).toBe(3));
    it('returns 30 for max_students', () => expect(getFeatureLimit(PLAN.BASIC, 'max_students')).toBe(30));
  });

  describe('EARLY_ADOPTER plan numeric limits', () => {
    it('returns 25 for max_courses', () => expect(getFeatureLimit(PLAN.EARLY_ADOPTER, 'max_courses')).toBe(25));
    it('returns 200 for max_students', () => expect(getFeatureLimit(PLAN.EARLY_ADOPTER, 'max_students')).toBe(200));
  });

  describe('ENTERPRISE plan unlimited', () => {
    it('returns Infinity for max_courses', () => expect(getFeatureLimit(PLAN.ENTERPRISE, 'max_courses')).toBe(Infinity));
    it('returns Infinity for max_students', () => expect(getFeatureLimit(PLAN.ENTERPRISE, 'max_students')).toBe(Infinity));
  });

  describe('boolean features', () => {
    it('returns false for BASIC custom_domain', () => expect(getFeatureLimit(PLAN.BASIC, 'custom_domain')).toBe(false));
    it('returns true for ENTERPRISE custom_domain', () => expect(getFeatureLimit(PLAN.ENTERPRISE, 'custom_domain')).toBe(true));
    it('returns false for BASIC analytics', () => expect(getFeatureLimit(PLAN.BASIC, 'analytics')).toBe(false));
    it('returns true for EARLY_ADOPTER analytics', () => expect(getFeatureLimit(PLAN.EARLY_ADOPTER, 'analytics')).toBe(true));
  });

  describe('unknown plan', () => {
    it('defaults to BASIC limits', () => {
      expect(getFeatureLimit('GHOST_PLAN', 'max_courses')).toBe(3);
      expect(getFeatureLimit('GHOST_PLAN', 'analytics')).toBe(false);
    });
  });
});
