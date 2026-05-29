/**
 * Feature-access logic per plan tier.
 *
 * Maps each subscription plan tier to its feature limits and exposes helpers
 * to query whether a plan can access a feature and what its limit is.
 *
 * Tier names mirror the public pricing tiers (free / basic / pro). The richer
 * internal plan definitions live in `../plans`, but feature gating is kept
 * intentionally small and self-contained here.
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

export type FeatureLimit = number | boolean;

type PlanFeatureLimits = Record<FeatureName, FeatureLimit>;

/** The tier an unknown/unrecognised plan falls back to. */
export const DEFAULT_TIER: PlanTier = 'free';

export const FEATURE_LIMITS: Record<PlanTier, PlanFeatureLimits> = {
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

function resolveTier(plan: string): PlanTier {
  return (
    Object.prototype.hasOwnProperty.call(FEATURE_LIMITS, plan) ? plan : DEFAULT_TIER
  ) as PlanTier;
}

/**
 * Returns the limit for a feature on the given plan.
 *
 * - Numeric features (e.g. `max_courses`) return a number; unlimited is `Infinity`.
 * - Boolean features (e.g. `analytics`) return `true`/`false`.
 * - Unknown plans fall back to the free tier.
 * - Unknown features return `false`.
 */
export function getFeatureLimit(plan: string, feature: FeatureName): FeatureLimit {
  const limits = FEATURE_LIMITS[resolveTier(plan)];
  const limit = limits[feature];

  return limit === undefined ? false : limit;
}

/**
 * Returns whether the plan has access to the feature.
 *
 * - Boolean features map directly to their flag.
 * - Numeric features are accessible when their limit is greater than zero.
 * - Unknown plans fall back to the free tier; unknown features are not accessible.
 */
export function canAccessFeature(plan: string, feature: FeatureName): boolean {
  const limit = getFeatureLimit(plan, feature);

  if (typeof limit === 'boolean') {
    return limit;
  }

  return limit > 0;
}
