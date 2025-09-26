import { getMaxHSAContribution, getMaxFSAContribution, getEmployerHSAContribution } from '../services/planDataService';
import { getCategoriesData } from '../generated/dataHelpers';
import { PlanData, HealthPlan, UserInputs, PlanResult, UserCosts, OrganizedLedger, ContributionEntry, PremiumEntry, ExpenseEntry } from '../types';

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

  // Add monthly premiums to ledger
  execution.addMonthlyPremiums(plan.monthly_premiums[coverage]);

  // Add employer contribution to ledger
  execution.addEmployerContribution(employerContribution);

  // Add tax savings to ledger
  const contributionType = plan.type === 'HSA' ? 'HSA' : 'FSA';
  execution.addTaxSavings(taxSavings, contributionType);

  // Process all category expenses
  for (const estimate of costs.categoryEstimates) {
    // Process in-network visits
    for (let i = 0; i < estimate.inNetwork.quantity; i++) {
      execution.recordExpense(estimate.categoryId, estimate.inNetwork.costPerVisit, 'in_network', estimate.notes);
    }
    // Process out-of-network visits
    for (let i = 0; i < estimate.outOfNetwork.quantity; i++) {
      execution.recordExpense(estimate.categoryId, estimate.outOfNetwork.costPerVisit, 'out_of_network', estimate.notes);
    }
  }

  const outOfPocketCosts = execution.getTotalOutOfPocket();
  const ledger = execution.getLedger();

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
    },
    ledger
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
 * Generates organized ledger with separate tables for different cost types
 */
class PlanExecution {
  private plan: HealthPlan;
  private coverage: 'single' | 'two_party' | 'family';
  private outOfPocketSpent: number = 0;
  private deductibleSpent: number = 0;
  private contributionsAndSavings: ContributionEntry[] = [];
  private premiums: PremiumEntry[] = [];
  private inNetworkExpenses: ExpenseEntry[] = [];
  private outOfNetworkExpenses: ExpenseEntry[] = [];
  private categoriesData = getCategoriesData();

  constructor(plan: HealthPlan, coverage: 'single' | 'two_party' | 'family') {
    this.plan = plan;
    this.coverage = coverage;
  }

  /**
   * Add monthly premium entries to the ledger
   */
  addMonthlyPremiums(monthlyPremium: number): void {
    for (let month = 1; month <= 12; month++) {
      this.premiums.push({
        type: 'premium',
        description: `Month ${month}`,
        amount: monthlyPremium
      });
    }
  }

  /**
   * Add employer HSA contribution entry to the ledger
   */
  addEmployerContribution(amount: number): void {
    if (amount > 0) {
      this.contributionsAndSavings.push({
        type: 'contribution',
        description: 'Employer HSA contribution',
        amount: amount
      });
    }
  }

  /**
   * Add tax savings entry to the ledger
   */
  addTaxSavings(amount: number, contributionType: 'HSA' | 'FSA'): void {
    if (amount > 0) {
      this.contributionsAndSavings.push({
        type: 'savings',
        description: `Tax savings from ${contributionType} contributions`,
        amount: amount
      });
    }
  }

  /**
   * Record a single expense and calculate the out-of-pocket cost
   */
  recordExpense(categoryId: string, cost: number, network: 'in_network' | 'out_of_network' = 'in_network', notes?: string): void {
    const benefits = this.getCategoryBenefits(categoryId, network);
    if (!benefits) {
      return; // No coverage
    }

    // Get category information
    const categoryInfo = this.categoriesData[categoryId];
    const categoryDisplayName = categoryInfo?.name || (categoryId === 'other' ? 'Other' : categoryId);
    const isPreventive = categoryInfo?.preventive || false;
    const isFree = benefits.is_free || false;

    let employeeResponsibility = 0;
    let actualCopay: number | undefined;

    // Check if already hit out-of-pocket maximum
    if (this.oopRemaining() <= 0) {
      // Fully covered
      employeeResponsibility = 0;
    } else if (isFree) {
      // Free care - no cost to employee
      employeeResponsibility = 0;
    } else if (benefits.copay && benefits.copay > 0) {
      // For HSA plans, prescription copays only apply AFTER deductible is met
      const isPrescription = categoryId.startsWith('pharmacy_');
      const isHSAPlan = this.plan.type === 'HSA';

      if (isHSAPlan && isPrescription && this.deductibleRemaining() > 0) {
        // HSA plan with prescriptions: apply deductible first, then copay
        let remainingCost = cost;
        let deductiblePortion = 0;

        // Apply deductible first
        const applicableDeductible = Math.min(this.deductibleRemaining(), remainingCost, this.oopRemaining());
        if (applicableDeductible > 0) {
          this.outOfPocketSpent += applicableDeductible;
          this.deductibleSpent += applicableDeductible;
          remainingCost -= applicableDeductible;
          deductiblePortion = applicableDeductible;
        }

        // After deductible is applied, any remaining cost uses copay
        let copayPortion = 0;
        if (remainingCost > 0 && this.deductibleRemaining() === 0) {
          actualCopay = Math.min(benefits.copay, remainingCost);
          copayPortion = Math.min(actualCopay, this.oopRemaining());
          this.outOfPocketSpent += copayPortion;
        }

        employeeResponsibility = deductiblePortion + copayPortion;
      } else {
        // Non-HSA plans or non-prescription items: copay applies immediately
        actualCopay = benefits.copay;
        employeeResponsibility = Math.min(actualCopay, this.oopRemaining());
        this.outOfPocketSpent += employeeResponsibility;
      }
    } else {
      // Deductible and coinsurance apply
      let remainingCost = cost;
      let deductiblePortion = 0;
      let coinsurancePortion = 0;

      // Apply deductible first
      const applicableDeductible = Math.min(this.deductibleRemaining(), remainingCost, this.oopRemaining());
      if (applicableDeductible > 0) {
        this.outOfPocketSpent += applicableDeductible;
        this.deductibleSpent += applicableDeductible;
        remainingCost -= applicableDeductible;
        deductiblePortion = applicableDeductible;
      }

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
        coinsurancePortion = applicableCoinsurance;
      }

      employeeResponsibility = deductiblePortion + coinsurancePortion;
    }

    const insuranceResponsibility = cost - employeeResponsibility;

    // Create expense entry
    const expenseEntry: ExpenseEntry = {
      type: 'expense',
      network,
      category: categoryId,
      categoryDisplayName: isPreventive ? `[Preventive] ${categoryDisplayName}` : categoryDisplayName,
      isPreventive,
      isFree,
      billedAmount: cost,
      copay: actualCopay,
      employeeResponsibility,
      insuranceResponsibility,
      deductibleRemaining: this.deductibleRemaining(),
      outOfPocketRemaining: this.oopRemaining(),
      notes
    };

    // Add to appropriate network expenses array
    if (network === 'in_network') {
      this.inNetworkExpenses.push(expenseEntry);
    } else {
      this.outOfNetworkExpenses.push(expenseEntry);
    }
  }

  getTotalOutOfPocket(): number {
    return this.outOfPocketSpent;
  }

  getLedger(): OrganizedLedger {
    // Sort expenses: free care first, then rest
    const sortExpenses = (expenses: ExpenseEntry[]) => {
      return [...expenses].sort((a, b) => {
        if (a.isFree && !b.isFree) return -1;
        if (!a.isFree && b.isFree) return 1;
        return 0;
      });
    };

    return {
      contributionsAndSavings: [...this.contributionsAndSavings],
      premiums: [...this.premiums],
      inNetworkExpenses: sortExpenses(this.inNetworkExpenses),
      outOfNetworkExpenses: sortExpenses(this.outOfNetworkExpenses)
    };
  }

  private oopRemaining(): number {
    const oopMax = this.getOOPMaxForCoverage();
    return Math.max(0, oopMax - this.outOfPocketSpent);
  }

  private deductibleRemaining(): number {
    const deductible = this.getDeductibleForCoverage();
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