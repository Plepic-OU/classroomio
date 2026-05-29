import { describe, it, expect } from 'vitest';
import {
  canAccessFeature,
  getFeatureLimit,
  FEATURE_LIMITS,
  type FeatureName,
  type PlanTier,
} from './feature-access';

describe('feature-access', () => {
  describe('FEATURE_LIMITS', () => {
    it('should define limits for all plan tiers', () => {
      expect(FEATURE_LIMITS).toHaveProperty('BASIC');
      expect(FEATURE_LIMITS).toHaveProperty('EARLY_ADOPTER');
      expect(FEATURE_LIMITS).toHaveProperty('ENTERPRISE');
    });

    it('should have all required features for each plan', () => {
      const requiredFeatures: FeatureName[] = [
        'max_courses',
        'max_students',
        'custom_domain',
        'analytics',
        'certificates',
        'community',
        'api_access',
      ];

      const plans: PlanTier[] = ['BASIC', 'EARLY_ADOPTER', 'ENTERPRISE'];

      plans.forEach((plan) => {
        requiredFeatures.forEach((feature) => {
          expect(FEATURE_LIMITS[plan]).toHaveProperty(feature);
        });
      });
    });
  });

  describe('canAccessFeature', () => {
    describe('BASIC plan', () => {
      it('should have access to certificates and community', () => {
        expect(canAccessFeature('BASIC', 'certificates')).toBe(true);
        expect(canAccessFeature('BASIC', 'community')).toBe(true);
      });

      it('should not have access to custom_domain, analytics, or api_access', () => {
        expect(canAccessFeature('BASIC', 'custom_domain')).toBe(false);
        expect(canAccessFeature('BASIC', 'analytics')).toBe(false);
        expect(canAccessFeature('BASIC', 'api_access')).toBe(false);
      });

      it('should have numeric limits for courses and students', () => {
        expect(canAccessFeature('BASIC', 'max_courses')).toBe(true);
        expect(canAccessFeature('BASIC', 'max_students')).toBe(true);
      });
    });

    describe('EARLY_ADOPTER plan', () => {
      it('should have access to analytics, certificates, and community', () => {
        expect(canAccessFeature('EARLY_ADOPTER', 'analytics')).toBe(true);
        expect(canAccessFeature('EARLY_ADOPTER', 'certificates')).toBe(true);
        expect(canAccessFeature('EARLY_ADOPTER', 'community')).toBe(true);
      });

      it('should not have access to custom_domain or api_access', () => {
        expect(canAccessFeature('EARLY_ADOPTER', 'custom_domain')).toBe(false);
        expect(canAccessFeature('EARLY_ADOPTER', 'api_access')).toBe(false);
      });

      it('should have numeric limits for courses and students', () => {
        expect(canAccessFeature('EARLY_ADOPTER', 'max_courses')).toBe(true);
        expect(canAccessFeature('EARLY_ADOPTER', 'max_students')).toBe(true);
      });
    });

    describe('ENTERPRISE plan', () => {
      it('should have access to all features', () => {
        const features: FeatureName[] = [
          'max_courses',
          'max_students',
          'custom_domain',
          'analytics',
          'certificates',
          'community',
          'api_access',
        ];

        features.forEach((feature) => {
          expect(canAccessFeature('ENTERPRISE', feature)).toBe(true);
        });
      });
    });

    describe('Unknown plan', () => {
      it('should default to BASIC tier', () => {
        expect(canAccessFeature('UNKNOWN', 'certificates')).toBe(true);
        expect(canAccessFeature('UNKNOWN', 'analytics')).toBe(false);
      });

      it('should handle undefined as BASIC', () => {
        expect(canAccessFeature(undefined, 'certificates')).toBe(true);
      });

      it('should handle null as BASIC', () => {
        expect(canAccessFeature(null, 'certificates')).toBe(true);
      });
    });

    describe('Unknown feature', () => {
      it('should return false for unknown features', () => {
        expect(canAccessFeature('BASIC', 'unknown_feature' as FeatureName)).toBe(false);
        expect(canAccessFeature('ENTERPRISE', 'unknown_feature' as FeatureName)).toBe(false);
      });
    });
  });

  describe('getFeatureLimit', () => {
    describe('BASIC plan', () => {
      it('should return correct course limit', () => {
        expect(getFeatureLimit('BASIC', 'max_courses')).toBe(3);
      });

      it('should return correct student limit', () => {
        expect(getFeatureLimit('BASIC', 'max_students')).toBe(30);
      });

      it('should return boolean false for disabled features', () => {
        expect(getFeatureLimit('BASIC', 'custom_domain')).toBe(false);
        expect(getFeatureLimit('BASIC', 'analytics')).toBe(false);
        expect(getFeatureLimit('BASIC', 'api_access')).toBe(false);
      });

      it('should return boolean true for enabled boolean features', () => {
        expect(getFeatureLimit('BASIC', 'certificates')).toBe(true);
        expect(getFeatureLimit('BASIC', 'community')).toBe(true);
      });
    });

    describe('EARLY_ADOPTER plan', () => {
      it('should return correct course limit', () => {
        expect(getFeatureLimit('EARLY_ADOPTER', 'max_courses')).toBe(25);
      });

      it('should return correct student limit', () => {
        expect(getFeatureLimit('EARLY_ADOPTER', 'max_students')).toBe(200);
      });

      it('should return true for enabled boolean features', () => {
        expect(getFeatureLimit('EARLY_ADOPTER', 'analytics')).toBe(true);
        expect(getFeatureLimit('EARLY_ADOPTER', 'certificates')).toBe(true);
        expect(getFeatureLimit('EARLY_ADOPTER', 'community')).toBe(true);
      });
    });

    describe('ENTERPRISE plan', () => {
      it('should return Infinity for numeric limits', () => {
        expect(getFeatureLimit('ENTERPRISE', 'max_courses')).toBe(Infinity);
        expect(getFeatureLimit('ENTERPRISE', 'max_students')).toBe(Infinity);
      });

      it('should return true for all boolean features', () => {
        expect(getFeatureLimit('ENTERPRISE', 'custom_domain')).toBe(true);
        expect(getFeatureLimit('ENTERPRISE', 'analytics')).toBe(true);
        expect(getFeatureLimit('ENTERPRISE', 'certificates')).toBe(true);
        expect(getFeatureLimit('ENTERPRISE', 'community')).toBe(true);
        expect(getFeatureLimit('ENTERPRISE', 'api_access')).toBe(true);
      });
    });

    describe('Unknown plan', () => {
      it('should default to BASIC tier', () => {
        expect(getFeatureLimit('UNKNOWN', 'max_courses')).toBe(3);
        expect(getFeatureLimit('UNKNOWN', 'certificates')).toBe(true);
      });

      it('should handle undefined as BASIC', () => {
        expect(getFeatureLimit(undefined, 'max_courses')).toBe(3);
      });
    });

    describe('Unknown feature', () => {
      it('should return false for unknown features', () => {
        expect(getFeatureLimit('BASIC', 'unknown_feature' as FeatureName)).toBe(false);
        expect(getFeatureLimit('ENTERPRISE', 'unknown_feature' as FeatureName)).toBe(false);
      });
    });
  });

  describe('Integration scenarios', () => {
    it('BASIC plan: 3 courses, 30 students max', () => {
      expect(getFeatureLimit('BASIC', 'max_courses')).toBe(3);
      expect(getFeatureLimit('BASIC', 'max_students')).toBe(30);
    });

    it('EARLY_ADOPTER plan: 25 courses, 200 students max', () => {
      expect(getFeatureLimit('EARLY_ADOPTER', 'max_courses')).toBe(25);
      expect(getFeatureLimit('EARLY_ADOPTER', 'max_students')).toBe(200);
    });

    it('ENTERPRISE plan: unlimited courses and students', () => {
      expect(getFeatureLimit('ENTERPRISE', 'max_courses')).toBe(Infinity);
      expect(getFeatureLimit('ENTERPRISE', 'max_students')).toBe(Infinity);
    });

    it('should correctly check limits with canAccessFeature', () => {
      // BASIC: 3 courses limit
      expect(canAccessFeature('BASIC', 'max_courses')).toBe(true);
      const basicLimit = getFeatureLimit('BASIC', 'max_courses');
      expect(basicLimit).toBe(3);

      // ENTERPRISE: no limit
      expect(canAccessFeature('ENTERPRISE', 'max_courses')).toBe(true);
      const enterpriseLimit = getFeatureLimit('ENTERPRISE', 'max_courses');
      expect(enterpriseLimit).toBe(Infinity);
    });
  });
});
