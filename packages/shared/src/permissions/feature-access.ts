export type FeatureName =
  | 'max_courses'
  | 'max_students'
  | 'custom_domain'
  | 'analytics'
  | 'certificates'
  | 'community'
  | 'api_access';

export type PlanTier = 'free' | 'basic' | 'pro';

type FeatureLimitValue = number | boolean;

type PlanLimits = Record<FeatureName, FeatureLimitValue>;

export const FEATURE_LIMITS: Record<PlanTier, PlanLimits> = {
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

const DEFAULT_PLAN: PlanTier = 'free';

function resolvePlan(plan: string): PlanTier {
  return (plan in FEATURE_LIMITS ? plan : DEFAULT_PLAN) as PlanTier;
}

export function canAccessFeature(plan: string, feature: FeatureName): boolean {
  const limits = FEATURE_LIMITS[resolvePlan(plan)];
  const value = limits[feature];
  if (typeof value === 'boolean') return value;
  return value > 0;
}

export function getFeatureLimit(plan: string, feature: FeatureName): number | boolean {
  return FEATURE_LIMITS[resolvePlan(plan)][feature];
}
