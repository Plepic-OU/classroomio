export type FeatureName =
  | 'max_courses'
  | 'max_students'
  | 'custom_domain'
  | 'analytics'
  | 'certificates'
  | 'community'
  | 'api_access';

export type PlanTier = 'BASIC' | 'EARLY_ADOPTER' | 'ENTERPRISE';

type FeatureLimits = {
  [K in FeatureName]: number | boolean;
};

type FeatureLimitsPerPlan = {
  [K in PlanTier]: FeatureLimits;
};

export const FEATURE_LIMITS: FeatureLimitsPerPlan = {
  BASIC: {
    max_courses: 3,
    max_students: 30,
    custom_domain: false,
    analytics: false,
    certificates: true,
    community: true,
    api_access: false,
  },
  EARLY_ADOPTER: {
    max_courses: 25,
    max_students: 200,
    custom_domain: false,
    analytics: true,
    certificates: true,
    community: true,
    api_access: false,
  },
  ENTERPRISE: {
    max_courses: Infinity,
    max_students: Infinity,
    custom_domain: true,
    analytics: true,
    certificates: true,
    community: true,
    api_access: true,
  },
};

export function canAccessFeature(plan: unknown, feature: FeatureName): boolean {
  const planTier = plan as PlanTier | undefined;
  const validPlan = planTier && planTier in FEATURE_LIMITS ? planTier : 'BASIC';

  if (!(feature in FEATURE_LIMITS[validPlan])) {
    return false;
  }

  const limit = FEATURE_LIMITS[validPlan][feature];
  return typeof limit === 'boolean' ? limit : limit > 0;
}

export function getFeatureLimit(plan: unknown, feature: FeatureName): number | boolean {
  const planTier = plan as PlanTier | undefined;
  const validPlan = planTier && planTier in FEATURE_LIMITS ? planTier : 'BASIC';

  if (!(feature in FEATURE_LIMITS[validPlan])) {
    return false;
  }

  return FEATURE_LIMITS[validPlan][feature];
}
