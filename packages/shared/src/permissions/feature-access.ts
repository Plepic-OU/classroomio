import { PLAN } from '../plans/constants';

export type FeatureName =
  | 'max_courses'
  | 'max_students'
  | 'custom_domain'
  | 'analytics'
  | 'certificates'
  | 'community'
  | 'api_access';

interface PlanFeatures {
  max_courses: number;
  max_students: number;
  custom_domain: boolean;
  analytics: boolean;
  certificates: boolean;
  community: boolean;
  api_access: boolean;
}

export const FEATURE_LIMITS: Record<string, PlanFeatures> = {
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

function resolveLimits(plan: string): PlanFeatures {
  return FEATURE_LIMITS[plan] ?? FEATURE_LIMITS[PLAN.BASIC];
}

/**
 * Whether the plan has access to the given feature.
 * Unknown plans default to the free (BASIC) tier.
 */
export function canAccessFeature(plan: string, feature: FeatureName): boolean {
  const limits = resolveLimits(plan);
  const value = limits[feature];
  if (typeof value === 'boolean') return value;
  // Numeric limits: accessible if limit > 0
  return value > 0;
}

/**
 * Returns the numeric limit or boolean for a feature on the given plan.
 * Unlimited features return Infinity. Unknown plans default to free tier.
 */
export function getFeatureLimit(plan: string, feature: FeatureName): number | boolean {
  const limits = resolveLimits(plan);
  return limits[feature];
}
