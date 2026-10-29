import {
  PlanData,
  UserInputs,
  PlanResult,
  HealthPlan,
  CoverageType,
  CategoryEstimate,
} from '../types';
import {
  calculateAllPlans,
  calculatePlanCost,
  categoryCoverage,
  categoryQuantityCap,
  isCoveredByInsurance,
} from './costCalculator';

/**
 * Data structure for a single point on the chart
 */
export interface ChartPoint {
  spending: number; // Healthcare spending amount (x-axis)
  totalCost: number; // Total cost to user (y-axis)
}

/**
 * Data structure for a plan's chart line
 */
export interface PlanChartData {
  planName: string;
  data: ChartPoint[];
}

/**
 * A plan's real total for the user's estimates, placed at their non-free spending
 */
export interface EstimateDot extends ChartPoint {
  planName: string;
}

/**
 * Return type for generateChartData including max spending value
 */
export interface ChartDataResult {
  plans: PlanChartData[];
  dots: EstimateDot[];
  userSpending: number;
  maxSpending: number;
}

// A category id no plan overrides, so an expense in it gets each plan's default coverage
const DEFAULT_COVERAGE_CATEGORY = '__default_coverage__';
// Highest spending searched when looking for where a line flattens or crosses zero
const SEARCH_CEILING = 1_000_000;
// Lines are straight between bends, so a coarse grid only guards against bends we don't predict
const GRID_POINTS = 100;
// Spending past the last plan's flat point, so the flat stretch is visible
const PAST_FLATLINE = 10_000;
// The x-axis runs at least this far past the user's own spending
const PAST_USER_SPENDING = 1.5;

type Network = 'in_network' | 'out_of_network';

interface BilledEstimate {
  categoryId: string;
  network: Network;
  quantity: number;
  costPerVisit: number;
  person?: number;
}

/**
 * The user's estimates with care that is free on every plan, and care no plan pays for, taken out.
 *
 * A category counts as free only if every plan covers it at no charge in that network, and only
 * up to the smallest visit limit among the plans; visits past that limit are billed on some plan,
 * so they stay in at their full cost. Care free on only some plans stays in full.
 */
function billedEstimates(planData: PlanData, userInputs: UserInputs): BilledEstimate[] {
  const freeVisitsUsed: Record<string, number> = {};
  return insuredEstimates(planData, userInputs).map(({ categoryId, estimate, person }) => {
    const network: Network = estimate.isInNetwork ? 'in_network' : 'out_of_network';
    const quantity = Math.round(estimate.quantity);
    const billed = { categoryId, network, quantity, costPerVisit: estimate.costPerVisit, person };
    const freeEverywhere =
      planData.plans.length > 0 &&
      planData.plans.every(plan => categoryCoverage(plan, categoryId, network)?.is_free === true);
    if (!freeEverywhere) {
      return billed;
    }
    // A limit spans every row of the category for one person, as in the cost engine
    const freeLimit = Math.min(
      ...planData.plans.map(plan => categoryQuantityCap(plan, categoryId, network) ?? Infinity)
    );
    const key = `${categoryId}|${network}|${person ?? ''}`;
    const freeVisits = Math.min(quantity, Math.max(0, freeLimit - (freeVisitsUsed[key] ?? 0)));
    freeVisitsUsed[key] = (freeVisitsUsed[key] ?? 0) + freeVisits;
    return { ...billed, quantity: quantity - freeVisits };
  });
}

/** The user's estimates for care the plans pay toward, or don't, at full price either way */
const insuredEstimates = (planData: PlanData, userInputs: UserInputs) =>
  userInputs.costs.categoryEstimates.filter(({ categoryId }) =>
    isCoveredByInsurance(planData.categories, categoryId)
  );
const uncoveredEstimates = (planData: PlanData, userInputs: UserInputs) =>
  userInputs.costs.categoryEstimates.filter(
    ({ categoryId }) => !isCoveredByInsurance(planData.categories, categoryId)
  );

/**
 * Billed spending on the user's estimates, leaving out care that is free on every plan and care
 * no plan pays for
 */
export function calculateUserSpending(planData: PlanData, userInputs: UserInputs): number {
  return billedEstimates(planData, userInputs).reduce(
    (total, { quantity, costPerVisit }) => total + quantity * costPerVisit,
    0
  );
}

/**
 * Share of each billed dollar a plan charges once its deductible is met, for the user's mix of
 * care: default coinsurance, except that care the plan covers with a copay costs the copay per
 * visit (never more than the visit) instead of coinsurance. With no billed care, it is the
 * default coinsurance.
 */
export function rateAfterDeductible(
  plan: HealthPlan,
  planData: PlanData,
  userInputs: UserInputs
): number {
  const coinsurance = plan.default.in_network_coverage?.coinsurance ?? 0;
  let billedTotal = 0;
  let copayBilled = 0;
  let copayDollars = 0;
  billedEstimates(planData, userInputs).forEach(
    ({ categoryId, network, quantity, costPerVisit }) => {
      const billed = quantity * costPerVisit;
      billedTotal += billed;
      const coverage = categoryCoverage(plan, categoryId, network);
      if (!coverage?.is_free && coverage?.copay && coverage.copay > 0) {
        copayBilled += billed;
        copayDollars += quantity * Math.min(coverage.copay, costPerVisit);
      }
    }
  );
  if (billedTotal <= 0) {
    return coinsurance;
  }
  return (coinsurance * (billedTotal - copayBilled) + copayDollars) / billedTotal;
}

/**
 * How the user's billed care splits between people, as shares adding to 1. Care with no person,
 * or no billed care at all, is one share for the family as a whole.
 */
function personShares(
  planData: PlanData,
  userInputs: UserInputs
): { person: number | undefined; share: number }[] {
  const byPerson = new Map<number | undefined, number>();
  let total = 0;
  billedEstimates(planData, userInputs).forEach(({ quantity, costPerVisit, person }) => {
    byPerson.set(person, (byPerson.get(person) ?? 0) + quantity * costPerVisit);
    total += quantity * costPerVisit;
  });
  if (total <= 0) {
    return [{ person: undefined, share: 1 }];
  }
  return Array.from(byPerson, ([person, billed]) => ({ person, share: billed / total }));
}

/**
 * A plan's total annual cost when the year's care is `spending` of in-network bills: premiums
 * and account savings, then 100% of bills until the deductible, then the plan's rate for the
 * user's mix of care, then nothing more past the out-of-pocket max. The bills split between
 * people as the user's own care does, so a person whose care dominates reaches their own
 * out-of-pocket max first, as their dot does. Care no plan pays for is the same at every
 * spending level, so it raises the whole line.
 */
function planLine(
  plan: HealthPlan,
  planData: PlanData,
  userInputs: UserInputs
): (spending: number) => number {
  // The plan with its default coverage charging the blended rate, so the engine draws the line
  const { copay: _copay, ...defaultCoverage } = plan.default.in_network_coverage ?? {};
  const linePlan: HealthPlan = {
    ...plan,
    default: {
      ...plan.default,
      in_network_coverage: {
        ...defaultCoverage,
        coinsurance: rateAfterDeductible(plan, planData, userInputs),
      },
    },
  };
  const uncovered = uncoveredEstimates(planData, userInputs);
  const shares = personShares(planData, userInputs);
  // One bill for the family as a whole. Split between people, each person's share comes as
  // monthly bills, so the deductible falls across everyone as it does on the user's own care.
  const bills = (spending: number): CategoryEstimate[] =>
    shares.length === 1 && shares[0].person === undefined
      ? [billOf(spending, 1, undefined)]
      : shares.map(({ person, share }) => billOf((spending * share) / 12, 12, person));
  return spending =>
    calculatePlanCost(linePlan, planData, {
      ...userInputs,
      costs: {
        ...userInputs.costs,
        categoryEstimates: [...(spending > 0 ? bills(spending) : []), ...uncovered],
      },
    }).totalCost;
}

function billOf(costPerVisit: number, quantity: number, person: number | undefined) {
  return {
    categoryId: DEFAULT_COVERAGE_CATEGORY,
    estimate: { quantity, costPerVisit, isInNetwork: true },
    notes: '',
    person,
  };
}

/**
 * Lowest spending (to the cent) at which a non-decreasing line reaches `target`, or null if it
 * never does below the search ceiling
 */
function spendingWhereCostReaches(
  costAt: (spending: number) => number,
  target: number
): number | null {
  if (costAt(0) >= target) {
    return 0;
  }
  if (costAt(SEARCH_CEILING) < target) {
    return null;
  }
  let low = 0;
  let high = SEARCH_CEILING;
  while (high - low > 1) {
    const mid = (low + high) / 2;
    if (costAt(mid) >= target) {
      high = mid;
    } else {
      low = mid;
    }
  }
  // The line is straight just below the crossing, so extend it to land on the exact spot
  const a = Math.max(0, low - 2);
  const rise = costAt(low) - costAt(a);
  const exact = rise > 0 ? low + ((target - costAt(low)) * (low - a)) / rise : high;
  return Math.round(Math.min(Math.max(exact, low), high) * 100) / 100;
}

function deductibleFor(plan: HealthPlan, coverage: CoverageType): number {
  // two_party and family both use the family deductible, as in the cost engine
  const deductible = plan.annual_deductible.in_network;
  return coverage === CoverageType.Single ? deductible.single : deductible.family;
}

/**
 * Chart lines, one per plan, of total cost against in-network bills, plus a dot per plan at the
 * user's own non-free spending and that plan's real total for their estimates.
 *
 * After the deductible each line charges the plan's rate for the user's mix of care, copays
 * included, and every line carries the user's care no plan pays for. The lines still bill 100%
 * before the deductible and ignore visit limits and care free on only some plans, so the dots can
 * sit off them.
 */
export function generateChartData(planData: PlanData, userInputs: UserInputs): ChartDataResult {
  const userSpending = calculateUserSpending(planData, userInputs);
  const results = calculateAllPlans(planData, userInputs);

  const lines = planData.plans.map(plan => {
    const costAt = planLine(plan, planData, userInputs);
    // Where the line stops rising: the worst case, or lower when one person's care dominates and
    // their own max stops it first. A hair under, so rounding noise on the flat stretch still
    // counts as flat.
    const maxAnnualCost = results.find(r => r.planName === plan.name)!.maxAnnualCost;
    const top = costAt(SEARCH_CEILING);
    const stillRising = top - costAt(SEARCH_CEILING * 0.99) > 0.01;
    const flatPoint =
      top >= maxAnnualCost - 0.01
        ? spendingWhereCostReaches(costAt, maxAnnualCost - 1e-6)
        : stillRising
          ? null
          : spendingWhereCostReaches(costAt, top - 0.01);
    return { plan, costAt, flatPoint };
  });
  const latestFlatPoint = Math.max(0, ...lines.map(line => line.flatPoint ?? 0));
  const maxSpending = Math.max(latestFlatPoint + PAST_FLATLINE, userSpending * PAST_USER_SPENDING);

  // Every line shares one set of x values (so a hover shows all plans), with each plan's
  // deductible and flat point included so the bends are exact
  const points = new Set<number>([0, maxSpending, userSpending]);
  for (let i = 1; i < GRID_POINTS; i++) {
    points.add(Math.round((maxSpending * i) / GRID_POINTS));
  }
  lines.forEach(({ plan, flatPoint }) => {
    points.add(deductibleFor(plan, userInputs.coverage));
    if (flatPoint !== null) {
      points.add(flatPoint);
    }
  });
  const spendingPoints = Array.from(points)
    .filter(spending => spending <= maxSpending)
    .sort((a, b) => a - b);

  const plans = lines.map(({ plan, costAt }) => ({
    planName: plan.name,
    data: spendingPoints.map(spending => ({ spending, totalCost: costAt(spending) })),
  }));

  const dots =
    userInputs.costs.categoryEstimates.length > 0
      ? planData.plans.map(plan => ({
          planName: plan.name,
          spending: userSpending,
          totalCost: results.find(r => r.planName === plan.name)!.totalCost,
        }))
      : [];

  return { plans, dots, userSpending, maxSpending };
}

/**
 * Spending at which a plan's chart line crosses $0 total cost, or null if the plan
 * never comes out ahead (base cost already >= 0) or never stops coming out ahead
 */
export function breakEvenSpending(
  planData: PlanData,
  userInputs: UserInputs,
  planResult: PlanResult
): number | null {
  const plan = planData.plans.find(p => p.name === planResult.planName);
  if (!plan) {
    return null;
  }
  const costAt = planLine(plan, planData, userInputs);
  if (costAt(0) >= 0) {
    return null;
  }
  return spendingWhereCostReaches(costAt, 0);
}
