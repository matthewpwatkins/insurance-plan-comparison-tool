import { PlanData, UserInputs, PlanResult, HealthPlan, CoverageType } from '../types';
import {
  calculateAllPlans,
  calculatePlanCost,
  categoryCoverage,
  categoryQuantityCap,
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
}

/**
 * The user's estimates with care that is free on every plan taken out.
 *
 * A category counts as free only if every plan covers it at no charge in that network, and only
 * up to the smallest visit limit among the plans; visits past that limit are billed on some plan,
 * so they stay in at their full cost. Care free on only some plans stays in full.
 */
function billedEstimates(planData: PlanData, userInputs: UserInputs): BilledEstimate[] {
  const freeVisitsUsed: Record<string, number> = {};
  return userInputs.costs.categoryEstimates.map(({ categoryId, estimate }) => {
    const network: Network = estimate.isInNetwork ? 'in_network' : 'out_of_network';
    const quantity = Math.round(estimate.quantity);
    const billed = { categoryId, network, quantity, costPerVisit: estimate.costPerVisit };
    const freeEverywhere =
      planData.plans.length > 0 &&
      planData.plans.every(plan => categoryCoverage(plan, categoryId, network)?.is_free === true);
    if (!freeEverywhere) {
      return billed;
    }
    // A limit spans every row of the category, as in the cost engine
    const freeLimit = Math.min(
      ...planData.plans.map(plan => categoryQuantityCap(plan, categoryId, network) ?? Infinity)
    );
    const key = `${categoryId}|${network}`;
    const freeVisits = Math.min(quantity, Math.max(0, freeLimit - (freeVisitsUsed[key] ?? 0)));
    freeVisitsUsed[key] = (freeVisitsUsed[key] ?? 0) + freeVisits;
    return { ...billed, quantity: quantity - freeVisits };
  });
}

/**
 * Billed spending on the user's estimates, leaving out care that is free on every plan
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
 * A plan's total annual cost when the year's care is `spending` of in-network bills: premiums
 * and account savings, then 100% of bills until the deductible, then the plan's rate for the
 * user's mix of care, then nothing more past the out-of-pocket max.
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
  return spending =>
    calculatePlanCost(linePlan, planData, {
      ...userInputs,
      costs: {
        ...userInputs.costs,
        categoryEstimates:
          spending > 0
            ? [
                {
                  categoryId: DEFAULT_COVERAGE_CATEGORY,
                  estimate: { quantity: 1, costPerVisit: spending, isInNetwork: true },
                  notes: '',
                },
              ]
            : [],
      },
    }).totalCost;
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
 * included. The lines still bill 100% before the deductible and ignore visit limits and care free
 * on only some plans, so the dots can sit off them.
 */
export function generateChartData(planData: PlanData, userInputs: UserInputs): ChartDataResult {
  const userSpending = calculateUserSpending(planData, userInputs);
  const results = calculateAllPlans(planData, userInputs);

  const lines = planData.plans.map(plan => {
    const costAt = planLine(plan, planData, userInputs);
    const maxAnnualCost = results.find(r => r.planName === plan.name)!.maxAnnualCost;
    // A hair under the worst case, so rounding noise on the flat stretch still counts as flat
    const flatPoint = spendingWhereCostReaches(costAt, maxAnnualCost - 1e-6);
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
  const baseCost =
    planResult.netAnnualPremiums - planResult.taxSavings - planResult.employerContribution;
  if (baseCost >= 0) {
    return null;
  }
  const plan = planData.plans.find(p => p.name === planResult.planName);
  if (!plan) {
    return null;
  }
  return spendingWhereCostReaches(planLine(plan, planData, userInputs), 0);
}
