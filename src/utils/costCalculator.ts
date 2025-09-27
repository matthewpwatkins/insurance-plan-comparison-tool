import { getMaxHSAContribution, getMaxFSAContribution, getEmployerHSAContribution } from '../services/planDataService';
import { PlanType, NetworkType, ContributionType } from '../types/enums';
import { getCategoriesData } from '../generated/dataHelpers';
import { PlanData, HealthPlan, UserInputs, PlanResult, OrganizedLedger, ContributionEntry, PremiumEntry, ExpenseEntry } from '../types';

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
  const { coverage, taxRate, costs } = userInputs;
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
  const contributionType = plan.type === PlanType.HSA ? ContributionType.HSA : ContributionType.FSA;
  execution.addTaxSavings(taxSavings, contributionType);

  // Process all category expenses
  for (const categoryEstimate of costs.categoryEstimates) {
    const { estimate } = categoryEstimate;
    const network = estimate.isInNetwork ? NetworkType.IN_NETWORK : NetworkType.OUT_OF_NETWORK;

    // Check for quantity cap for this category
    const quantityCap = execution.getCategoryQuantityCap(categoryEstimate.categoryId, network);
    const effectiveQuantity = quantityCap ? Math.min(estimate.quantity, quantityCap) : estimate.quantity;
    const cappedVisits = quantityCap ? estimate.quantity - effectiveQuantity : 0;

    // Process covered visits
    for (let i = 0; i < effectiveQuantity; i++) {
      execution.recordExpense(categoryEstimate.categoryId, estimate.costPerVisit, network, categoryEstimate.notes);
    }

    // Process capped visits (user pays 100% out of pocket)
    for (let i = 0; i < cappedVisits; i++) {
      execution.recordCappedExpense(categoryEstimate.categoryId, estimate.costPerVisit, network, categoryEstimate.notes, 'quantity');
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

  if (plan.type === PlanType.HSA) {
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
  private costCapSpent: Record<string, number> = {}; // Track spending against cost caps
  private quantityUsed: Record<string, number> = {}; // Track visits used against quantity caps

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
  addTaxSavings(amount: number, contributionType: ContributionType): void {
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
  recordExpense(categoryId: string, cost: number, network: NetworkType = NetworkType.IN_NETWORK, notes?: string): void {
    const benefits = this.getCategoryBenefits(categoryId, network);
    if (!benefits) {
      return; // No coverage
    }

    // Check for cost cap
    const costCap = this.getCategoryCostCap(categoryId, network);
    const categoryKey = `${categoryId}_${network}`;
    const alreadySpent = this.costCapSpent[categoryKey] || 0;

    if (costCap !== undefined) {
      const remainingCap = Math.max(0, costCap - alreadySpent);

      if (remainingCap <= 0) {
        // Already hit cost cap, user pays 100%
        this.recordCappedExpense(categoryId, cost, network, notes, 'cost');
        return;
      } else if (cost > remainingCap) {
        // Expense exceeds remaining cap - split it
        // Process the covered portion
        this._recordExpenseInternal(categoryId, remainingCap, network, notes, benefits);
        this.costCapSpent[categoryKey] = costCap; // Mark cap as fully used

        // Process the over-cap portion
        const overCapAmount = cost - remainingCap;
        this.recordCappedExpense(categoryId, overCapAmount, network, notes, 'cost');
        return;
      } else {
        // Expense is within cap - track spending and process normally
        this.costCapSpent[categoryKey] = alreadySpent + cost;
      }
    }

    // No cost cap or expense is within cap - process normally
    this._recordExpenseInternal(categoryId, cost, network, notes, benefits);
  }

  /**
   * Internal method to record expense with normal benefit processing
   */
  private _recordExpenseInternal(categoryId: string, cost: number, network: NetworkType, notes: string | undefined, benefits: any): void {

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
      const isHSAPlan = this.plan.type === PlanType.HSA;

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
        if (actualCopay !== undefined) {
          employeeResponsibility = Math.min(actualCopay, this.oopRemaining());
          this.outOfPocketSpent += employeeResponsibility;
        }
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
    if (network === NetworkType.IN_NETWORK) {
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

  /**
   * Get the quantity cap for a category and network
   */
  getCategoryQuantityCap(categoryId: string, network: NetworkType): number | undefined {
    // Check category-specific caps first
    const categoryBenefits = this.plan.categories[categoryId];
    if (categoryBenefits?.qty_cap !== undefined) {
      return categoryBenefits.qty_cap;
    }

    // Check network-specific caps
    const networkBenefits = categoryBenefits?.[`${network}_coverage`];
    if (networkBenefits?.qty_cap !== undefined) {
      return networkBenefits.qty_cap;
    }

    return undefined;
  }

  /**
   * Get the cost cap for a category and network
   */
  getCategoryCostCap(categoryId: string, network: NetworkType): number | undefined {
    // Check category-specific caps first
    const categoryBenefits = this.plan.categories[categoryId];
    if (categoryBenefits?.cost_cap !== undefined) {
      return categoryBenefits.cost_cap;
    }

    // Check network-specific caps
    const networkBenefits = categoryBenefits?.[`${network}_coverage`];
    if (networkBenefits?.cost_cap !== undefined) {
      return networkBenefits.cost_cap;
    }

    return undefined;
  }

  /**
   * Record an expense that exceeds caps (user pays 100% out of pocket)
   */
  recordCappedExpense(categoryId: string, cost: number, network: NetworkType = NetworkType.IN_NETWORK, notes?: string, capType?: 'quantity' | 'cost'): void {
    // Get category information
    const categoryInfo = this.categoriesData[categoryId];
    const categoryDisplayName = categoryInfo?.name || (categoryId === 'other' ? 'Other' : categoryId);
    const isPreventive = categoryInfo?.preventive || false;

    // User pays full cost for capped expenses
    const employeeResponsibility = cost;
    const insuranceResponsibility = 0;

    // Add to out-of-pocket spending (these still count toward OOP max)
    const applicableOOP = Math.min(employeeResponsibility, this.oopRemaining());
    this.outOfPocketSpent += applicableOOP;

    // Create expense entry with cap indication
    const capNote = capType === 'quantity' ? '[Over visit limit]' : capType === 'cost' ? '[Over cost limit]' : '[Over limit]';
    const expenseEntry: ExpenseEntry = {
      type: 'expense',
      network,
      category: categoryId,
      categoryDisplayName: `${capNote} ${categoryDisplayName}`,
      isPreventive,
      isFree: false,
      billedAmount: cost,
      employeeResponsibility,
      insuranceResponsibility,
      deductibleRemaining: this.deductibleRemaining(),
      outOfPocketRemaining: this.oopRemaining(),
      notes: notes ? `${capNote} ${notes}` : capNote
    };

    // Add to appropriate network expenses array
    if (network === NetworkType.IN_NETWORK) {
      this.inNetworkExpenses.push(expenseEntry);
    } else {
      this.outOfNetworkExpenses.push(expenseEntry);
    }
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
    const categoryBenefits = categoryId !== 'other' ? this.plan.categories[categoryId] : undefined;
    if (categoryBenefits) {
      if (network === NetworkType.IN_NETWORK) {
        return categoryBenefits.in_network_coverage;
      } else {
        return categoryBenefits.out_of_network_coverage;
      }
    }

    // Fall back to default plan coverage (for "other" costs or unknown categories)
    if (network === NetworkType.IN_NETWORK) {
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