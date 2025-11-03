import {
  getMaxHSAContribution,
  getMaxFSAContribution,
  getEmployerHSAContribution,
  isHSAQualified,
} from '../services/planDataService';
import { getCategoriesData } from '../generated/dataHelpers';
import {
  PlanData,
  HealthPlan,
  UserInputs,
  PlanResult,
  OrganizedLedger,
  ContributionEntry,
  PremiumEntry,
  ExpenseEntry,
  ContributionType,
  CoverageType,
  NetworkBenefits,
} from '../types';

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
export const calculatePlanCost = (
  plan: HealthPlan,
  planData: PlanData,
  userInputs: UserInputs
): PlanResult => {
  const { coverage, taxRate, costs } = userInputs;
  const taxRateDecimal = taxRate / 100; // Convert percentage to decimal

  // Calculate annual premiums
  const annualPremiums = plan.monthly_premiums[coverage] * 12;

  // Calculate user's HSA/FSA contributions and tax savings
  const { userContribution, employerContribution, taxSavings } =
    calculateContributionsAndTaxSavings(plan, planData, userInputs, taxRateDecimal);

  // Calculate premium discount (if premiums are pre-tax through Section 125)
  const premiumsArePreTax = plan.premiums_are_pre_tax ?? true; // Default to true
  const payrollTaxRate =
    (planData.payroll_tax_rates.social_security + planData.payroll_tax_rates.medicare) / 100;
  const premiumDiscount = premiumsArePreTax
    ? annualPremiums * (taxRateDecimal + payrollTaxRate)
    : 0;
  const netAnnualPremiums = annualPremiums - premiumDiscount;

  // Create plan execution to track expenses
  const execution = new PlanExecution(plan, coverage);

  // Add monthly premiums to ledger (with pre-tax discount)
  execution.addMonthlyPremiums(plan.monthly_premiums[coverage], premiumDiscount / 12);

  // Add employer contribution to ledger
  execution.addEmployerContribution(employerContribution);

  // Add HSA/FSA contribution tax savings to ledger
  const isHSA = isHSAQualified(plan, planData, coverage);
  const contributionType = isHSA ? ContributionType.HSA : ContributionType.FSA;
  execution.addContributionTaxSavings(taxSavings, contributionType);

  // Process all category expenses
  for (const categoryEstimate of costs.categoryEstimates) {
    const { estimate } = categoryEstimate;
    const network = estimate.isInNetwork ? 'in_network' : 'out_of_network';

    // Check for quantity cap for this category
    const quantityCap = execution.getCategoryQuantityCap(categoryEstimate.categoryId, network);
    const effectiveQuantity = quantityCap
      ? Math.min(estimate.quantity, quantityCap)
      : estimate.quantity;
    const cappedVisits = quantityCap ? estimate.quantity - effectiveQuantity : 0;

    // Process covered visits
    for (let i = 0; i < effectiveQuantity; i++) {
      execution.recordExpense(
        categoryEstimate.categoryId,
        estimate.costPerVisit,
        network,
        categoryEstimate.notes
      );
    }

    // Process capped visits (user pays 100% out of pocket)
    for (let i = 0; i < cappedVisits; i++) {
      execution.recordCappedExpense(
        categoryEstimate.categoryId,
        estimate.costPerVisit,
        network,
        categoryEstimate.notes,
        'quantity'
      );
    }
  }

  const outOfPocketCosts = execution.getTotalOutOfPocket();
  const ledger = execution.getLedger();

  // Calculate total cost (using net premiums after pre-tax discount)
  const totalCost = netAnnualPremiums + outOfPocketCosts - taxSavings - employerContribution;

  // Calculate maximum annual cost (worst-case scenario at OOP max)
  const oopMax = plan.out_of_pocket_maximum.in_network;
  const oopMaxValue = coverage === CoverageType.Single ? oopMax.individual : oopMax.family;
  const maxAnnualCost = netAnnualPremiums + oopMaxValue - taxSavings - employerContribution;

  return {
    planName: plan.name,
    contributionType: contributionType,
    annualPremiums,
    netAnnualPremiums,
    premiumDiscount,
    userContribution,
    employerContribution,
    totalContributions: userContribution + employerContribution,
    taxSavings, // HSA/FSA contribution tax savings only
    outOfPocketCosts,
    totalCost: totalCost, // Can be negative if tax savings exceed costs
    maxAnnualCost,
    breakdown: {
      premiums: netAnnualPremiums, // Net premiums after pre-tax discount
      premiumDiscount: -premiumDiscount, // Negative because it reduces premiums
      contributionTaxSavings: -taxSavings, // Negative because it reduces total cost
      employerContribution: -employerContribution, // Negative because it reduces total cost
      outOfPocket: outOfPocketCosts,
      net: totalCost,
    },
    ledger,
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

  if (isHSAQualified(plan, planData, coverage)) {
    // HSA-qualified plans
    employerContribution = getEmployerHSAContribution(plan, coverage);
    const maxHSAContribution = getMaxHSAContribution(planData, coverage, ageGroup);

    // userInputs.hsaContribution now represents employee contribution only
    userContribution = Math.min(
      userInputs.hsaContribution,
      maxHSAContribution - employerContribution
    );

    // Tax savings on employee HSA contributions include income tax + payroll taxes
    const payrollTaxRate =
      (planData.payroll_tax_rates.social_security + planData.payroll_tax_rates.medicare) / 100;
    taxSavings = userContribution * (taxRateDecimal + payrollTaxRate);
  } else {
    // PPO plans with FSA
    const maxFSAContribution = getMaxFSAContribution(planData);
    userContribution = Math.min(userInputs.fsaContribution, maxFSAContribution);

    // Tax savings on user FSA contributions include income tax + payroll taxes
    const payrollTaxRate =
      (planData.payroll_tax_rates.social_security + planData.payroll_tax_rates.medicare) / 100;
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
  private coverage: CoverageType;
  private outOfPocketSpent: number = 0;
  private deductibleSpent: number = 0;
  private contributionsAndSavings: ContributionEntry[] = [];
  private premiums: PremiumEntry[] = [];
  private inNetworkExpenses: ExpenseEntry[] = [];
  private outOfNetworkExpenses: ExpenseEntry[] = [];
  private categoriesData = getCategoriesData();
  private costCapSpent: Record<string, number> = {}; // Track spending against cost caps
  private quantityUsed: Record<string, number> = {}; // Track visits used against quantity caps

  constructor(plan: HealthPlan, coverage: CoverageType) {
    this.plan = plan;
    this.coverage = coverage;
  }

  /**
   * Add monthly premium entries to the ledger with pre-tax discount
   */
  addMonthlyPremiums(monthlyGrossPremium: number, monthlyDiscount: number): void {
    // Add all 12 months of gross premiums
    for (let month = 1; month <= 12; month++) {
      this.premiums.push({
        type: 'premium',
        description: `Month ${month}`,
        amount: monthlyGrossPremium,
      });
    }

    // Add total pre-tax benefit as a single line item at the end
    if (monthlyDiscount > 0) {
      this.premiums.push({
        type: 'premium',
        description: 'Premium Net Discount',
        amount: -(monthlyDiscount * 12),
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
        amount: amount,
      });
    }
  }

  /**
   * Add HSA/FSA contribution tax savings entry to the ledger
   */
  addContributionTaxSavings(amount: number, contributionType: ContributionType): void {
    if (amount > 0) {
      this.contributionsAndSavings.push({
        type: 'savings',
        description: `Tax savings from ${contributionType} contributions`,
        amount: amount,
      });
    }
  }

  /**
   * Record a single expense and calculate the out-of-pocket cost
   */
  recordExpense(
    categoryId: string,
    cost: number,
    network: 'in_network' | 'out_of_network' = 'in_network',
    notes?: string
  ): void {
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
  private _recordExpenseInternal(
    categoryId: string,
    cost: number,
    network: 'in_network' | 'out_of_network',
    notes: string | undefined,
    benefits: any
  ): void {
    // Get category information
    const categoryInfo = this.categoriesData[categoryId];
    const categoryDisplayName =
      categoryInfo?.name || (categoryId === 'other' ? 'Other' : categoryId);
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
      // For plans with prescriptions subject to deductible, copays only apply AFTER deductible is met
      const isPrescription = categoryId.startsWith('pharmacy_');
      const prescriptionsSubjectToDeductible =
        this.plan.prescriptions_subject_to_deductible || false;

      if (prescriptionsSubjectToDeductible && isPrescription && this.deductibleRemaining() > 0) {
        // Plan with prescriptions subject to deductible: apply deductible first, then copay
        let remainingCost = cost;
        let deductiblePortion = 0;

        // Apply deductible first
        const applicableDeductible = Math.min(
          this.deductibleRemaining(),
          remainingCost,
          this.oopRemaining()
        );
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

      // Determine deductible behavior defaults based on whether plan has a deductible
      const planHasDeductible = this.getDeductibleForCoverage() > 0;
      const requiresDeductibleToBeMet = benefits.requires_deductible_to_be_met ?? planHasDeductible;
      const contributesToDeductible = benefits.contributes_to_deductible ?? planHasDeductible;
      const contributesToOOPMax = benefits.contributes_to_out_of_pocket_max ?? true;

      // Apply deductible if required and not yet met
      if (requiresDeductibleToBeMet && this.deductibleRemaining() > 0) {
        const applicableDeductible = Math.min(
          this.deductibleRemaining(),
          remainingCost,
          contributesToOOPMax ? this.oopRemaining() : remainingCost
        );
        if (applicableDeductible > 0) {
          // Count toward OOP max if configured
          if (contributesToOOPMax) {
            this.outOfPocketSpent += applicableDeductible;
          }
          // Count toward deductible if configured
          if (contributesToDeductible) {
            this.deductibleSpent += applicableDeductible;
          }
          remainingCost -= applicableDeductible;
          deductiblePortion = applicableDeductible;
        }
      }

      // Apply coinsurance to remaining cost after deductible (or full cost if not requiring deductible)
      const coinsurance = benefits.coinsurance || 0;
      if (coinsurance > 0 && remainingCost > 0) {
        let coinsuranceAmount = remainingCost * coinsurance;

        // Apply max coinsurance cap if specified
        if (benefits.max_coinsurance !== undefined) {
          coinsuranceAmount = Math.min(coinsuranceAmount, benefits.max_coinsurance);
        }

        const applicableCoinsurance = contributesToOOPMax
          ? Math.min(coinsuranceAmount, this.oopRemaining())
          : coinsuranceAmount;

        if (contributesToOOPMax) {
          this.outOfPocketSpent += applicableCoinsurance;
        }
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
      categoryDisplayName: isPreventive
        ? `[Preventive] ${categoryDisplayName}`
        : categoryDisplayName,
      isPreventive,
      isFree,
      billedAmount: cost,
      copay: actualCopay,
      employeeResponsibility,
      insuranceResponsibility,
      deductibleRemaining: this.deductibleRemaining(),
      outOfPocketRemaining: this.oopRemaining(),
      notes,
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

    // Create initial state entry showing starting deductible and OOP values
    const createInitialStateEntry = (): ExpenseEntry => ({
      type: 'expense',
      network: 'in_network',
      category: 'initial_state',
      categoryDisplayName: 'Initial state',
      isPreventive: false,
      isFree: false,
      billedAmount: 0,
      employeeResponsibility: 0,
      insuranceResponsibility: 0,
      deductibleRemaining: this.getDeductibleForCoverage(),
      outOfPocketRemaining: this.getOOPMaxForCoverage(),
    });

    // Add initial state row to the beginning of in-network expenses if there are any expenses
    const inNetworkWithInitial =
      this.inNetworkExpenses.length > 0
        ? [createInitialStateEntry(), ...sortExpenses(this.inNetworkExpenses)]
        : sortExpenses(this.inNetworkExpenses);

    // Add initial state row to the beginning of out-of-network expenses if there are any expenses
    const outOfNetworkWithInitial =
      this.outOfNetworkExpenses.length > 0
        ? [createInitialStateEntry(), ...sortExpenses(this.outOfNetworkExpenses)]
        : sortExpenses(this.outOfNetworkExpenses);

    return {
      contributionsAndSavings: [...this.contributionsAndSavings],
      premiums: [...this.premiums],
      inNetworkExpenses: inNetworkWithInitial,
      outOfNetworkExpenses: outOfNetworkWithInitial,
    };
  }

  /**
   * Get the quantity cap for a category and network
   */
  getCategoryQuantityCap(
    categoryId: string,
    network: 'in_network' | 'out_of_network'
  ): number | undefined {
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
  getCategoryCostCap(
    categoryId: string,
    network: 'in_network' | 'out_of_network'
  ): number | undefined {
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
  recordCappedExpense(
    categoryId: string,
    cost: number,
    network: 'in_network' | 'out_of_network' = 'in_network',
    notes?: string,
    capType?: 'quantity' | 'cost'
  ): void {
    // Get category information
    const categoryInfo = this.categoriesData[categoryId];
    const categoryDisplayName =
      categoryInfo?.name || (categoryId === 'other' ? 'Other' : categoryId);
    const isPreventive = categoryInfo?.preventive || false;

    // User pays full cost for capped expenses
    const employeeResponsibility = cost;
    const insuranceResponsibility = 0;

    // Add to out-of-pocket spending (these still count toward OOP max)
    const applicableOOP = Math.min(employeeResponsibility, this.oopRemaining());
    this.outOfPocketSpent += applicableOOP;

    // Create expense entry with cap indication
    const capNote =
      capType === 'quantity'
        ? '[Over visit limit]'
        : capType === 'cost'
          ? '[Over cost limit]'
          : '[Over limit]';
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
      notes: notes ? `${capNote} ${notes}` : capNote,
    };

    // Add to appropriate network expenses array
    if (network === 'in_network') {
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

  /**
   * Get effective benefits for a category by merging default benefits with category-specific benefits
   */
  private getEffectiveBenefits(categoryId: string): NetworkBenefits {
    // Get category-specific benefits (if any)
    const categoryBenefits = this.plan.categories[categoryId];
    if (!categoryBenefits) {
      return this.plan.default;
    }

    // Merge category benefits on top of default benefits
    return {
      ...this.plan.default,
      ...categoryBenefits,
      in_network_coverage: {
        ...this.plan.default.in_network_coverage,
        ...categoryBenefits.in_network_coverage,
      },
      out_of_network_coverage: {
        ...this.plan.default.out_of_network_coverage,
        ...categoryBenefits.out_of_network_coverage,
      },
    };
  }

  private getCategoryBenefits(categoryId: string, network: 'in_network' | 'out_of_network') {
    const effectiveBenefits = this.getEffectiveBenefits(categoryId);

    return network === 'in_network'
      ? effectiveBenefits.in_network_coverage
      : effectiveBenefits.out_of_network_coverage;
  }

  private getDeductibleForCoverage(): number {
    const deductible = this.plan.annual_deductible.in_network;
    if (this.coverage === CoverageType.Single) {
      return deductible.single;
    } else {
      // Both two_party and family use the family deductible
      return deductible.family;
    }
  }

  private getOOPMaxForCoverage(): number {
    const oopMax = this.plan.out_of_pocket_maximum.in_network;
    if (this.coverage === CoverageType.Single) {
      return oopMax.individual;
    } else {
      // Both two_party and family use the family out-of-pocket maximum
      return oopMax.family;
    }
  }
}
