import { calculateAllPlans } from '../costCalculator';
import {
  getMaxFSAContribution,
  getMaxHSAContribution,
  isHSAQualified,
  loadPlanData,
} from '../../services/planDataService';
import { ContributionType, CoverageType, PlanResult, UserInputs } from '../../types';

const planData = loadPlanData('dmba', 2027);

const inputs = (overrides: Partial<UserInputs> = {}): UserInputs => ({
  year: 2027,
  coverage: CoverageType.Single,
  ageGroup: 'under_55',
  taxRate: 22,
  hsaContribution: 0,
  fsaContribution: 0,
  costs: { categoryEstimates: [] },
  ...overrides,
});

const byName = (results: PlanResult[], name: string): PlanResult => {
  const result = results.find(r => r.planName === name);
  if (!result) throw new Error(`No result for ${name}`);
  return result;
};

// Income tax plus Social Security and Medicare
const SAVINGS_RATE = 0.22 + 0.062 + 0.0145;

describe('2027 DMBA data', () => {
  it('offers PPO 80, HSA 80, and HSA 60', () => {
    expect(planData.plans.map(p => p.name).sort()).toEqual([
      'DMBA HSA 60',
      'DMBA HSA 80',
      'DMBA PPO 80',
    ]);
  });

  it('uses the 2027 IRS HSA and FSA limits', () => {
    expect(getMaxHSAContribution(planData, CoverageType.Single, 'under_55')).toBe(4500);
    expect(getMaxHSAContribution(planData, CoverageType.Family, 'under_55')).toBe(9000);
    expect(getMaxHSAContribution(planData, CoverageType.Family, '55_plus')).toBe(10000);
    expect(getMaxFSAContribution(planData)).toBe(3500);
  });

  it.each([CoverageType.Single, CoverageType.TwoParty, CoverageType.Family])(
    'treats only the HSA plans as HSA-qualified for %s coverage',
    coverage => {
      for (const plan of planData.plans) {
        expect(isHSAQualified(plan, planData, coverage)).toBe(plan.name.includes('HSA'));
      }
    }
  );

  it('keeps each HSA plan within the IRS out-of-pocket limit', () => {
    const { maximum_out_of_pocket } = planData.hsa_qualification_limits;
    for (const plan of planData.plans.filter(p => p.name.includes('HSA'))) {
      const oop = plan.out_of_pocket_maximum.in_network;
      expect(oop.individual).toBeLessThanOrEqual(maximum_out_of_pocket.single);
      expect(oop.family).toBeLessThanOrEqual(maximum_out_of_pocket.family);
    }
  });

  it.each([CoverageType.Single, CoverageType.TwoParty, CoverageType.Family])(
    'with no usage, %s total cost is net premiums less employer HSA money',
    coverage => {
      const results = calculateAllPlans(planData, inputs({ coverage }));

      for (const result of results) {
        const plan = planData.plans.find(p => p.name === result.planName)!;
        const grossPremiums = plan.monthly_premiums[coverage] * 12;
        const employer = plan.employer_hsa_contribution?.[coverage] ?? 0;

        expect(result.outOfPocketCosts).toBe(0);
        expect(result.annualPremiums).toBeCloseTo(grossPremiums, 2);
        expect(result.netAnnualPremiums).toBeCloseTo(grossPremiums * (1 - SAVINGS_RATE), 2);
        expect(result.employerContribution).toBe(employer);
        expect(result.taxSavings).toBe(0);
        expect(result.totalCost).toBeCloseTo(result.netAnnualPremiums - employer, 2);
      }
    }
  );

  it('subtracts contribution tax savings from the total', () => {
    const results = calculateAllPlans(
      planData,
      inputs({ coverage: CoverageType.Family, hsaContribution: 20000, fsaContribution: 20000 })
    );

    // $9,000 family HSA limit less the employer's share; $3,500 FSA limit
    const hsa60 = byName(results, 'DMBA HSA 60');
    expect(hsa60.contributionType).toBe(ContributionType.HSA);
    expect(hsa60.userContribution).toBe(9000 - 1250);
    expect(hsa60.taxSavings).toBeCloseTo((9000 - 1250) * SAVINGS_RATE, 2);
    expect(hsa60.totalCost).toBeCloseTo(hsa60.netAnnualPremiums - hsa60.taxSavings - 1250, 2);

    const ppo80 = byName(results, 'DMBA PPO 80');
    expect(ppo80.contributionType).toBe(ContributionType.FSA);
    expect(ppo80.userContribution).toBe(3500);
    expect(ppo80.totalCost).toBeCloseTo(ppo80.netAnnualPremiums - ppo80.taxSavings, 2);
  });
});

describe('2027 PPO 80 copays and the deductible', () => {
  const ppo80OutOfPocket = (categoryId: string, quantity: number, costPerVisit: number) =>
    byName(
      calculateAllPlans(
        planData,
        inputs({
          costs: {
            categoryEstimates: [
              { categoryId, estimate: { quantity, costPerVisit, isInNetwork: true } },
            ],
          },
        })
      ),
      'DMBA PPO 80'
    ).outOfPocketCosts;

  it('bills office visits in full until the $500 deductible is met, then the copay', () => {
    // $400 + $100 to finish the deductible, then $25 copay on the rest of visit 2 and on visit 3
    expect(ppo80OutOfPocket('office_visit_pcp', 3, 400)).toBe(400 + 100 + 25 + 25);
  });

  it('charges the ER copay only after the deductible', () => {
    expect(ppo80OutOfPocket('emergency_room', 1, 2000)).toBe(500 + 200);
  });

  it('charges tier 1 drug copays right away and counts them toward the deductible', () => {
    // 50 fills x $10 = $500 meets the deductible; the PCP visit then costs just its copay
    const result = byName(
      calculateAllPlans(
        planData,
        inputs({
          costs: {
            categoryEstimates: [
              {
                categoryId: 'pharmacy_tier_1_retail_30',
                estimate: { quantity: 50, costPerVisit: 40, isInNetwork: true },
              },
              {
                categoryId: 'office_visit_pcp',
                estimate: { quantity: 1, costPerVisit: 200, isInNetwork: true },
              },
            ],
          },
        })
      ),
      'DMBA PPO 80'
    );
    expect(result.outOfPocketCosts).toBe(500 + 25);
  });
});

describe('2027 default year', () => {
  it('defaults to 2027, the newest year', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getDefaultYear } = require('../../services/planDataService');
    expect(getDefaultYear('dmba')).toBe(2027);
  });
});
