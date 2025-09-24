import yaml from 'js-yaml';

/**
 * Load and parse plan data for a given year
 * @param {number} year - The year to load data for (2025 or 2026)
 * @returns {Promise<Object>} Parsed plan data
 */
export const loadPlanData = async (year) => {
  try {
    const response = await fetch(`/${year}.yml`);
    if (!response.ok) {
      throw new Error(`Failed to fetch plan data for ${year}: ${response.statusText}`);
    }

    const yamlText = await response.text();
    const planData = yaml.load(yamlText);

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
 * @param {Object} planData - The loaded plan data
 * @param {string} coverage - Coverage type ('single', 'two_party', 'family')
 * @param {string} ageGroup - Age group ('under_55' or '55_plus')
 * @returns {number} Maximum HSA contribution allowed
 */
export const getMaxHSAContribution = (planData, coverage, ageGroup) => {
  if (!planData.hsa_contribution_limits) {
    return 0;
  }

  const limits = planData.hsa_contribution_limits;
  let maxContribution;

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
 * @param {Object} planData - The loaded plan data
 * @returns {number} Maximum FSA contribution allowed
 */
export const getMaxFSAContribution = (planData) => {
  return planData.fsa_contribution_limits?.healthcare_fsa || 0;
};

/**
 * Get employer HSA contribution for a specific plan and coverage type
 * @param {Object} plan - The specific plan object
 * @param {string} coverage - Coverage type ('single', 'two_party', 'family')
 * @returns {number} Employer HSA contribution amount
 */
export const getEmployerHSAContribution = (plan, coverage) => {
  if (plan.type !== 'HSA' || !plan.employer_hsa_contribution) {
    return 0;
  }

  return plan.employer_hsa_contribution[coverage] || 0;
};