import { getMaxHSAContribution, getMaxFSAContribution, getEmployerHSAContribution } from '../services/planDataService';
import { PlanData, HealthPlan, UserInputs, PlanResult, UserCosts } from '../types';

/**
 * Calculate costs for all plans given user inputs and plan data
 */
export const calculateAllPlans = (planData: PlanData, userInputs: UserInputs): PlanResult[] => {
  const results = planData.plans.map(plan => calculatePlanCost(plan, planData, userInputs));

  // Sort by total cost (lowest first)
  return results.sort((a, b) => a.totalCost - b.totalCost);
};

/**
 * Calculate cost breakdown for a single plan
 */
export const calculatePlanCost = (plan: HealthPlan, planData: PlanData, userInputs: UserInputs): PlanResult => {
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
    totalCost: totalCost, // Can be negative if tax savings exceed costs
    breakdown: {
      premiums: annualPremiums,
      taxSavings: -taxSavings, // Negative because it reduces total cost
      outOfPocket: outOfPocketCosts,
      net: totalCost
    }
  };
};

interface ContributionResult {
  userContribution: number;
  employerContribution: number;
  taxSavings: number;
}

/**
 * Calculate user and employer contributions and resulting tax savings
 */
const calculateContributionsAndTaxSavings = (
  plan: HealthPlan,
  planData: PlanData,
  userInputs: UserInputs,
  taxRateDecimal: number
): ContributionResult => {
  const { coverage, ageGroup } = userInputs;

  let userContribution = 0;
  let employerContribution = 0;
  let taxSavings = 0;

  if (plan.type === 'HSA') {
    // HSA plans
    employerContribution = getEmployerHSAContribution(plan, coverage);
    const maxHSAContribution = getMaxHSAContribution(planData, coverage, ageGroup);

    // userInputs.hsaContribution now represents total contribution desired
    const totalDesiredContribution = Math.min(userInputs.hsaContribution, maxHSAContribution);
    userContribution = Math.max(0, totalDesiredContribution - employerContribution);

    // Tax savings on total HSA contributions (user + employer)
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
 * Uses category-specific costs and default rates for "other" costs
 */
const calculateOutOfPocketCosts = (
  plan: HealthPlan,
  costs: UserCosts,
  coverage: 'single' | 'two_party' | 'family'
): number => {
  let totalOutOfPocket = 0;

  // Process each category estimate
  for (const estimate of costs.categoryEstimates) {
    const categoryOutOfPocket = calculateCategoryOutOfPocketCosts(
      plan,
      estimate.categoryId,
      estimate.inNetworkCost,
      estimate.outOfNetworkCost,
      coverage
    );
    totalOutOfPocket += categoryOutOfPocket;
  }

  // Process "other" costs using default plan coverage
  if (costs.otherCosts && (costs.otherCosts.inNetworkCost > 0 || costs.otherCosts.outOfNetworkCost > 0)) {
    const otherOutOfPocket = calculateOtherOutOfPocketCosts(
      plan,
      costs.otherCosts.inNetworkCost,
      costs.otherCosts.outOfNetworkCost,
      coverage
    );
    totalOutOfPocket += otherOutOfPocket;
  }

  // Cap at plan's out-of-pocket maximum (simplified - in reality this is more complex)
  const oopMaxInNetwork = getOOPMaxForCoverage(plan, coverage, 'in_network');
  return Math.min(totalOutOfPocket, oopMaxInNetwork);
};


/**
 * Calculate out-of-pocket costs for a specific category
 */
const calculateCategoryOutOfPocketCosts = (
  plan: HealthPlan,
  categoryId: string,
  inNetworkCost: number,
  outOfNetworkCost: number,
  coverage: 'single' | 'two_party' | 'family'
): number => {
  let outOfPocket = 0;

  // Get category-specific coverage or fall back to default
  const categoryBenefits = plan.categories[categoryId] || plan.default;

  // Calculate in-network costs
  if (inNetworkCost > 0 && categoryBenefits.in_network_coverage) {
    outOfPocket += calculateCostWithBenefits(
      inNetworkCost,
      categoryBenefits.in_network_coverage,
      plan,
      coverage,
      'in_network'
    );
  }

  // Calculate out-of-network costs
  if (outOfNetworkCost > 0 && categoryBenefits.out_of_network_coverage) {
    outOfPocket += calculateCostWithBenefits(
      outOfNetworkCost,
      categoryBenefits.out_of_network_coverage,
      plan,
      coverage,
      'out_of_network'
    );
  }

  return outOfPocket;
};

/**
 * Calculate out-of-pocket costs for "other" costs using default plan coverage
 */
const calculateOtherOutOfPocketCosts = (
  plan: HealthPlan,
  inNetworkCost: number,
  outOfNetworkCost: number,
  coverage: 'single' | 'two_party' | 'family'
): number => {
  let outOfPocket = 0;

  // Use default plan coverage
  const defaultBenefits = plan.default;

  // Calculate in-network costs
  if (inNetworkCost > 0 && defaultBenefits.in_network_coverage) {
    outOfPocket += calculateCostWithBenefits(
      inNetworkCost,
      defaultBenefits.in_network_coverage,
      plan,
      coverage,
      'in_network'
    );
  }

  // Calculate out-of-network costs
  if (outOfNetworkCost > 0 && defaultBenefits.out_of_network_coverage) {
    outOfPocket += calculateCostWithBenefits(
      outOfNetworkCost,
      defaultBenefits.out_of_network_coverage,
      plan,
      coverage,
      'out_of_network'
    );
  }

  return outOfPocket;
};

/**
 * Calculate cost with specific benefit structure (copay, coinsurance, etc.)
 */
const calculateCostWithBenefits = (
  totalCost: number,
  benefits: { copay?: number; coinsurance?: number; max_coinsurance?: number },
  plan: HealthPlan,
  coverage: 'single' | 'two_party' | 'family',
  network: 'in_network' | 'out_of_network'
): number => {
  // If there's a copay, that's the out-of-pocket cost (simplified)
  if (benefits.copay !== undefined) {
    return benefits.copay;
  }

  // If there's coinsurance, calculate based on that
  if (benefits.coinsurance !== undefined) {
    let outOfPocket = totalCost * benefits.coinsurance;

    // Apply max coinsurance cap if specified
    if (benefits.max_coinsurance !== undefined) {
      outOfPocket = Math.min(outOfPocket, benefits.max_coinsurance);
    }

    return outOfPocket;
  }

  // If no specific benefits, assume full deductible + coinsurance (simplified)
  const deductible = getDeductibleForCoverage(plan, coverage, network);
  const deductiblePortion = Math.min(totalCost, deductible);
  const remainingCost = Math.max(0, totalCost - deductible);

  // Assume 20% coinsurance after deductible as fallback
  const coinsurancePortion = remainingCost * 0.2;

  return deductiblePortion + coinsurancePortion;
};

/**
 * Helper function to get deductible for coverage type
 */
const getDeductibleForCoverage = (
  plan: HealthPlan,
  coverage: 'single' | 'two_party' | 'family',
  network: 'in_network' | 'out_of_network'
): number => {
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
const getOOPMaxForCoverage = (
  plan: HealthPlan,
  coverage: 'single' | 'two_party' | 'family',
  network: 'in_network' | 'out_of_network'
): number => {
  const oopMax = plan.out_of_pocket_maximum[network];
  if (coverage === 'single') {
    return oopMax.individual;
  } else {
    // Both two_party and family use the family out-of-pocket maximum
    return oopMax.family;
  }
};