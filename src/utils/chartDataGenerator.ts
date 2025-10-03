import { PlanData, UserInputs, PlanResult } from '../types';
import { calculateAllPlans } from './costCalculator';
import { isHSAQualified } from '../services/planDataService';

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
  dashed?: boolean; // True for PPO plans (projections are approximations)
}

/**
 * Return type for generateChartData including max spending value
 */
export interface ChartDataResult {
  plans: PlanChartData[];
  maxSpending: number;
}

/**
 * Calculate the user's current total healthcare spending based on their estimates
 * This represents the total billed amount (after insurance negotiation, before split)
 */
export function calculateUserSpending(planData: PlanData, userInputs: UserInputs): number {
  return userInputs.costs.categoryEstimates.reduce((total, categoryEstimate) => {
    const costForCategory =
      categoryEstimate.estimate.quantity * categoryEstimate.estimate.costPerVisit;
    return total + costForCategory;
  }, 0);
}

/**
 * Generate chart data for all plans showing how total cost varies with healthcare spending
 *
 * Approach:
 * - Calculate PlanResult for user's actual inputs to get accurate costs
 * - For each plan, generate a line that:
 *   1. Starts at base cost (net premiums - tax savings - employer contributions)
 *   2. Passes through the user's actual spending point at the calculated totalCost
 *   3. Continues until hitting maxAnnualCost (OOP max plateau)
 *   4. Flatlines from there
 */
export function generateChartData(planData: PlanData, userInputs: UserInputs): ChartDataResult {
  const userSpending = calculateUserSpending(planData, userInputs);

  // Calculate results for user's actual inputs
  const planResults = calculateAllPlans(planData, userInputs);

  // Calculate max spending range for chart
  // Find the spending level where each plan hits its OOP max (flatline)
  const spendingAtFlatlines = planResults.map(planResult => {
    const baseCost =
      planResult.netAnnualPremiums - planResult.taxSavings - planResult.employerContribution;

    let slope: number;
    if (userSpending > 0 && planResult.outOfPocketCosts > 0) {
      slope = planResult.outOfPocketCosts / userSpending;
    } else if (userSpending > 0) {
      slope = 0.01;
    } else {
      const plan = planData.plans.find(p => p.name === planResult.planName);
      const defaultCoinsurance = plan?.default.in_network_coverage?.coinsurance || 0.3;
      slope = defaultCoinsurance;
    }

    // Calculate where this plan hits OOP max
    return slope > 0 ? (planResult.maxAnnualCost - baseCost) / slope : 0;
  });

  // Find the latest (highest spending) flatline and add $10k
  const latestFlatline = Math.max(...spendingAtFlatlines);
  const tenKPastLatestFlatline = latestFlatline + 10_000;

  // Use the greater of: 2x user spending OR $10k past latest flatline
  const maxSpending = Math.max(userSpending * 2, tenKPastLatestFlatline);

  // Generate spending points every $500 for cleaner data
  const spendingPoints: number[] = [];
  for (let spending = 0; spending <= maxSpending; spending += 500) {
    spendingPoints.push(spending);
  }
  // Add final point at maxSpending if not already there
  if (spendingPoints[spendingPoints.length - 1] !== maxSpending) {
    spendingPoints.push(maxSpending);
  }

  // Always include user's exact spending point for accurate intersection
  if (userSpending > 0 && !spendingPoints.includes(userSpending)) {
    spendingPoints.push(userSpending);
    spendingPoints.sort((a, b) => a - b);
  }

  // Generate chart data for each plan
  const plans = planData.plans.map(plan => {
    const planResult = planResults.find(r => r.planName === plan.name)!;
    const isHSA = isHSAQualified(plan, planData, userInputs.coverage);

    // All plans now use linear approximation based on actual PlanResult
    // This ensures the chart passes through the user's exact calculated cost
    return generateLinearChartData(
      plan,
      planData,
      userInputs,
      planResult,
      userSpending,
      spendingPoints,
      !isHSA // PPO plans use dashed lines
    );
  });

  return {
    plans,
    maxSpending,
  };
}

/**
 * Generate chart data using linear approximation based on actual PlanResult
 *
 * Both HSA and PPO plans use this linear approximation to ensure the chart
 * passes through the user's exact calculated cost. While HSA plans technically
 * have non-linear behavior (due to deductibles), the linear approximation
 * ensures accuracy at the user's actual spending level.
 *
 * 1. Base cost (y-intercept): Net premiums - tax savings - employer contributions
 * 2. Slope: Calculated from user's actual spending point
 * 3. Plateau: At maxAnnualCost when OOP max is hit
 */
function generateLinearChartData(
  plan: any,
  planData: PlanData,
  userInputs: UserInputs,
  planResult: PlanResult,
  userSpending: number,
  spendingPoints: number[],
  dashed: boolean
): PlanChartData {
  // Base cost: What you pay even with $0 healthcare spending
  // = Net premiums (after Premium Net Discount) - tax savings - employer contributions
  const baseCost =
    planResult.netAnnualPremiums - planResult.taxSavings - planResult.employerContribution;

  // Calculate slope from user's actual result
  // Slope = rise / run = (totalCost - baseCost) / userSpending
  let slope: number;

  if (userSpending > 0 && planResult.outOfPocketCosts > 0) {
    // Use actual calculated effective rate
    slope = planResult.outOfPocketCosts / userSpending;
  } else if (userSpending > 0) {
    // User has spending but no OOP costs (everything was free/copays hit OOP max)
    // Use a small slope
    slope = 0.01;
  } else {
    // No user spending - use plan's default coinsurance as estimate
    const defaultCoinsurance = plan.default.in_network_coverage?.coinsurance || 0.3;
    slope = defaultCoinsurance;
  }

  // Find the spending level where we hit OOP max
  // At OOP max, totalCost = maxAnnualCost
  // baseCost + (spending * slope) = maxAnnualCost
  // spending = (maxAnnualCost - baseCost) / slope
  const spendingAtOOPMax =
    slope > 0 ? (planResult.maxAnnualCost - baseCost) / slope : Number.MAX_SAFE_INTEGER;

  // Generate points
  const dataPoints = spendingPoints.map(spending => {
    let totalCost: number;

    if (spending <= spendingAtOOPMax) {
      // Before hitting OOP max: linear increase
      totalCost = baseCost + spending * slope;
    } else {
      // After hitting OOP max: flatline at maxAnnualCost
      totalCost = planResult.maxAnnualCost;
    }

    return {
      spending,
      totalCost: Math.round(totalCost), // Round to nearest dollar
    };
  });

  return {
    planName: plan.name,
    data: dataPoints,
    dashed, // Dashed for PPO (approximation), solid for HSA
  };
}
