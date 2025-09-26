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

  // Create plan execution to track expenses
  const execution = new PlanExecution(plan, coverage);

  // Process all category expenses
  for (const estimate of costs.categoryEstimates) {
    // Process in-network visits
    for (let i = 0; i < estimate.inNetwork.quantity; i++) {
      execution.recordExpense(estimate.categoryId, estimate.inNetwork.costPerVisit, 'in_network');
    }
    // Process out-of-network visits
    for (let i = 0; i < estimate.outOfNetwork.quantity; i++) {
      execution.recordExpense(estimate.categoryId, estimate.outOfNetwork.costPerVisit, 'out_of_network');
    }
  }


  const outOfPocketCosts = execution.getTotalOutOfPocket();

  // Calculate total cost (employer contributions reduce total cost as they're free money)
  const totalCost = annualPremiums + outOfPocketCosts - taxSavings - employerContribution;

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
      employerContribution: -employerContribution, // Negative because it reduces total cost
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

    // userInputs.hsaContribution now represents employee contribution only
    userContribution = Math.min(userInputs.hsaContribution, maxHSAContribution - employerContribution);

    // Tax savings on employee HSA contributions include income tax + payroll taxes
    const payrollTaxRate = (planData.payroll_tax_rates.social_security + planData.payroll_tax_rates.medicare) / 100;
    taxSavings = userContribution * (taxRateDecimal + payrollTaxRate);
  } else {
    // PPO plans with FSA
    const maxFSAContribution = getMaxFSAContribution(planData);
    userContribution = Math.min(userInputs.fsaContribution, maxFSAContribution);

    // Tax savings on user FSA contributions include income tax + payroll taxes
    const payrollTaxRate = (planData.payroll_tax_rates.social_security + planData.payroll_tax_rates.medicare) / 100;
    taxSavings = userContribution * (taxRateDecimal + payrollTaxRate);
  }

  return { userContribution, employerContribution, taxSavings };
};

/**
 * Plan execution class to track expenses and calculate out-of-pocket costs
 * Based on the prototype implementation from v2025.01 branch
 */
class PlanExecution {
  private plan: HealthPlan;
  private coverage: 'single' | 'two_party' | 'family';
  private outOfPocketSpent: number = 0;
  private deductibleSpent: number = 0;

  constructor(plan: HealthPlan, coverage: 'single' | 'two_party' | 'family') {
    this.plan = plan;
    this.coverage = coverage;
  }

  /**
   * Record a single expense and calculate the out-of-pocket cost
   * This is where the proper deductible and OOP logic happens
   */
  recordExpense(categoryId: string, cost: number, network: 'in_network' | 'out_of_network' = 'in_network'): void {
    if (this.oopRemaining() <= 0) {
      return; // Already hit out-of-pocket maximum
    }

    const benefits = this.getCategoryBenefits(categoryId, network);
    if (!benefits) {
      return; // No coverage
    }

    // If there's a copay, that's the full out-of-pocket cost for this visit
    const copay = benefits.copay || 0;
    if (copay > 0) {
      const applicableCopay = Math.min(copay, this.oopRemaining());
      this.outOfPocketSpent += applicableCopay;
      return; // Copay covers the visit, no deductible or coinsurance applies
    }

    let remainingCost = cost;

    // Apply deductible first
    const applicableDeductible = Math.min(this.deductibleRemaining(), remainingCost, this.oopRemaining());
    this.outOfPocketSpent += applicableDeductible;
    this.deductibleSpent += applicableDeductible; // Track deductible separately
    remainingCost -= applicableDeductible;

    // Apply coinsurance to remaining cost after deductible
    const coinsurance = benefits.coinsurance || 0;
    if (coinsurance > 0 && remainingCost > 0) {
      let coinsuranceAmount = remainingCost * coinsurance;

      // Apply max coinsurance cap if specified
      if (benefits.max_coinsurance !== undefined) {
        coinsuranceAmount = Math.min(coinsuranceAmount, benefits.max_coinsurance);
      }

      const applicableCoinsurance = Math.min(coinsuranceAmount, this.oopRemaining());
      this.outOfPocketSpent += applicableCoinsurance;
    }

    // Insurance covers the rest
  }

  getTotalOutOfPocket(): number {
    return this.outOfPocketSpent;
  }

  private oopRemaining(): number {
    const oopMax = this.getOOPMaxForCoverage();
    return Math.max(0, oopMax - this.outOfPocketSpent);
  }

  private deductibleRemaining(): number {
    const deductible = this.getDeductibleForCoverage();
    // Only count non-copay expenses toward deductible
    // This is more complex than the current implementation allows
    // For now, use a simple approach - track deductible separately
    return Math.max(0, deductible - this.deductibleSpent);
  }

  private getCategoryBenefits(categoryId: string, network: 'in_network' | 'out_of_network') {
    // Check if this category has specific benefits
    if (categoryId !== 'other' && this.plan.categories[categoryId]) {
      if (network === 'in_network') {
        return this.plan.categories[categoryId].in_network_coverage;
      } else {
        return this.plan.categories[categoryId].out_of_network_coverage;
      }
    }

    // Fall back to default plan coverage (for "other" costs or unknown categories)
    if (network === 'in_network') {
      return this.plan.default.in_network_coverage;
    } else {
      return this.plan.default.out_of_network_coverage;
    }
  }

  private getDeductibleForCoverage(): number {
    const deductible = this.plan.annual_deductible.in_network;
    if (this.coverage === 'single') {
      return deductible.single;
    } else {
      // Both two_party and family use the family deductible
      return deductible.family;
    }
  }

  private getOOPMaxForCoverage(): number {
    const oopMax = this.plan.out_of_pocket_maximum.in_network;
    if (this.coverage === 'single') {
      return oopMax.individual;
    } else {
      // Both two_party and family use the family out-of-pocket maximum
      return oopMax.family;
    }
  }
}