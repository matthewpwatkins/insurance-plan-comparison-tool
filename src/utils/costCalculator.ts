import {
  getMaxHSAContribution,
  getMaxFSAContribution,
  getEmployerHSAContribution,
  isHSAQualified,
} from '../services/planDataService';
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
  CategoriesData,
  CostStructure,
  CategoryEstimate,
  ContributionAdvice,
} from '../types';
import { personName, tracksPeople } from './people';

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

  // The HSA or FSA, and how much of the entered contribution fits within the legal limit
  const account = accountFor(plan, planData, userInputs);
  const { employerContribution, enteredContribution } = account;

  // Taxes skipped on premiums, which come out of pay before taxes (Section 125)
  const premiumsArePreTax = plan.premiums_are_pre_tax ?? true; // Default to true
  const payrollTaxRate =
    (planData.payroll_tax_rates.social_security + planData.payroll_tax_rates.medicare) / 100;
  const premiumDiscount = premiumsArePreTax
    ? annualPremiums * (taxRateDecimal + payrollTaxRate)
    : 0;
  const netAnnualPremiums = annualPremiums - premiumDiscount;

  // Create plan execution to track expenses
  const execution = new PlanExecution(plan, coverage, planData.categories);

  // Add monthly premiums to ledger, and the taxes skipped on them
  execution.addMonthlyPremiums(plan.monthly_premiums[coverage], premiumDiscount / 12);

  // Add employer contribution to ledger
  execution.addEmployerContribution(employerContribution);

  // Process every visit in the order it would happen. Visit limits are per person, and a person
  // can have several rows in a category (one per provider), so a limit counts the person's visits
  // across all of them, and the year's last visits are the ones past the limit. Rows without a
  // person count together as one person.
  const visitsUsed: Record<string, number> = {};
  for (const { categoryEstimate } of visitsThroughTheYear(costs.categoryEstimates)) {
    const { categoryId, estimate, notes, person } = categoryEstimate;
    const network = estimate.isInNetwork ? 'in_network' : 'out_of_network';
    execution.forPerson(
      person,
      person && tracksPeople(coverage) ? personName(userInputs, person) : undefined
    );
    if (!isCoveredByInsurance(planData.categories, categoryId)) {
      execution.recordUncoveredExpense(categoryId, estimate.costPerVisit, network, notes);
      continue;
    }
    const quantityCap = execution.getCategoryQuantityCap(categoryId, network);
    const capKey = `${categoryId}|${network}|${person ?? ''}`;
    const used = visitsUsed[capKey] ?? 0;
    visitsUsed[capKey] = used + 1;

    if (quantityCap !== undefined && quantityCap > 0 && used >= quantityCap) {
      // Over the visit limit: user pays 100% out of pocket
      execution.recordCappedExpense(categoryId, estimate.costPerVisit, network, notes, 'quantity');
    } else {
      execution.recordExpense(categoryId, estimate.costPerVisit, network, notes);
    }
  }

  const outOfPocketCosts = execution.getTotalOutOfPocket();
  const { uncoveredCosts, uncoveredEligible } = execution.getUncovered();

  // Add HSA/FSA contribution tax savings to ledger. Uncovered costs the account can pay for count
  // as spending from it.
  const { userContribution, taxSavedOn, taxSavings } = account.contributing(
    outOfPocketCosts + uncoveredEligible
  );
  execution.addContributionTaxSavings(taxSavings, account.type);
  const ledger = execution.getLedger();

  // Calculate total cost (premiums less the taxes skipped on them)
  const totalCost =
    netAnnualPremiums + outOfPocketCosts + uncoveredCosts - taxSavings - employerContribution;

  // Calculate maximum annual cost (worst-case scenario at OOP max). Uncovered costs never count
  // toward the max, so they stay on top of it.
  const oopMax = plan.out_of_pocket_maximum.in_network;
  const oopMaxValue = coverage === CoverageType.Single ? oopMax.individual : oopMax.family;
  const worstCaseTaxSavings = account.contributing(oopMaxValue + uncoveredEligible).taxSavings;
  const maxAnnualCost =
    netAnnualPremiums + oopMaxValue + uncoveredCosts - worstCaseTaxSavings - employerContribution;

  return {
    planName: plan.name,
    contributionType: account.type,
    annualPremiums,
    netAnnualPremiums,
    premiumDiscount,
    userContribution,
    enteredContribution,
    employerContribution,
    totalContributions: userContribution + employerContribution,
    taxSavings, // HSA/FSA contribution tax savings only
    taxSavedOn,
    bestCaseTaxSavings: account.contributing(uncoveredEligible).taxSavings,
    worstCaseTaxSavings,
    contributionAdvice: account.advice(outOfPocketCosts + uncoveredEligible),
    outOfPocketCosts,
    uncoveredCosts,
    uncoveredEligibleCosts: uncoveredEligible,
    totalCost: totalCost, // Can be negative if tax savings exceed costs
    outOfPocketMax: oopMaxValue,
    maxAnnualCost,
    breakdown: {
      premiums: netAnnualPremiums, // Premiums less the taxes skipped on them
      premiumDiscount: -premiumDiscount, // Negative because it reduces premiums
      contributionTaxSavings: -taxSavings, // Negative because it reduces total cost
      employerContribution: -employerContribution, // Negative because it reduces total cost
      outOfPocket: outOfPocketCosts,
      uncovered: uncoveredCosts,
      net: totalCost,
    },
    ledger,
  };
};

/**
 * Each estimate's visits spread evenly across the year, all estimates merged in date order.
 * Estimates carry no dates, and on plans whose copays wait for the deductible a visit's price
 * depends on whether the deductible is met yet, so this stands in for the real order of care.
 * Where in its slot each visit lands comes from the estimate's own contents, not its place in the
 * list, so reordering the list never changes the total.
 */
const visitsThroughTheYear = (
  estimates: CategoryEstimate[]
): { categoryEstimate: CategoryEstimate; when: number }[] =>
  estimates
    .flatMap(categoryEstimate => {
      const { categoryId, estimate } = categoryEstimate;
      // A visit is whole, so a fractional count (from a link or old data) rounds to the nearest
      const quantity = Math.round(estimate.quantity);
      const phase = scatter(
        `${categoryId}|${estimate.isInNetwork}|${quantity}|${estimate.costPerVisit}` +
          (categoryEstimate.person ? `|${categoryEstimate.person}` : '')
      );
      return Array.from({ length: quantity }, (_, k) => ({
        categoryEstimate,
        when: (k + phase) / quantity,
      }));
    })
    .sort((a, b) => a.when - b.when);

/** A fixed number in [0, 1) for a string (FNV-1a hash), so the same text always lands alike */
const scatter = (text: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  }
  return (hash >>> 0) / 2 ** 32;
};

interface Contributing {
  userContribution: number; // What you'd put in
  taxSavedOn: number; // The part spent on this year's care, which earns this year's tax savings
  taxSavings: number;
}

interface Account {
  type: ContributionType;
  employerContribution: number;
  /** What you said you'd put in at most, within the legal limit */
  enteredContribution: number;
  /** Income tax plus Social Security and Medicare, skipped on every dollar put in */
  savingsRate: number;
  /** Your contribution and its tax savings when your share of care costs is `spent` */
  contributing: (spent: number) => Contributing;
  /** How much to put in instead, if that would help */
  advice: (spent: number) => ContributionAdvice | undefined;
}

/**
 * The plan's HSA or FSA.
 *
 * An HSA is yours forever, so you put in all you entered and every dollar saves taxes.
 *
 * An FSA you lose at year end, past what rolls into next year, so the entered amount is the most
 * you're willing to put in: you'd put in only enough for this year's care plus what rolls over.
 * Only the part spent on this year's care counts as savings. The rollover saves taxes now but
 * means putting that much less in next year, so it moves a tax break rather than adding one.
 */
const accountFor = (plan: HealthPlan, planData: PlanData, userInputs: UserInputs): Account => {
  const { coverage, ageGroup } = userInputs;
  const savingsRate =
    (userInputs.taxRate +
      planData.payroll_tax_rates.social_security +
      planData.payroll_tax_rates.medicare) /
    100;

  if (isHSAQualified(plan, planData, coverage)) {
    const employerContribution = getEmployerHSAContribution(plan, coverage);
    // The IRS limit includes the employer's contribution
    const room = Math.max(
      0,
      getMaxHSAContribution(planData, coverage, ageGroup) - employerContribution
    );
    const enteredContribution = Math.min(userInputs.hsaContribution, room);
    return {
      type: ContributionType.HSA,
      employerContribution,
      enteredContribution,
      savingsRate,
      contributing: () => ({
        userContribution: enteredContribution,
        taxSavedOn: enteredContribution,
        taxSavings: enteredContribution * savingsRate,
      }),
      advice: spent => {
        // Every dollar up to the limit saves taxes and is never lost, so anything under it helps
        if (enteredContribution >= room) return undefined;
        // At least enough of your own money, with the employer's, to cover your share of care
        const coversCare = Math.min(room, Math.max(0, spent - employerContribution));
        return {
          recommendedLow: coversCare,
          recommendedHigh: room,
          extraSavings: Math.max(0, coversCare - enteredContribution) * savingsRate,
          maxSavings: (room - enteredContribution) * savingsRate,
          avoidedLoss: 0,
          rollover: 0,
        };
      },
    };
  }

  const limit = getMaxFSAContribution(planData);
  const rollover = planData.fsa_contribution_limits?.carryover ?? 0;
  const enteredContribution = Math.min(userInputs.fsaContribution, limit);
  const range = (spent: number) => ({
    low: Math.min(limit, spent),
    high: Math.min(limit, spent + rollover),
  });
  return {
    type: ContributionType.FSA,
    employerContribution: 0,
    enteredContribution,
    savingsRate,
    contributing: spent => {
      const userContribution = Math.min(enteredContribution, range(spent).high);
      const taxSavedOn = Math.min(userContribution, spent);
      return { userContribution, taxSavedOn, taxSavings: taxSavedOn * savingsRate };
    },
    advice: spent => {
      const { low, high } = range(spent);
      if (enteredContribution >= low && enteredContribution <= high) return undefined;
      return {
        recommendedLow: low,
        recommendedHigh: high,
        extraSavings: Math.max(0, low - enteredContribution) * savingsRate,
        // The rollover saves no taxes this year, so the top of the range saves no more
        maxSavings: Math.max(0, low - enteredContribution) * savingsRate,
        avoidedLoss: Math.max(0, enteredContribution - high),
        rollover,
      };
    },
  };
};

/**
 * A category's benefits on a plan: the plan's default with the category's own settings on top
 */
const effectiveBenefits = (plan: HealthPlan, categoryId: string): NetworkBenefits => {
  const categoryBenefits = plan.categories[categoryId];
  if (!categoryBenefits) {
    return plan.default;
  }
  return {
    ...plan.default,
    ...categoryBenefits,
    in_network_coverage: {
      ...plan.default.in_network_coverage,
      ...categoryBenefits.in_network_coverage,
    },
    out_of_network_coverage: {
      ...plan.default.out_of_network_coverage,
      ...categoryBenefits.out_of_network_coverage,
    },
  };
};

/**
 * How a plan covers a category in one network, as the cost engine applies it
 */
export const categoryCoverage = (
  plan: HealthPlan,
  categoryId: string,
  network: 'in_network' | 'out_of_network'
): CostStructure | undefined => {
  const benefits = effectiveBenefits(plan, categoryId);
  return network === 'in_network' ? benefits.in_network_coverage : benefits.out_of_network_coverage;
};

/**
 * A plan's yearly visit limit in a category and network, or undefined if unlimited. Some limits
 * only mean that more visits need preauthorization.
 */
export const categoryVisitLimit = (
  plan: HealthPlan,
  categoryId: string,
  network: 'in_network' | 'out_of_network'
): { visits: number; extraWithPreauthorization: boolean } | undefined => {
  const categoryBenefits = plan.categories[categoryId];
  const visits = categoryBenefits?.qty_cap ?? categoryBenefits?.[`${network}_coverage`]?.qty_cap;
  return visits === undefined
    ? undefined
    : { visits, extraWithPreauthorization: !!categoryBenefits?.extra_visits_with_preauthorization };
};

/**
 * Visits a plan covers per year in a category and network, or undefined if unlimited or if more
 * are covered once preauthorized
 */
export const categoryQuantityCap = (
  plan: HealthPlan,
  categoryId: string,
  network: 'in_network' | 'out_of_network'
): number | undefined => {
  const limit = categoryVisitLimit(plan, categoryId, network);
  return limit && !limit.extraWithPreauthorization ? limit.visits : undefined;
};

/** Whether plans pay toward a category at all, rather than leaving it all to you */
export const isCoveredByInsurance = (categories: CategoriesData, categoryId: string): boolean =>
  categories[categoryId]?.covered_by_insurance !== false;

/** Whether HSA or FSA money can pay for a category */
export const isHsaFsaEligible = (categories: CategoriesData, categoryId: string): boolean =>
  categories[categoryId]?.hsa_fsa_eligible !== false;

/**
 * Plan execution class to track expenses and calculate out-of-pocket costs
 * Generates organized ledger with separate tables for different cost types
 */
class PlanExecution {
  private plan: HealthPlan;
  private coverage: CoverageType;
  private outOfPocketSpent: number = 0;
  private person: number | undefined; // Who the current expense is for
  private personName: string | undefined; // Their name, shown in the cost details
  private spentByPerson: Record<number, number> = {}; // Out of pocket by person, for their own max
  private deductibleSpent: number = 0;
  private contributionsAndSavings: ContributionEntry[] = [];
  private premiums: PremiumEntry[] = [];
  private expenses: ExpenseEntry[] = [];
  private categoriesData: CategoriesData;
  private uncoveredCosts: number = 0; // Care no plan pays for, outside the deductible and OOP max
  private uncoveredEligible: number = 0; // The part of it HSA or FSA money can pay for
  private costCapSpent: Record<string, number> = {}; // Track spending against cost caps
  private quantityUsed: Record<string, number> = {}; // Track visits used against quantity caps

  constructor(plan: HealthPlan, coverage: CoverageType, categoriesData: CategoriesData) {
    this.plan = plan;
    this.coverage = coverage;
    this.categoriesData = categoriesData;
  }

  /**
   * Add monthly premium entries to the ledger, and the taxes skipped on them as a benefit
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

    // Taking premiums out of pay before taxes is a benefit, listed with the others
    if (monthlyDiscount > 0) {
      this.contributionsAndSavings.push({
        type: 'savings',
        description: 'Tax savings on premiums',
        amount: monthlyDiscount * 12,
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
        description: `Tax savings on your ${contributionType} contributions`,
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
      // Copays apply right away and leave the deductible alone, unless the category says
      // otherwise. A copay that waits for the deductible bills the full cost until it is met.
      // Prescriptions also wait when the plan makes them subject to the deductible.
      const isPrescription = categoryId.startsWith('pharmacy_');
      const requiresDeductibleToBeMet =
        benefits.requires_deductible_to_be_met ??
        (isPrescription && Boolean(this.plan.prescriptions_subject_to_deductible));
      const contributesToDeductible = benefits.contributes_to_deductible ?? false;

      if (requiresDeductibleToBeMet && this.deductibleRemaining() > 0) {
        // Apply deductible first, then copay
        let remainingCost = cost;
        let deductiblePortion = 0;

        // Apply deductible first
        const applicableDeductible = Math.min(
          this.deductibleRemaining(),
          remainingCost,
          this.oopRemaining()
        );
        if (applicableDeductible > 0) {
          this.addOutOfPocket(applicableDeductible);
          this.deductibleSpent += applicableDeductible;
          remainingCost -= applicableDeductible;
          deductiblePortion = applicableDeductible;
        }

        // After deductible is applied, any remaining cost uses copay
        let copayPortion = 0;
        if (remainingCost > 0 && this.deductibleRemaining() === 0) {
          actualCopay = Math.min(benefits.copay, remainingCost);
          copayPortion = Math.min(actualCopay, this.oopRemaining());
          this.addOutOfPocket(copayPortion);
        }

        employeeResponsibility = deductiblePortion + copayPortion;
      } else {
        // Copay applies right away, and may still count toward the deductible. A copay never
        // costs more than the bill itself.
        actualCopay = Math.min(benefits.copay, cost);
        if (actualCopay !== undefined) {
          employeeResponsibility = Math.min(actualCopay, this.oopRemaining());
          this.addOutOfPocket(employeeResponsibility);
          if (contributesToDeductible) {
            this.deductibleSpent += Math.min(employeeResponsibility, this.deductibleRemaining());
          }
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
            this.addOutOfPocket(applicableDeductible);
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
          this.addOutOfPocket(applicableCoinsurance);
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
      categoryDisplayName,
      isPreventive,
      isFree,
      billedAmount: cost,
      copay: actualCopay,
      employeeResponsibility,
      insuranceResponsibility,
      deductibleRemaining: this.deductibleRemaining(),
      outOfPocketRemaining: this.familyOopRemaining(),
      notes,
      ...this.personFields(),
    };

    this.expenses.push(expenseEntry);
  }

  /**
   * Record care no plan pays for: you pay all of it, and it leaves the deductible and
   * out-of-pocket max alone
   */
  recordUncoveredExpense(
    categoryId: string,
    cost: number,
    network: 'in_network' | 'out_of_network',
    notes?: string
  ): void {
    const categoryInfo = this.categoriesData[categoryId];
    this.uncoveredCosts += cost;
    if (isHsaFsaEligible(this.categoriesData, categoryId)) {
      this.uncoveredEligible += cost;
    }
    this.expenses.push({
      type: 'expense',
      network,
      category: categoryId,
      categoryDisplayName: categoryInfo?.name || categoryId,
      isPreventive: false,
      isFree: false,
      isNotCovered: true,
      billedAmount: cost,
      employeeResponsibility: cost,
      insuranceResponsibility: 0,
      deductibleRemaining: this.deductibleRemaining(),
      outOfPocketRemaining: this.familyOopRemaining(),
      notes,
      ...this.personFields(),
    });
  }

  getTotalOutOfPocket(): number {
    return this.outOfPocketSpent;
  }

  getUncovered(): { uncoveredCosts: number; uncoveredEligible: number } {
    return { uncoveredCosts: this.uncoveredCosts, uncoveredEligible: this.uncoveredEligible };
  }

  getLedger(): OrganizedLedger {
    // Starting deductible and OOP values, shown above the first expense
    const startOfYear: ExpenseEntry = {
      type: 'expense',
      network: 'in_network',
      category: 'initial_state',
      categoryDisplayName: 'Start of year',
      isPreventive: false,
      isFree: false,
      billedAmount: 0,
      employeeResponsibility: 0,
      insuranceResponsibility: 0,
      deductibleRemaining: this.getDeductibleForCoverage(),
      outOfPocketRemaining: this.getOOPMaxForCoverage(),
    };

    // Free care costs nothing and never touches the deductible, so it reads as if it came first,
    // at start-of-year balances, and the paid rows count down in the order they happened
    const freeFirst = [
      ...this.expenses
        .filter(entry => entry.isFree)
        .map(entry => ({
          ...entry,
          deductibleRemaining: startOfYear.deductibleRemaining,
          outOfPocketRemaining: startOfYear.outOfPocketRemaining,
        })),
      ...this.expenses.filter(entry => !entry.isFree),
    ];

    return {
      contributionsAndSavings: [...this.contributionsAndSavings],
      premiums: [...this.premiums],
      expenses: freeFirst.length > 0 ? [startOfYear, ...freeFirst] : [],
    };
  }

  /**
   * Get the quantity cap for a category and network
   */
  getCategoryQuantityCap(
    categoryId: string,
    network: 'in_network' | 'out_of_network'
  ): number | undefined {
    return categoryQuantityCap(this.plan, categoryId, network);
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
    this.addOutOfPocket(applicableOOP);

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
      outOfPocketRemaining: this.familyOopRemaining(),
      notes: notes ? `${capNote} ${notes}` : capNote,
      ...this.personFields(),
    };

    this.expenses.push(expenseEntry);
  }

  /** Who the next expenses are for, until changed, and their name for the cost details */
  forPerson(person: number | undefined, name?: string): void {
    this.person = person;
    this.personName = name;
  }

  /** The current person's name and own out-of-pocket room, for a ledger entry */
  private personFields(): Pick<ExpenseEntry, 'personName' | 'personOutOfPocketRemaining'> {
    if (this.personName === undefined || this.person === undefined) return {};
    const individualMax = this.plan.out_of_pocket_maximum.in_network.individual;
    return {
      personName: this.personName,
      personOutOfPocketRemaining: Math.max(
        0,
        individualMax - (this.spentByPerson[this.person] ?? 0)
      ),
    };
  }

  private addOutOfPocket(amount: number): void {
    this.outOfPocketSpent += amount;
    if (this.person !== undefined) {
      this.spentByPerson[this.person] = (this.spentByPerson[this.person] ?? 0) + amount;
    }
  }

  /**
   * Out-of-pocket room left for the current person: the coverage's max, and with two-party or
   * family coverage also each person's own max. Expenses with no person only meet the family max.
   */
  /** Room left under the coverage's own max (the family max with two-party or family) */
  private familyOopRemaining(): number {
    return Math.max(0, this.getOOPMaxForCoverage() - this.outOfPocketSpent);
  }

  private oopRemaining(): number {
    const familyRoom = this.familyOopRemaining();
    if (this.coverage === CoverageType.Single || this.person === undefined) {
      return familyRoom;
    }
    const individualMax = this.plan.out_of_pocket_maximum.in_network.individual;
    const personRoom = individualMax - (this.spentByPerson[this.person] ?? 0);
    return Math.max(0, Math.min(familyRoom, personRoom));
  }

  private deductibleRemaining(): number {
    const deductible = this.getDeductibleForCoverage();
    return Math.max(0, deductible - this.deductibleSpent);
  }

  /**
   * Get effective benefits for a category by merging default benefits with category-specific benefits
   */
  private getCategoryBenefits(categoryId: string, network: 'in_network' | 'out_of_network') {
    return categoryCoverage(this.plan, categoryId, network);
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
