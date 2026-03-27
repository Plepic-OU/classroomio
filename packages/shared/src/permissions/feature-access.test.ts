import { describe, it, expect } from 'vitest';
import {
  canAccessFeature,
  getFeatureLimit,
  FEATURE_LIMITS,
  type FeatureName,
  type PlanTier,
} from './feature-access';

const ALL_FEATURES: FeatureName[] = [
  'max_courses',
  'max_students',
  'custom_domain',
  'analytics',
  'certificates',
  'community',
  'api_access',
];

const ALL_PLANS: PlanTier[] = ['free', 'basic', 'pro'];

describe('canAccessFeature', () => {
  describe('free plan', () => {
    it('allows certificates and community', () => {
      expect(canAccessFeature('free', 'certificates')).toBe(true);
      expect(canAccessFeature('free', 'community')).toBe(true);
    });

    it('allows courses and students (has numeric limits > 0)', () => {
      expect(canAccessFeature('free', 'max_courses')).toBe(true);
      expect(canAccessFeature('free', 'max_students')).toBe(true);
    });

    it('denies custom_domain, analytics, api_access', () => {
      expect(canAccessFeature('free', 'custom_domain')).toBe(false);
      expect(canAccessFeature('free', 'analytics')).toBe(false);
      expect(canAccessFeature('free', 'api_access')).toBe(false);
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
      for (const feature of ALL_FEATURES) {
        expect(canAccessFeature('pro', feature)).toBe(true);
      }
    });
  });

  describe('unknown plan defaults to free', () => {
    it('treats unknown plan as free tier', () => {
      expect(canAccessFeature('unknown_plan', 'api_access')).toBe(false);
      expect(canAccessFeature('unknown_plan', 'certificates')).toBe(true);
      expect(canAccessFeature('unknown_plan', 'max_courses')).toBe(true);
    });
  });

  describe('unknown feature', () => {
    it('returns false for unknown feature names', () => {
      expect(canAccessFeature('pro', 'nonexistent' as FeatureName)).toBe(false);
    });
  });
});

describe('getFeatureLimit', () => {
  describe('free plan', () => {
    it('returns 3 courses and 30 students', () => {
      expect(getFeatureLimit('free', 'max_courses')).toBe(3);
      expect(getFeatureLimit('free', 'max_students')).toBe(30);
    });

    it('returns boolean for boolean features', () => {
      expect(getFeatureLimit('free', 'custom_domain')).toBe(false);
      expect(getFeatureLimit('free', 'certificates')).toBe(true);
    });
  });

  describe('basic plan', () => {
    it('returns 25 courses and 200 students', () => {
      expect(getFeatureLimit('basic', 'max_courses')).toBe(25);
      expect(getFeatureLimit('basic', 'max_students')).toBe(200);
    });

    it('returns true for analytics', () => {
      expect(getFeatureLimit('basic', 'analytics')).toBe(true);
    });
  });

  describe('pro plan', () => {
    it('returns Infinity for courses and students', () => {
      expect(getFeatureLimit('pro', 'max_courses')).toBe(Infinity);
      expect(getFeatureLimit('pro', 'max_students')).toBe(Infinity);
    });

    it('returns true for all boolean features', () => {
      expect(getFeatureLimit('pro', 'custom_domain')).toBe(true);
      expect(getFeatureLimit('pro', 'analytics')).toBe(true);
      expect(getFeatureLimit('pro', 'certificates')).toBe(true);
      expect(getFeatureLimit('pro', 'community')).toBe(true);
      expect(getFeatureLimit('pro', 'api_access')).toBe(true);
    });
  });

  describe('unknown plan defaults to free', () => {
    it('returns free tier limits for unknown plans', () => {
      expect(getFeatureLimit('garbage', 'max_courses')).toBe(3);
      expect(getFeatureLimit('', 'max_students')).toBe(30);
    });
  });

  describe('unknown feature', () => {
    it('returns false for unknown feature names', () => {
      expect(getFeatureLimit('pro', 'nonexistent' as FeatureName)).toBe(false);
    });
  });
});

describe('FEATURE_LIMITS completeness', () => {
  it('every plan defines every feature', () => {
    for (const plan of ALL_PLANS) {
      for (const feature of ALL_FEATURES) {
        expect(FEATURE_LIMITS[plan][feature]).toBeDefined();
      }
    }
  });
});
