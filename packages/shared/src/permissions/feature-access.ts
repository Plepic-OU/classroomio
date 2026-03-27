import { PLAN } from '../plans/constants';

export type FeatureName =
  | 'max_courses'
  | 'max_students'
  | 'custom_domain'
  | 'analytics'
  | 'certificates'
  | 'community'
  | 'api_access';

type FeatureValue = number | boolean;

type FeatureLimits = Record<FeatureName, FeatureValue>;

/**
 * Maps each plan tier to its feature limits.
 * BASIC = free, EARLY_ADOPTER = basic, ENTERPRISE = pro.
 */
export const FEATURE_LIMITS: Record<string, FeatureLimits> = {
  [PLAN.BASIC]: {
    max_courses: 3,
    max_students: 30,
    custom_domain: false,
    analytics: false,
    certificates: true,
    community: true,
    api_access: false
  },
  [PLAN.EARLY_ADOPTER]: {
    max_courses: 25,
    max_students: 200,
    custom_domain: false,
    analytics: true,
    certificates: true,
    community: true,
    api_access: false
  },
  [PLAN.ENTERPRISE]: {
    max_courses: Infinity,
    max_students: Infinity,
    custom_domain: true,
    analytics: true,
    certificates: true,
    community: true,
    api_access: true
  }
};

const DEFAULT_PLAN = PLAN.BASIC;

export function canAccessFeature(plan: string, feature: FeatureName): boolean {
  const limits = FEATURE_LIMITS[plan] ?? FEATURE_LIMITS[DEFAULT_PLAN];
  const value = limits[feature];

  if (value === undefined) {
    return false;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  return value > 0;
}

export function getFeatureLimit(plan: string, feature: FeatureName): number | boolean {
  const limits = FEATURE_LIMITS[plan] ?? FEATURE_LIMITS[DEFAULT_PLAN];
  const value = limits[feature];

  if (value === undefined) {
    return false;
  }

  return value;
}
