import { getPlanData, getAvailableYears, getLatestYear, getCompanyData } from '../generated/dataHelpers';
import { PlanData, HealthPlan } from '../types';

/**
 * Load and parse plan data for a given year (synchronous, compile-time loaded)
 */
export const loadPlanData = (year: number): PlanData => {
  try {
    const planData = getPlanData(year);

    // Validate the structure
    if (!planData || !planData.plans || !Array.isArray(planData.plans)) {
      throw new Error('Invalid plan data structure');
    }

    // Add company prefix to plan names if not already present
    const companyData = getCompanyData();
    const companyPrefix = companyData.company?.shortName;

    if (companyPrefix) {
      planData.plans = planData.plans.map(plan => ({
        ...plan,
        name: plan.name.startsWith(companyPrefix) ? plan.name : `${companyPrefix} ${plan.name}`
      }));
    }

    return planData;
  } catch (error) {
    console.error('Error loading plan data:', error);
    throw error;
  }
};

/**
 * Get all available years
 */
export const getAvailableDataYears = (): number[] => {
  return getAvailableYears();
};

/**
 * Get the most recent year available
 */
export const getDefaultYear = (): number => {
  return getLatestYear();
};

/**
 * Get HSA contribution limits for a given year and coverage type
 */
export const getMaxHSAContribution = (
  planData: PlanData,
  coverage: 'single' | 'two_party' | 'family',
  ageGroup: 'under_55' | '55_plus'
): number => {
  if (!planData.hsa_contribution_limits) {
    return 0;
  }

  const limits = planData.hsa_contribution_limits;
  let maxContribution: number;

  if (coverage === 'single') {
    maxContribution = limits.single_coverage;
  } else {
    maxContribution = limits.family_coverage;
  }

  // Add catch-up contribution for users 55 and older
  if (ageGroup === '55_plus') {
    maxContribution += limits.catch_up_age_55_plus;
  }

  return maxContribution;
};

/**
 * Get FSA contribution limits for a given year
 */
export const getMaxFSAContribution = (planData: PlanData): number => {
  return planData.fsa_contribution_limits?.healthcare_fsa || 0;
};

/**
 * Get employer HSA contribution for a specific plan and coverage type
 */
export const getEmployerHSAContribution = (
  plan: HealthPlan,
  coverage: 'single' | 'two_party' | 'family'
): number => {
  if (plan.type !== 'HSA' || !plan.employer_hsa_contribution) {
    return 0;
  }

  return plan.employer_hsa_contribution[coverage] || 0;
};