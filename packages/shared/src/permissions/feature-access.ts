export type PlanName = 'free' | 'basic' | 'pro';

export type FeatureName =
  | 'max_courses'
  | 'max_students'
  | 'custom_domain'
  | 'analytics'
  | 'certificates'
  | 'community'
  | 'api_access';

type PlanConfig = {
  max_courses: number;
  max_students: number;
  custom_domain: boolean;
  analytics: boolean;
  certificates: boolean;
  community: boolean;
  api_access: boolean;
};

export const FEATURE_LIMITS: Record<PlanName, PlanConfig> = {
  free: {
    max_courses: 3,
    max_students: 30,
    custom_domain: false,
    analytics: false,
    certificates: true,
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

function resolveConfig(plan: string): PlanConfig {
  return (FEATURE_LIMITS as Record<string, PlanConfig>)[plan] ?? FEATURE_LIMITS.free;
}

/**
 * Returns true when the given plan grants access to the feature.
 * Unknown plans fall back to the free tier.
 */
export function canAccessFeature(plan: string, feature: string): boolean {
  const config = resolveConfig(plan);
  const value = config[feature as FeatureName];
  if (value === undefined) return false;
  if (typeof value === 'boolean') return value;
  return (value as number) > 0;
}

/**
 * Returns the numeric or boolean limit for a feature on the given plan.
 * Unknown plans fall back to the free tier. Unknown features return false.
 */
export function getFeatureLimit(plan: string, feature: string): number | boolean {
  const config = resolveConfig(plan);
  const value = config[feature as FeatureName];
  if (value === undefined) return false;
  return value;
}
