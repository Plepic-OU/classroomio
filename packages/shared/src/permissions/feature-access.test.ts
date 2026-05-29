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
  // free plan
  it('free: can access community', () => {
    expect(canAccessFeature('free', 'community')).toBe(true);
  });

  it('free: cannot access custom_domain', () => {
    expect(canAccessFeature('free', 'custom_domain')).toBe(false);
  });

  it('free: cannot access analytics', () => {
    expect(canAccessFeature('free', 'analytics')).toBe(false);
  });

  it('free: cannot access certificates', () => {
    expect(canAccessFeature('free', 'certificates')).toBe(false);
  });

  it('free: cannot access api_access', () => {
    expect(canAccessFeature('free', 'api_access')).toBe(false);
  });

  it('free: can access max_courses (limit > 0)', () => {
    expect(canAccessFeature('free', 'max_courses')).toBe(true);
  });

  it('free: can access max_students (limit > 0)', () => {
    expect(canAccessFeature('free', 'max_students')).toBe(true);
  });

  // basic plan
  it('basic: can access analytics', () => {
    expect(canAccessFeature('basic', 'analytics')).toBe(true);
  });

  it('basic: can access certificates', () => {
    expect(canAccessFeature('basic', 'certificates')).toBe(true);
  });

  it('basic: cannot access custom_domain', () => {
    expect(canAccessFeature('basic', 'custom_domain')).toBe(false);
  });

  it('basic: cannot access api_access', () => {
    expect(canAccessFeature('basic', 'api_access')).toBe(false);
  });

  // pro plan
  it('pro: can access all features', () => {
    expect(canAccessFeature('pro', 'custom_domain')).toBe(true);
    expect(canAccessFeature('pro', 'analytics')).toBe(true);
    expect(canAccessFeature('pro', 'certificates')).toBe(true);
    expect(canAccessFeature('pro', 'community')).toBe(true);
    expect(canAccessFeature('pro', 'api_access')).toBe(true);
    expect(canAccessFeature('pro', 'max_courses')).toBe(true);
    expect(canAccessFeature('pro', 'max_students')).toBe(true);
  });

  // edge cases
  it('returns false for unknown plan', () => {
    expect(canAccessFeature('enterprise', 'analytics')).toBe(false);
    expect(canAccessFeature('', 'analytics')).toBe(false);
  });

  it('returns false for unknown feature', () => {
    expect(canAccessFeature('free', 'video_upload')).toBe(false);
    expect(canAccessFeature('pro', '')).toBe(false);
  });
});

describe('getFeatureLimit', () => {
  it('free: max_courses is 3', () => {
    expect(getFeatureLimit('free', 'max_courses')).toBe(3);
  });

  it('free: max_students is 30', () => {
    expect(getFeatureLimit('free', 'max_students')).toBe(30);
  });

  it('free: custom_domain is false', () => {
    expect(getFeatureLimit('free', 'custom_domain')).toBe(false);
  });

  it('basic: max_courses is 25', () => {
    expect(getFeatureLimit('basic', 'max_courses')).toBe(25);
  });

  it('basic: max_students is 200', () => {
    expect(getFeatureLimit('basic', 'max_students')).toBe(200);
  });

  it('basic: analytics is true', () => {
    expect(getFeatureLimit('basic', 'analytics')).toBe(true);
  });

  it('pro: max_courses is Infinity', () => {
    expect(getFeatureLimit('pro', 'max_courses')).toBe(Infinity);
  });

  it('pro: max_students is Infinity', () => {
    expect(getFeatureLimit('pro', 'max_students')).toBe(Infinity);
  });

  it('pro: api_access is true', () => {
    expect(getFeatureLimit('pro', 'api_access')).toBe(true);
  });

  // edge cases
  it('returns false for unknown plan', () => {
    expect(getFeatureLimit('enterprise', 'analytics')).toBe(false);
  });

  it('returns false for unknown feature', () => {
    expect(getFeatureLimit('free', 'video_upload')).toBe(false);
  });
});
