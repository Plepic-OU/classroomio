export type PlanName = 'free' | 'basic' | 'pro';

export type FeatureName =
  | 'max_courses'
  | 'max_students'
  | 'custom_domain'
  | 'analytics'
  | 'certificates'
  | 'community'
  | 'api_access';

type FeatureLimitValue = number | boolean;

type PlanConfig = {
  [F in FeatureName]: FeatureLimitValue;
};

export const FEATURE_LIMITS: Record<PlanName, PlanConfig> = {
  free: {
    max_courses: 3,
    max_students: 30,
    custom_domain: false,
    analytics: false,
    certificates: false,
    community: true,
    api_access: false,
  },
  basic: {
    max_courses: 25,
    max_students: 200,
    custom_domain: false,
    analytics: true,
    certificates: true,
    community: true,
    api_access: false,
  },
  pro: {
    max_courses: Infinity,
    max_students: Infinity,
    custom_domain: true,
    analytics: true,
    certificates: true,
    community: true,
    api_access: true,
  },
};

/**
 * Returns true when the given plan grants access to the feature.
 * Numeric limits are treated as accessible when > 0.
 * Unknown plan or feature returns false.
 */
export function canAccessFeature(plan: string, feature: string): boolean {
  const planConfig = FEATURE_LIMITS[plan as PlanName];
  if (!planConfig) return false;

  const limit = planConfig[feature as FeatureName];
  if (limit === undefined) return false;

  if (typeof limit === 'boolean') return limit;
  return limit > 0;
}

/**
 * Returns the numeric or boolean limit for a feature on the given plan.
 * Unknown plan or feature returns false.
 */
export function getFeatureLimit(plan: string, feature: string): number | boolean {
  const planConfig = FEATURE_LIMITS[plan as PlanName];
  if (!planConfig) return false;

  const limit = planConfig[feature as FeatureName];
  if (limit === undefined) return false;

  return limit;
}
