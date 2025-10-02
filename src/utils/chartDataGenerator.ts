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
 * - HSA plans: Pure mathematical projection (deductible + coinsurance)
 * - PPO plans: Linear approximation based on user's effective spending rate
 */
export function generateChartData(planData: PlanData, userInputs: UserInputs): ChartDataResult {
  const userSpending = calculateUserSpending(planData, userInputs);

  // Calculate the spending level where each plan hits its OOP maximum
  const spendingToHitOOPMax = planData.plans.map(plan => {
    const oopMax = plan.out_of_pocket_maximum.in_network;
    const oopMaxValue =
      userInputs.coverage === CoverageType.Single ? oopMax.individual : oopMax.family;
    const deductible = plan.annual_deductible.in_network;
    const deductibleValue =
      userInputs.coverage === CoverageType.Single ? deductible.single : deductible.family;

    const isHSA = isHSAQualified(plan, planData, userInputs.coverage);

    if (isHSA) {
      // HSA: spending = deductible + (OOP_max - deductible) / coinsurance
      const coinsurance = plan.default.in_network_coverage?.coinsurance || 0.4;
      return deductibleValue + (oopMaxValue - deductibleValue) / coinsurance;
    } else {
      // PPO: Calculate effective rate from user's estimates
      if (userSpending > 0) {
        const baseResult = calculatePlanCost(plan, planData, userInputs);
        const effectiveRate = baseResult.outOfPocketCosts / userSpending;
        return oopMaxValue / effectiveRate;
      } else {
        // Use default coinsurance if no user estimates
        const defaultCoinsurance = plan.default.in_network_coverage?.coinsurance || 0.3;
        return oopMaxValue / defaultCoinsurance;
      }
    }
  });

  // Find the maximum spending needed across all plans, then add $10k buffer
  // Also ensure we go to at least 2x the user's estimated spending
  const maxSpendingToHitOOP = Math.max(...spendingToHitOOPMax);
  const maxSpending = Math.max(maxSpendingToHitOOP + 10_000, userSpending * 2);

  // Generate 500 spending points for smooth lines
  const numPoints = 500;
  const spendingPoints: number[] = [];
  for (let i = 0; i <= numPoints; i++) {
    spendingPoints.push((i / numPoints) * maxSpending);
  }

  // Generate chart data for each plan
  const plans = planData.plans.map(plan => {
    // Determine if this plan uses HSA (solid line) or PPO (dashed line)
    const isHSA = isHSAQualified(plan, planData, userInputs.coverage);

    if (isHSA) {
      // HSA: Pure mathematical projection with synthetic data
      const dataPoints = spendingPoints.map(targetSpending => {
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

        const result = calculatePlanCost(plan, planData, syntheticInputs);

        return {
          spending: targetSpending,
          totalCost: result.totalCost,
        };
      });

      return {
        planName: plan.name,
        data: dataPoints,
        dashed: false,
      };
    } else {
      // PPO: Linear approximation based on user's effective spending rate
      const linearData = generatePPOLinearApproximation(
        plan,
        planData,
        userInputs,
        userSpending,
        spendingPoints
      );

      return {
        planName: plan.name,
        data: linearData,
        dashed: true,
      };
    }
  });

  return {
    plans,
    maxSpending,
  };
}

/**
 * Generate linear approximation for PPO plans based on user's effective spending rate
 */
function generatePPOLinearApproximation(
  plan: any,
  planData: PlanData,
  userInputs: UserInputs,
  userSpending: number,
  spendingPoints: number[]
): ChartPoint[] {
  // Calculate OOP maximum for this plan
  const oopMax = plan.out_of_pocket_maximum.in_network;
  const oopMaxValue =
    userInputs.coverage === CoverageType.Single ? oopMax.individual : oopMax.family;

  // Calculate fixed costs (premiums, tax savings, employer contribution)
  const baseResult = calculatePlanCost(plan, planData, userInputs);
  const fixedCosts =
    baseResult.annualPremiums - baseResult.taxSavings - baseResult.employerContribution;

  // Calculate effective spending rate from user's actual estimates
  let effectiveRate: number;

  if (userSpending > 0) {
    // User has estimates - calculate their effective rate
    const userOOPCosts = baseResult.outOfPocketCosts;
    effectiveRate = userOOPCosts / userSpending;
  } else {
    // User has no estimates - use plan's default coinsurance rate
    const defaultCoinsurance = plan.default.in_network_coverage?.coinsurance || 0.3;
    effectiveRate = defaultCoinsurance;
  }

  // Generate linear points: totalCost = fixedCosts + min(spending * effectiveRate, oopMax)
  return spendingPoints.map(spending => {
    const healthcareOOP = Math.min(spending * effectiveRate, oopMaxValue);
    const totalCost = fixedCosts + healthcareOOP;

    return {
      spending,
      totalCost,
    };
  });
}
