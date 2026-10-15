import { calculateAllPlans } from '../costCalculator';
import { loadPlanData } from '../../services/planDataService';
import { UserInputs, CoverageType } from '../../types';

describe('costCalculator - 2026 Real Data Bug Test', () => {
  it('should calculate correct costs for user input: emergency_room + chiropractic + mental_health + pharmacy', () => {
    // Load actual 2026 plan data
    const planData = loadPlanData('dmba', 2026);

    // User inputs from the URL
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

    // Calculate all plans
    const results = calculateAllPlans(planData, userInputs);

    // Expected results
    // 1. PPO 70: $6,061 total, $10,916 worst case
    // 2. HSA 80: $6,435 total, $8,607 worst case
    // 3. HSA 60: $8,792 total, $12,166 worst case
    // 4. PPO 90: $10,639 total, $14,239 worst case
    // HSA 60 out of pocket, family deductible $6,100 then 40% coinsurance:
    //   ER $5,000 (all deductible) + chiro 25 x $250 ($1,100 deductible + 40% of $5,150)
    //   + inpatient mental health 40% of $8,750 + 12 fills at the $15 copay = $11,840.
    //   Spread through the year, 2 fills land before the deductible is met and cost their full
    //   $20, which counts toward the deductible. Each costs $5 more than the copay but moves $20
    //   of other bills from full price to 40% ($12 less), so $11,840 - 2 x $7 = $11,826.
    //   Chiropractic only sets a visit limit on this plan, so its cost uses the default coverage.

    // Find each plan's result
    const ppo70 = results.find(r => r.planName === 'DMBA PPO 70');
    const hsa60 = results.find(r => r.planName === 'DMBA HSA 60');
    const hsa80 = results.find(r => r.planName === 'DMBA HSA 80');
    const ppo90 = results.find(r => r.planName === 'DMBA PPO 90');

    expect(results.map(r => r.planName)).toEqual([
      'DMBA PPO 70',
      'DMBA HSA 80',
      'DMBA HSA 60',
      'DMBA PPO 90',
    ]);
    expect(ppo70).toBeDefined();
    expect(hsa60).toBeDefined();
    expect(hsa80).toBeDefined();
    expect(ppo90).toBeDefined();

    expect(Math.round(ppo70!.totalCost)).toBe(6061);
    expect(Math.round(ppo70!.maxAnnualCost)).toBe(10916);

    expect(hsa60!.outOfPocketCosts).toBeCloseTo(11826, 2);
    expect(Math.round(hsa60!.totalCost)).toBe(8792);
    expect(Math.round(hsa60!.maxAnnualCost)).toBe(12166);

    expect(Math.round(hsa80!.totalCost)).toBe(6435);
    expect(Math.round(hsa80!.maxAnnualCost)).toBe(8607);

    // PPO 90 care costs $2,395, so $1,005 of the $3,400 FSA goes unspent and is lost
    expect(ppo90!.fsaForfeited).toBeCloseTo(1005, 2);
    expect(Math.round(ppo90!.totalCost)).toBe(9634 + 1005);
    expect(Math.round(ppo90!.maxAnnualCost)).toBe(14239);
  });
});
