import { describe, it, expect } from 'vitest';
import {
  FEATURE_LIMITS,
  DEFAULT_TIER,
  canAccessFeature,
  getFeatureLimit,
  type FeatureName,
  type PlanTier
} from './feature-access';

const TIERS: PlanTier[] = ['free', 'basic', 'pro'];

const FEATURES: FeatureName[] = [
  'max_courses',
  'max_students',
  'custom_domain',
  'analytics',
  'certificates',
  'community',
  'api_access'
];

describe('FEATURE_LIMITS', () => {
  it('defines every feature for every tier', () => {
    for (const tier of TIERS) {
      for (const feature of FEATURES) {
        expect(FEATURE_LIMITS[tier][feature]).toBeDefined();
      }
    }
  });

  it('matches the free tier spec', () => {
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

  it('matches the basic tier spec', () => {
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

  it('matches the pro tier spec', () => {
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

describe('getFeatureLimit', () => {
  it('returns numeric limits for course/student caps', () => {
    expect(getFeatureLimit('free', 'max_courses')).toBe(3);
    expect(getFeatureLimit('free', 'max_students')).toBe(30);
    expect(getFeatureLimit('basic', 'max_courses')).toBe(25);
    expect(getFeatureLimit('basic', 'max_students')).toBe(200);
  });

  it('returns Infinity for unlimited pro caps', () => {
    expect(getFeatureLimit('pro', 'max_courses')).toBe(Infinity);
    expect(getFeatureLimit('pro', 'max_students')).toBe(Infinity);
  });

  it('returns boolean limits for flag features', () => {
    expect(getFeatureLimit('free', 'certificates')).toBe(true);
    expect(getFeatureLimit('free', 'analytics')).toBe(false);
    expect(getFeatureLimit('basic', 'analytics')).toBe(true);
    expect(getFeatureLimit('basic', 'custom_domain')).toBe(false);
    expect(getFeatureLimit('pro', 'custom_domain')).toBe(true);
    expect(getFeatureLimit('pro', 'api_access')).toBe(true);
  });

  it('falls back to the free tier for an unknown plan', () => {
    expect(getFeatureLimit('enterprise', 'max_courses')).toBe(
      FEATURE_LIMITS[DEFAULT_TIER].max_courses
    );
    expect(getFeatureLimit('', 'analytics')).toBe(FEATURE_LIMITS.free.analytics);
    expect(getFeatureLimit('PRO', 'custom_domain')).toBe(FEATURE_LIMITS.free.custom_domain);
  });

  it('returns false for an unknown feature', () => {
    expect(getFeatureLimit('pro', 'teleportation' as FeatureName)).toBe(false);
    expect(getFeatureLimit('unknown-plan', 'teleportation' as FeatureName)).toBe(false);
  });
});

describe('canAccessFeature', () => {
  it('grants boolean features that are enabled', () => {
    expect(canAccessFeature('free', 'certificates')).toBe(true);
    expect(canAccessFeature('free', 'community')).toBe(true);
    expect(canAccessFeature('basic', 'analytics')).toBe(true);
    expect(canAccessFeature('pro', 'custom_domain')).toBe(true);
    expect(canAccessFeature('pro', 'api_access')).toBe(true);
  });

  it('denies boolean features that are disabled', () => {
    expect(canAccessFeature('free', 'custom_domain')).toBe(false);
    expect(canAccessFeature('free', 'analytics')).toBe(false);
    expect(canAccessFeature('free', 'api_access')).toBe(false);
    expect(canAccessFeature('basic', 'custom_domain')).toBe(false);
    expect(canAccessFeature('basic', 'api_access')).toBe(false);
  });

  it('grants numeric features with a positive limit', () => {
    expect(canAccessFeature('free', 'max_courses')).toBe(true);
    expect(canAccessFeature('free', 'max_students')).toBe(true);
    expect(canAccessFeature('pro', 'max_courses')).toBe(true);
    expect(canAccessFeature('pro', 'max_students')).toBe(true);
  });

  it('falls back to the free tier for an unknown plan', () => {
    expect(canAccessFeature('enterprise', 'certificates')).toBe(true);
    expect(canAccessFeature('enterprise', 'custom_domain')).toBe(false);
    expect(canAccessFeature('', 'analytics')).toBe(false);
  });

  it('denies an unknown feature', () => {
    expect(canAccessFeature('pro', 'teleportation' as FeatureName)).toBe(false);
    expect(canAccessFeature('free', 'teleportation' as FeatureName)).toBe(false);
  });

  it('agrees with getFeatureLimit across every plan/feature combination', () => {
    for (const tier of TIERS) {
      for (const feature of FEATURES) {
        const limit = getFeatureLimit(tier, feature);
        const expected = typeof limit === 'boolean' ? limit : limit > 0;
        expect(canAccessFeature(tier, feature)).toBe(expected);
      }
    }
  });
});
