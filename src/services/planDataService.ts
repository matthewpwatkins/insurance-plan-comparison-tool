import yaml from 'js-yaml';
import { PlanData, HealthPlan } from '../types';

/**
 * Load and parse plan data for a given year
 */
export const loadPlanData = async (year: number): Promise<PlanData> => {
  try {
    const response = await fetch(`/${year}.yml`);
    if (!response.ok) {
      throw new Error(`Failed to fetch plan data for ${year}: ${response.statusText}`);
    }

    const yamlText = await response.text();
    const planData = yaml.load(yamlText) as PlanData;

    // Validate the structure
    if (!planData || !planData.plans || !Array.isArray(planData.plans)) {
      throw new Error('Invalid plan data structure');
    }

    return planData;
  } catch (error) {
    console.error('Error loading plan data:', error);
    throw error;
  }
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