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

type PlanLimits = {
  [K in FeatureName]: FeatureLimitValue;
};

export const FEATURE_LIMITS: Record<PlanName, PlanLimits> = {
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

const DEFAULT_PLAN: PlanName = 'free';

function resolvePlan(plan: string): PlanName {
  if (plan in FEATURE_LIMITS) {
    return plan as PlanName;
  }
  return DEFAULT_PLAN;
}

export function canAccessFeature(plan: string, feature: FeatureName): boolean {
  const limits = FEATURE_LIMITS[resolvePlan(plan)];
  const value = limits[feature];
  if (typeof value === 'boolean') {
    return value;
  }
  return value > 0;
}

export function getFeatureLimit(plan: string, feature: FeatureName): number | boolean {
  const limits = FEATURE_LIMITS[resolvePlan(plan)];
  return limits[feature];
}
