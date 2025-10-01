import { PlanData, UserInputs, CategoryEstimate } from '../types';
import { calculatePlanCost } from './costCalculator';

export interface ChartDataPoint {
  spending: number;
  totalCost: number;
}

export interface PlanChartData {
  planName: string;
  data: ChartDataPoint[];
  color: string;
}

export interface ChartIntersection {
  planA: string;
  planB: string;
  spending: number;
  cost: number;
}

/**
 * Calculate user's total estimated spending from their inputs
 */
export const calculateUserSpending = (userInputs: UserInputs): number => {
  let totalSpending = 0;

  for (const categoryEstimate of userInputs.costs.categoryEstimates) {
    const { estimate } = categoryEstimate;
    const costPerCategory = estimate.quantity * estimate.costPerVisit;
    totalSpending += costPerCategory;
  }

  return totalSpending;
};

/**
 * Generate a spending range up to $1M for comprehensive chart data
 */
export const generateSpendingRange = (_userInputs: UserInputs): number[] => {
  // Always generate data up to $1M to allow full zoom-out capability
  const maxSpending = 1_000_000;

  // Generate ~100 points for smooth curves across the full range
  const numPoints = 100;
  const step = maxSpending / (numPoints - 1);

  const spendingPoints: number[] = [];
  for (let i = 0; i < numPoints; i++) {
    spendingPoints.push(Math.round(i * step));
  }

  return spendingPoints;
};

/**
 * Generate chart data for all plans across spending scenarios
 */
export const generateChartData = (planData: PlanData, userInputs: UserInputs): PlanChartData[] => {
  const spendingScenarios = generateSpendingRange(userInputs);

  return planData.plans.map(plan => {
    const chartData: ChartDataPoint[] = [];

    for (const spending of spendingScenarios) {
      // Create a modified UserInputs for this spending scenario
      const scenarioInputs = createScenarioInputs(userInputs, spending);

      // Calculate cost for this scenario
      const result = calculatePlanCost(plan, planData, scenarioInputs);

      chartData.push({
        spending,
        totalCost: result.totalCost,
      });
    }

    return {
      planName: plan.name,
      data: chartData,
      color: plan.chart_color || '#6b7280', // Use color from plan data, fallback to gray
    };
  });
};

/**
 * Create a modified UserInputs for a specific spending scenario
 * Distributes the total spending proportionally across categories
 */
const createScenarioInputs = (baseInputs: UserInputs, targetSpending: number): UserInputs => {
  const currentSpending = calculateUserSpending(baseInputs);

  if (currentSpending === 0 || baseInputs.costs.categoryEstimates.length === 0) {
    // If no categories, create a single "other" category with the target spending
    return {
      ...baseInputs,
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
  }

  // Scale each category proportionally to reach target spending
  const scaleFactor = targetSpending / currentSpending;

  const scaledCategories: CategoryEstimate[] = baseInputs.costs.categoryEstimates.map(cat => ({
    ...cat,
    estimate: {
      ...cat.estimate,
      costPerVisit: cat.estimate.costPerVisit * scaleFactor,
    },
  }));

  return {
    ...baseInputs,
    costs: {
      categoryEstimates: scaledCategories,
    },
  };
};

/**
 * Find intersections between two plan cost curves using linear interpolation
 */
export const findIntersection = (
  dataA: ChartDataPoint[],
  dataB: ChartDataPoint[]
): ChartIntersection | null => {
  for (let i = 0; i < dataA.length - 1; i++) {
    const diff1 = dataA[i].totalCost - dataB[i].totalCost;
    const diff2 = dataA[i + 1].totalCost - dataB[i + 1].totalCost;

    // Check if lines cross (sign change in difference)
    if (diff1 * diff2 < 0 || diff1 === 0) {
      // Linear interpolation to find exact crossing point
      const x1 = dataA[i].spending;
      const x2 = dataA[i + 1].spending;
      const y1 = diff1;
      const y2 = diff2;

      if (y1 === 0) {
        return {
          planA: '',
          planB: '',
          spending: x1,
          cost: dataA[i].totalCost,
        };
      }

      // Find where diff line crosses zero
      const t = -y1 / (y2 - y1);
      const spending = x1 + t * (x2 - x1);
      const cost = dataA[i].totalCost + t * (dataA[i + 1].totalCost - dataA[i].totalCost);

      return {
        planA: '',
        planB: '',
        spending: Math.round(spending),
        cost: Math.round(cost),
      };
    }
  }

  return null;
};

/**
 * Find all intersections between plan curves
 */
export const findAllIntersections = (chartData: PlanChartData[]): ChartIntersection[] => {
  const intersections: ChartIntersection[] = [];

  // Check all pairs of plans
  for (let i = 0; i < chartData.length; i++) {
    for (let j = i + 1; j < chartData.length; j++) {
      const intersection = findIntersection(chartData[i].data, chartData[j].data);

      if (intersection) {
        intersections.push({
          ...intersection,
          planA: chartData[i].planName,
          planB: chartData[j].planName,
        });
      }
    }
  }

  return intersections;
};
