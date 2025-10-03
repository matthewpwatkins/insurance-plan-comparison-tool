import { calculateAllPlans } from '../costCalculator';
import { loadPlanData } from '../../services/planDataService';
import { UserInputs, CoverageType } from '../../types';

describe('costCalculator - 2026 Real Data Bug Test', () => {
  it('should calculate correct costs for user input: emergency_room + chiropractic + mental_health + pharmacy', () => {
    // Load actual 2026 plan data
    const planData = loadPlanData(2026);

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

    // Print results for debugging
    console.log('\n=== PLAN COMPARISON RESULTS ===');
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.planName}`);
      console.log(`   Total Cost: $${result.totalCost.toFixed(2)}`);
      console.log(`   Worst Case Cost: $${result.maxAnnualCost.toFixed(2)}`);
      console.log(`   Annual Premiums: $${result.annualPremiums.toFixed(2)}`);
      console.log(`   Net Annual Premiums: $${result.netAnnualPremiums.toFixed(2)}`);
      console.log(`   Premium Discount: $${result.premiumDiscount.toFixed(2)}`);
      console.log(`   Out of Pocket Costs: $${result.outOfPocketCosts.toFixed(2)}`);
      console.log(`   Tax Savings: $${result.taxSavings.toFixed(2)}`);
      console.log(`   Employer Contribution: $${result.employerContribution.toFixed(2)}`);
      console.log('');
    });

    // Expected results from UI table
    // 1. PPO 70: $6,061 total, $10,916 worst case
    // 2. HSA 60: $6,306 total, $12,166 worst case
    // 3. HSA 80: $6,447 total, $8,607 worst case
    // 4. PPO 90: $9,634 total, $14,239 worst case

    // Find each plan's result
    const ppo70 = results.find(r => r.planName === 'DMBA PPO 70');
    const hsa60 = results.find(r => r.planName === 'DMBA HSA 60');
    const hsa80 = results.find(r => r.planName === 'DMBA HSA 80');
    const ppo90 = results.find(r => r.planName === 'DMBA PPO 90');

    expect(ppo70).toBeDefined();
    expect(hsa60).toBeDefined();
    expect(hsa80).toBeDefined();
    expect(ppo90).toBeDefined();

    // Test expectations based on what the UI shows
    console.log('\n=== EXPECTED VS ACTUAL ===');
    console.log('PPO 70:');
    console.log(`  Expected Total: $6,061, Actual: $${ppo70!.totalCost.toFixed(2)}`);
    console.log(`  Expected Worst: $10,916, Actual: $${ppo70!.maxAnnualCost.toFixed(2)}`);

    console.log('HSA 60:');
    console.log(`  Expected Total: $6,306, Actual: $${hsa60!.totalCost.toFixed(2)}`);
    console.log(`  Expected Worst: $12,166, Actual: $${hsa60!.maxAnnualCost.toFixed(2)}`);

    console.log('HSA 80:');
    console.log(`  Expected Total: $6,447, Actual: $${hsa80!.totalCost.toFixed(2)}`);
    console.log(`  Expected Worst: $8,607, Actual: $${hsa80!.maxAnnualCost.toFixed(2)}`);

    console.log('PPO 90:');
    console.log(`  Expected Total: $9,634, Actual: $${ppo90!.totalCost.toFixed(2)}`);
    console.log(`  Expected Worst: $14,239, Actual: $${ppo90!.maxAnnualCost.toFixed(2)}`);

    // These assertions should match the UI table values
    expect(Math.round(ppo70!.totalCost)).toBe(6061);
    expect(Math.round(ppo70!.maxAnnualCost)).toBe(10916);

    expect(Math.round(hsa60!.totalCost)).toBe(6306);
    expect(Math.round(hsa60!.maxAnnualCost)).toBe(12166);

    expect(Math.round(hsa80!.totalCost)).toBe(6447);
    expect(Math.round(hsa80!.maxAnnualCost)).toBe(8607);

    expect(Math.round(ppo90!.totalCost)).toBe(9634);
    expect(Math.round(ppo90!.maxAnnualCost)).toBe(14239);
  });
});
