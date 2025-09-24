import { getMaxHSAContribution, getMaxFSAContribution, getEmployerHSAContribution } from '../services/planDataService';

/**
 * Calculate costs for all plans given user inputs and plan data
 * @param {Object} planData - Loaded plan data for the year
 * @param {Object} userInputs - User's inputs (age, coverage, costs, etc.)
 * @returns {Array} Array of plan results sorted by total cost
 */
export const calculateAllPlans = (planData, userInputs) => {
  const results = planData.plans.map(plan => calculatePlanCost(plan, planData, userInputs));

  // Sort by total cost (lowest first)
  return results.sort((a, b) => a.totalCost - b.totalCost);
};

/**
 * Calculate cost breakdown for a single plan
 * @param {Object} plan - Individual plan object
 * @param {Object} planData - Full plan data (for limits, etc.)
 * @param {Object} userInputs - User's inputs
 * @returns {Object} Cost breakdown for this plan
 */
export const calculatePlanCost = (plan, planData, userInputs) => {
  const { coverage, ageGroup, taxRate, costs } = userInputs;
  const taxRateDecimal = taxRate / 100; // Convert percentage to decimal

  // Calculate annual premiums
  const annualPremiums = plan.monthly_premiums[coverage] * 12;

  // Calculate user's HSA/FSA contributions and tax savings
  const { userContribution, employerContribution, taxSavings } = calculateContributionsAndTaxSavings(
    plan, planData, userInputs, taxRateDecimal
  );

  // Calculate out-of-pocket healthcare costs
  const outOfPocketCosts = calculateOutOfPocketCosts(plan, costs, coverage);

  // Calculate total cost
  const totalCost = annualPremiums + outOfPocketCosts - taxSavings;

  return {
    planName: plan.name,
    planType: plan.type,
    annualPremiums,
    userContribution,
    employerContribution,
    totalContributions: userContribution + employerContribution,
    taxSavings,
    outOfPocketCosts,
    totalCost: Math.max(0, totalCost), // Ensure non-negative
    breakdown: {
      premiums: annualPremiums,
      taxSavings: -taxSavings, // Negative because it reduces total cost
      outOfPocket: outOfPocketCosts,
      net: totalCost
    }
  };
};

/**
 * Calculate user and employer contributions and resulting tax savings
 */
const calculateContributionsAndTaxSavings = (plan, planData, userInputs, taxRateDecimal) => {
  const { coverage, ageGroup } = userInputs;

  let userContribution = 0;
  let employerContribution = 0;
  let taxSavings = 0;

  if (plan.type === 'HSA') {
    // HSA plans
    employerContribution = getEmployerHSAContribution(plan, coverage);
    const maxHSAContribution = getMaxHSAContribution(planData, coverage, ageGroup);

    // User contributes their specified amount (up to remaining space)
    const remainingHSASpace = maxHSAContribution - employerContribution;
    userContribution = Math.min(userInputs.hsaContribution, remainingHSASpace);

    // Tax savings on total HSA contributions
    taxSavings = (userContribution + employerContribution) * taxRateDecimal;
  } else {
    // PPO plans with FSA
    const maxFSAContribution = getMaxFSAContribution(planData);
    userContribution = Math.min(userInputs.fsaContribution, maxFSAContribution);

    // Tax savings only on user FSA contributions
    taxSavings = userContribution * taxRateDecimal;
  }

  return { userContribution, employerContribution, taxSavings };
};

/**
 * Calculate out-of-pocket healthcare costs based on plan rules
 * This is the simple version - will be extended for detailed cost breakdown later
 */
const calculateOutOfPocketCosts = (plan, costs, coverage) => {
  if (costs.costInputMode === 'detailed') {
    // TODO: Implement detailed cost calculation
    return calculateDetailedOutOfPocketCosts(plan, costs, coverage);
  }

  // Simple calculation - assume all costs are in-network for now
  return calculateSimpleOutOfPocketCosts(plan, costs.totalAnnualCosts, coverage);
};

/**
 * Simple out-of-pocket calculation
 * Assumes all costs are subject to deductible, then coinsurance, capped at OOP max
 */
const calculateSimpleOutOfPocketCosts = (plan, totalCosts, coverage) => {
  // Get plan parameters (assuming in-network for simple calculation)
  const deductible = getDeductibleForCoverage(plan, coverage, 'in_network');
  const oopMax = getOOPMaxForCoverage(plan, coverage, 'in_network');

  let remainingCosts = totalCosts;
  let outOfPocket = 0;

  // Apply deductible first
  const deductiblePaid = Math.min(remainingCosts, deductible);
  outOfPocket += deductiblePaid;
  remainingCosts -= deductiblePaid;

  // If there are remaining costs, apply coinsurance
  if (remainingCosts > 0) {
    // For simplicity, assume average coinsurance of 20% for in-network
    // (This would be more sophisticated in the detailed version)
    const coinsuranceRate = 0.20;
    const coinsurancePaid = remainingCosts * coinsuranceRate;
    outOfPocket += coinsurancePaid;
  }

  // Cap at out-of-pocket maximum
  return Math.min(outOfPocket, oopMax);
};

/**
 * Placeholder for detailed out-of-pocket calculation
 * Will be implemented when adding detailed cost breakdown
 */
const calculateDetailedOutOfPocketCosts = (plan, costs, coverage) => {
  // TODO: Implement detailed calculation by service type
  // This will handle specific copays, coinsurance rates, etc.
  return 0;
};

/**
 * Helper function to get deductible for coverage type
 */
const getDeductibleForCoverage = (plan, coverage, network) => {
  const deductible = plan.annual_deductible[network];
  if (coverage === 'single') {
    return deductible.single;
  } else {
    // Both two_party and family use the family deductible
    return deductible.family;
  }
};

/**
 * Helper function to get out-of-pocket maximum for coverage type
 */
const getOOPMaxForCoverage = (plan, coverage, network) => {
  const oopMax = plan.out_of_pocket_maximum[network];
  if (coverage === 'single') {
    return oopMax.individual;
  } else {
    // Both two_party and family use the family out-of-pocket maximum
    return oopMax.family;
  }
};