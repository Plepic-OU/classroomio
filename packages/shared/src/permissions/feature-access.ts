export type FeatureName =
  | 'max_courses'
  | 'max_students'
  | 'custom_domain'
  | 'analytics'
  | 'certificates'
  | 'community'
  | 'api_access';

type PlanTier = 'free' | 'basic' | 'pro';

type PlanConfig = {
  max_courses: number;
  max_students: number;
  custom_domain: boolean;
  analytics: boolean;
  certificates: boolean;
  community: boolean;
  api_access: boolean;
};

const PLAN_CONFIG: Record<PlanTier, PlanConfig> = {
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

const FREE_CONFIG = PLAN_CONFIG.free;

function resolveConfig(plan: string): PlanConfig {
  return (PLAN_CONFIG as Record<string, PlanConfig>)[plan] ?? FREE_CONFIG;
}

export function canAccessFeature(plan: string, feature: FeatureName): boolean {
  const config = resolveConfig(plan);
  const value = config[feature];
  if (typeof value === 'boolean') return value;
  return (value as number) > 0;
}

export function getFeatureLimit(plan: string, feature: FeatureName): number | boolean {
  const config = resolveConfig(plan);
  return config[feature];
}
