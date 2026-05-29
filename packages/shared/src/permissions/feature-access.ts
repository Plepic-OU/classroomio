export type PlanTier = 'free' | 'basic' | 'pro';

export type FeatureName =
  | 'max_courses'
  | 'max_students'
  | 'custom_domain'
  | 'analytics'
  | 'certificates'
  | 'community'
  | 'api_access';

type FeatureLimits = Record<FeatureName, number | boolean>;

export const FEATURE_LIMITS: Record<PlanTier, FeatureLimits> = {
  free: {
    max_courses: 3,
    max_students: 30,
    custom_domain: false,
    analytics: false,
    certificates: true,
    community: true,
    api_access: false
  },
  basic: {
    max_courses: 25,
    max_students: 200,
    custom_domain: false,
    analytics: true,
    certificates: true,
    community: true,
    api_access: false
  },
  pro: {
    max_courses: Infinity,
    max_students: Infinity,
    custom_domain: true,
    analytics: true,
    certificates: true,
    community: true,
    api_access: true
  }
};

export function canAccessFeature(plan: PlanTier, feature: FeatureName): boolean {
  const planLimits = FEATURE_LIMITS[plan];
  if (!planLimits) return false;

  const limit = planLimits[feature];
  if (limit === undefined) return false;

  if (typeof limit === 'boolean') return limit;
  return limit > 0;
}

export function getFeatureLimit(plan: PlanTier, feature: FeatureName): number | boolean {
  const planLimits = FEATURE_LIMITS[plan];
  if (!planLimits) return false;

  const limit = planLimits[feature];
  if (limit === undefined) return false;

  return limit;
}
