import { generateChartData } from '../chartDataGenerator';
import { calculateAllPlans } from '../costCalculator';
import { loadPlanData } from '../../services/planDataService';
import { UserInputs, CoverageType } from '../../types';

describe('chartDataGenerator 2026', () => {
  const planData = loadPlanData('dmba', 2026);
  const visits = (categoryId: string, quantity: number, costPerVisit: number) => ({
    categoryId,
    estimate: { quantity, costPerVisit, isInNetwork: true },
    notes: '',
  });
  const userInputs: UserInputs = {
    year: 2026,
    coverage: CoverageType.Family,
    ageGroup: 'under_55',
    taxRate: 22,
    hsaContribution: 3400,
    fsaContribution: 3400,
    costs: {
      categoryEstimates: [
        visits('emergency_room', 1, 5000),
        visits('chiropractic_therapy', 25, 250),
        visits('behavioral_mental_health_inpatient', 50, 175),
        visits('pharmacy_tier_1_retail_30', 12, 20),
      ],
    },
  };
  const results = calculateAllPlans(planData, userInputs);
  const chart = generateChartData(planData, userInputs);

  it('puts each plan’s dot at its calculated total', () => {
    for (const result of results) {
      const dot = chart.dots.find(d => d.planName === result.planName)!;
      expect(dot.spending).toBe(5000 + 25 * 250 + 50 * 175 + 12 * 20);
      expect(dot.totalCost).toBe(result.totalCost);
    }
  });

  it('flattens every line at the plan’s worst case', () => {
    for (const result of results) {
      const data = chart.plans.find(p => p.planName === result.planName)!.data;
      expect(data[data.length - 1].totalCost).toBeCloseTo(result.maxAnnualCost, 6);
    }
  });
});
