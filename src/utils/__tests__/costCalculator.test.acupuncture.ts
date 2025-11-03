import { calculateAllPlans } from '../costCalculator';
import { loadPlanData } from '../../services/planDataService';
import { UserInputs, CoverageType } from '../../types';

describe('costCalculator - Acupuncture Test', () => {
  it('should calculate $200 out-of-pocket for single in-network acupuncture visit at $200 on HSA 60', () => {
    // Load actual 2026 plan data
    const planData = loadPlanData(2026);

    // User inputs: single acupuncture visit at $200
    const userInputs: UserInputs = {
      year: 2026,
      coverage: CoverageType.Single,
      ageGroup: 'under_55',
      taxRate: 22,
      hsaContribution: 0,
      fsaContribution: 0,
      costs: {
        categoryEstimates: [
          {
            categoryId: 'acupuncture',
            estimate: {
              quantity: 1,
              costPerVisit: 200,
              isInNetwork: true,
            },
            notes: '',
          },
        ],
      },
    };

    // Calculate all plans
    console.log('\n=== Plan Data Check ===');
    const hsa60Plan = planData.plans.find(p => p.name === 'DMBA HSA 60');
    console.log('HSA 60 Plan found:', !!hsa60Plan);
    if (hsa60Plan) {
      console.log(
        'Acupuncture category in plan:',
        JSON.stringify(hsa60Plan.categories.acupuncture, null, 2)
      );
      console.log(
        'Default in_network_coverage:',
        JSON.stringify(hsa60Plan.default.in_network_coverage, null, 2)
      );
    }

    const results = calculateAllPlans(planData, userInputs);

    // Find HSA 60 plan
    const hsa60 = results.find(r => r.planName === 'DMBA HSA 60');

    expect(hsa60).toBeDefined();

    // Print results for debugging
    console.log('\n=== HSA 60 Acupuncture Test Results ===');
    console.log(`Plan Name: ${hsa60!.planName}`);
    console.log(`Out of Pocket Costs: $${hsa60!.outOfPocketCosts.toFixed(2)}`);
    console.log(`Total Cost: $${hsa60!.totalCost.toFixed(2)}`);
    console.log(`Annual Premiums: $${hsa60!.annualPremiums.toFixed(2)}`);
    console.log(`Net Annual Premiums: $${hsa60!.netAnnualPremiums.toFixed(2)}`);
    console.log(`Tax Savings: $${hsa60!.taxSavings.toFixed(2)}`);
    console.log(`Employer Contribution: $${hsa60!.employerContribution.toFixed(2)}`);

    // Print ledger details for diagnosis
    console.log('\n=== Ledger Details ===');
    console.log('In-Network Expenses:');
    hsa60!.ledger.inNetworkExpenses.forEach((expense, idx) => {
      console.log(`  ${idx + 1}. ${expense.categoryDisplayName}`);
      console.log(`     Billed: $${expense.billedAmount.toFixed(2)}`);
      console.log(`     Employee Responsibility: $${expense.employeeResponsibility.toFixed(2)}`);
      console.log(`     Insurance Responsibility: $${expense.insuranceResponsibility.toFixed(2)}`);
      console.log(`     Deductible Remaining: $${expense.deductibleRemaining.toFixed(2)}`);
      console.log(`     OOP Remaining: $${expense.outOfPocketRemaining.toFixed(2)}`);
    });

    // Test expectation: out-of-pocket costs should be $200
    expect(hsa60!.outOfPocketCosts).toBe(200);
  });
});
