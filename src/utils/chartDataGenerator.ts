import { PlanData, UserInputs, CoverageType } from '../types';
import { calculatePlanCost } from './costCalculator';
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
  dashed?: boolean; // True for PPO plans (projections less reliable)
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
 * Uses pure mathematical projection - does NOT depend on user's specific healthcare estimates
 */
export function generateChartData(planData: PlanData, userInputs: UserInputs): PlanChartData[] {
  // Find the highest out-of-pocket maximum across all plans
  const highestOOPMax = Math.max(
    ...planData.plans.map(plan => {
      const oopMax = plan.out_of_pocket_maximum.in_network;
      if (userInputs.coverage === CoverageType.Single) {
        return oopMax.individual;
      } else {
        // Two-party and family use family OOP max
        return oopMax.family;
      }
    })
  );

  // Generate data points from $0 to highest OOP + $10k
  const maxSpending = highestOOPMax + 10_000;

  // Generate 500 spending points for smooth lines
  const numPoints = 500;
  const spendingPoints: number[] = [];
  for (let i = 0; i <= numPoints; i++) {
    spendingPoints.push((i / numPoints) * maxSpending);
  }

  // Generate chart data for each plan
  return planData.plans.map(plan => {
    // Determine if this plan uses HSA (solid line) or PPO (dashed line)
    const isHSA = isHSAQualified(plan, planData, userInputs.coverage);

    // Calculate cost at each spending point using pure mathematical projection
    const dataPoints = spendingPoints.map(targetSpending => {
      // Create synthetic inputs with generic "other" category spending
      // This gives us pure deductible + coinsurance math (no copays, no service mix)
      const syntheticInputs: UserInputs = {
        year: userInputs.year,
        coverage: userInputs.coverage,
        ageGroup: userInputs.ageGroup,
        taxRate: userInputs.taxRate,
        hsaContribution: userInputs.hsaContribution,
        fsaContribution: userInputs.fsaContribution,
        costs: {
          categoryEstimates: [
            {
              categoryId: 'other',
              estimate: {
                quantity: 1,
                costPerVisit: targetSpending,
                isInNetwork: true,
              },
            },
          ],
        },
      };

      // Calculate plan cost at this spending level
      const result = calculatePlanCost(plan, planData, syntheticInputs);

      return {
        spending: targetSpending,
        totalCost: result.totalCost,
      };
    });

    return {
      planName: plan.name,
      data: dataPoints,
      dashed: !isHSA, // PPO plans get dashed lines
    };
  });
}
