import { generateChartData, calculateUserSpending } from '../chartDataGenerator';
import { calculateAllPlans } from '../costCalculator';
import { loadPlanData } from '../../services/planDataService';
import { UserInputs, CoverageType } from '../../types';

describe('chartDataGenerator - 2026 Real Data Bug Test', () => {
  it('should generate chart data that matches calculator results at user spending level', () => {
    // Load actual 2026 plan data
    const planData = loadPlanData(2026);

    // User inputs from the URL (same as costCalculator test)
    const userInputs: UserInputs = {
      year: 2026,
      coverage: CoverageType.Family,
      ageGroup: 'under_55',
      taxRate: 22,
      hsaContribution: 3400,
      fsaContribution: 3400,
      costs: {
        categoryEstimates: [
          {
            categoryId: 'emergency_room',
            estimate: {
              quantity: 1,
              costPerVisit: 5000,
              isInNetwork: true,
            },
            notes: '',
          },
          {
            categoryId: 'chiropractic_therapy',
            estimate: {
              quantity: 25,
              costPerVisit: 250,
              isInNetwork: true,
            },
            notes: '',
          },
          {
            categoryId: 'behavioral_mental_health_inpatient',
            estimate: {
              quantity: 50,
              costPerVisit: 175,
              isInNetwork: true,
            },
            notes: '',
          },
          {
            categoryId: 'pharmacy_tier_1_retail_30',
            estimate: {
              quantity: 12,
              costPerVisit: 20,
              isInNetwork: true,
            },
            notes: '',
          },
        ],
      },
    };

    // Calculate user spending
    const userSpending = calculateUserSpending(planData, userInputs);
    console.log(`\nUser spending: $${userSpending}`);

    // Calculate correct results from calculator
    const calculatorResults = calculateAllPlans(planData, userInputs);

    // Generate chart data
    const chartData = generateChartData(planData, userInputs);

    console.log('\n=== COMPARING CALCULATOR VS CHART ===');
    console.log(`User Spending Level: $${userSpending.toLocaleString()}\n`);

    // For each plan, find the chart data point closest to user's spending
    calculatorResults.forEach(calcResult => {
      const chartPlan = chartData.plans.find(p => p.planName === calcResult.planName);

      if (!chartPlan) {
        console.log(`ERROR: Chart data not found for ${calcResult.planName}`);
        return;
      }

      // Find the chart point closest to user's spending level
      let closestPoint = chartPlan.data[0];
      let minDiff = Math.abs(chartPlan.data[0].spending - userSpending);

      for (const point of chartPlan.data) {
        const diff = Math.abs(point.spending - userSpending);
        if (diff < minDiff) {
          minDiff = diff;
          closestPoint = point;
        }
      }

      // Find the flatline point (max spending)
      const flatlinePoint = chartPlan.data[chartPlan.data.length - 1];

      console.log(`${calcResult.planName}:`);
      console.log(`  Calculator Total Cost: $${calcResult.totalCost.toFixed(2)}`);
      console.log(
        `  Chart at User Spending ($${closestPoint.spending.toFixed(0)}): $${closestPoint.totalCost.toFixed(2)}`
      );
      console.log(`  Difference: $${(closestPoint.totalCost - calcResult.totalCost).toFixed(2)}`);
      console.log(`  Calculator Worst Case: $${calcResult.maxAnnualCost.toFixed(2)}`);
      console.log(`  Chart Flatline: $${flatlinePoint.totalCost.toFixed(2)}`);
      console.log(
        `  Flatline Difference: $${(flatlinePoint.totalCost - calcResult.maxAnnualCost).toFixed(2)}`
      );
      console.log('');
    });

    // Test that chart values match calculator values at user's spending level
    const ppo70Calc = calculatorResults.find(r => r.planName === 'DMBA PPO 70');
    const hsa60Calc = calculatorResults.find(r => r.planName === 'DMBA HSA 60');
    const hsa80Calc = calculatorResults.find(r => r.planName === 'DMBA HSA 80');
    const ppo90Calc = calculatorResults.find(r => r.planName === 'DMBA PPO 90');

    const ppo70Chart = chartData.plans.find(p => p.planName === 'DMBA PPO 70');
    const hsa60Chart = chartData.plans.find(p => p.planName === 'DMBA HSA 60');
    const hsa80Chart = chartData.plans.find(p => p.planName === 'DMBA HSA 80');
    const ppo90Chart = chartData.plans.find(p => p.planName === 'DMBA PPO 90');

    // Helper to find chart value at user's spending
    const getChartValueAtSpending = (chartPlan: any, spending: number) => {
      let closestPoint = chartPlan.data[0];
      let minDiff = Math.abs(chartPlan.data[0].spending - spending);

      for (const point of chartPlan.data) {
        const diff = Math.abs(point.spending - spending);
        if (diff < minDiff) {
          minDiff = diff;
          closestPoint = point;
        }
      }
      return closestPoint.totalCost;
    };

    const ppo70ChartCost = getChartValueAtSpending(ppo70Chart, userSpending);
    const hsa60ChartCost = getChartValueAtSpending(hsa60Chart, userSpending);
    const hsa80ChartCost = getChartValueAtSpending(hsa80Chart, userSpending);
    const ppo90ChartCost = getChartValueAtSpending(ppo90Chart, userSpending);

    console.log('\n=== TESTING ASSERTIONS ===');
    console.log('Chart should match calculator values at user spending level:');
    console.log(
      `PPO 70: Chart $${ppo70ChartCost.toFixed(2)} should equal Calculator $${ppo70Calc!.totalCost.toFixed(2)}`
    );
    console.log(
      `HSA 60: Chart $${hsa60ChartCost.toFixed(2)} should equal Calculator $${hsa60Calc!.totalCost.toFixed(2)}`
    );
    console.log(
      `HSA 80: Chart $${hsa80ChartCost.toFixed(2)} should equal Calculator $${hsa80Calc!.totalCost.toFixed(2)}`
    );
    console.log(
      `PPO 90: Chart $${ppo90ChartCost.toFixed(2)} should equal Calculator $${ppo90Calc!.totalCost.toFixed(2)}`
    );

    // These should be equal (within rounding tolerance of $10)
    expect(Math.abs(ppo70ChartCost - ppo70Calc!.totalCost)).toBeLessThan(10);
    expect(Math.abs(hsa60ChartCost - hsa60Calc!.totalCost)).toBeLessThan(10);
    expect(Math.abs(hsa80ChartCost - hsa80Calc!.totalCost)).toBeLessThan(10);
    expect(Math.abs(ppo90ChartCost - ppo90Calc!.totalCost)).toBeLessThan(10);

    // Check flatlines match worst case
    const ppo70Flatline = ppo70Chart!.data[ppo70Chart!.data.length - 1].totalCost;
    const hsa60Flatline = hsa60Chart!.data[hsa60Chart!.data.length - 1].totalCost;
    const hsa80Flatline = hsa80Chart!.data[hsa80Chart!.data.length - 1].totalCost;
    const ppo90Flatline = ppo90Chart!.data[ppo90Chart!.data.length - 1].totalCost;

    console.log('\nChart flatlines should match calculator worst case:');
    console.log(
      `PPO 70: Chart $${ppo70Flatline.toFixed(2)} should equal Calculator $${ppo70Calc!.maxAnnualCost.toFixed(2)}`
    );
    console.log(
      `HSA 60: Chart $${hsa60Flatline.toFixed(2)} should equal Calculator $${hsa60Calc!.maxAnnualCost.toFixed(2)}`
    );
    console.log(
      `HSA 80: Chart $${hsa80Flatline.toFixed(2)} should equal Calculator $${hsa80Calc!.maxAnnualCost.toFixed(2)}`
    );
    console.log(
      `PPO 90: Chart $${ppo90Flatline.toFixed(2)} should equal Calculator $${ppo90Calc!.maxAnnualCost.toFixed(2)}`
    );

    expect(Math.abs(ppo70Flatline - ppo70Calc!.maxAnnualCost)).toBeLessThan(10);
    expect(Math.abs(hsa60Flatline - hsa60Calc!.maxAnnualCost)).toBeLessThan(10);
    expect(Math.abs(hsa80Flatline - hsa80Calc!.maxAnnualCost)).toBeLessThan(10);
    expect(Math.abs(ppo90Flatline - ppo90Calc!.maxAnnualCost)).toBeLessThan(10);
  });
});
