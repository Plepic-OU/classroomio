/**
 * Feature-access module: maps plan tiers to feature limits.
 *
 * Plan tiers map to the existing PLAN constants (BASIC, EARLY_ADOPTER, ENTERPRISE)
 * but this module uses the issue's naming (free, basic, pro) as aliases.
 */

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

const FEATURE_LIMITS: Record<PlanTier, Record<FeatureName, FeatureLimitValue>> = {
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

export { FEATURE_LIMITS };

/**
 * Whether the given plan has access to the feature.
 * Boolean features: returns the boolean value.
 * Numeric features: returns true if the limit is > 0.
 * Unknown plan defaults to free tier.
 */
export function canAccessFeature(plan: string, feature: FeatureName): boolean {
  const tier = normalizePlan(plan);
  const limits = FEATURE_LIMITS[tier];
  const value = limits[feature];

  if (value === undefined) return false;
  return typeof value === 'boolean' ? value : value > 0;
}

/**
 * Returns the numeric limit or boolean for a feature on the given plan.
 * Unlimited = Infinity.
 * Unknown plan defaults to free tier.
 */
export function getFeatureLimit(plan: string, feature: FeatureName): number | boolean {
  const tier = normalizePlan(plan);
  const limits = FEATURE_LIMITS[tier];
  const value = limits[feature];

  if (value === undefined) return false;
  return value;
}

function normalizePlan(plan: string): PlanTier {
  const lower = plan.toLowerCase();
  if (lower === 'free' || lower === 'basic' || lower === 'pro') {
    return lower as PlanTier;
  }
  // Default unknown plans to free
  return 'free';
}
