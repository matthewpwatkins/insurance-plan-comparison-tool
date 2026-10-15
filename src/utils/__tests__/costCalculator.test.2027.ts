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
    // With no care, the whole FSA is unspent and lost
    expect(ppo80.fsaForfeited).toBe(3500);
    expect(ppo80.totalCost).toBeCloseTo(ppo80.netAnnualPremiums - ppo80.taxSavings + 3500, 2);
  });
});

describe('2027 timing of care through the year', () => {
  const visits = [
    {
      categoryId: 'office_visit_pcp',
      estimate: { quantity: 6, costPerVisit: 120, isInNetwork: true },
    },
    {
      categoryId: 'pharmacy_tier_1_retail_30',
      estimate: { quantity: 12, costPerVisit: 20, isInNetwork: true },
    },
  ];
  const ppo80 = (categoryEstimates: typeof visits) =>
    byName(calculateAllPlans(planData, inputs({ costs: { categoryEstimates } })), 'DMBA PPO 80')
      .outOfPocketCosts;

  it('gives the same cost whichever order the estimates are listed in', () => {
    expect(ppo80(visits)).toBe(ppo80([...visits].reverse()));
  });

  it('spreads visits through the year, between all-visits-first and all-fills-first', () => {
    // All visits first: 4 x $120 + ($20 + $25) + $25 + 12 fills x $10 = $670.
    // All fills first: $120 of fills, 3 x $120 + ($20 + $25) + 2 x $25 = $575.
    // Spread through the year, some fills land before the deductible is met.
    const cost = ppo80(visits);
    expect(cost).toBeGreaterThan(575);
    expect(cost).toBeLessThan(670);
  });
});

describe('2027 unspent FSA money', () => {
  const ppo80 = (fsaContribution: number, pcpVisits: number) =>
    byName(
      calculateAllPlans(
        planData,
        inputs({
          fsaContribution,
          costs: {
            categoryEstimates: [
              {
                categoryId: 'office_visit_pcp',
                estimate: { quantity: pcpVisits, costPerVisit: 100, isInNetwork: true },
              },
            ],
          },
        })
      ),
      'DMBA PPO 80'
    );

  it('loses FSA money not spent on care', () => {
    // 3 x $100 visits, all under the deductible, leave $1,700 of $2,000 unspent
    const result = ppo80(2000, 3);
    expect(result.outOfPocketCosts).toBe(300);
    expect(result.fsaForfeited).toBe(1700);
    expect(result.totalCost).toBeCloseTo(
      result.netAnnualPremiums + 300 + 1700 - 2000 * SAVINGS_RATE,
      2
    );
    expect(result.ledger.contributionsAndSavings).toContainEqual(
      expect.objectContaining({ type: 'forfeit', amount: -1700 })
    );
  });

  it('loses nothing when care uses up the FSA', () => {
    expect(ppo80(300, 3).fsaForfeited).toBe(0);
  });

  it('never loses HSA money', () => {
    const results = calculateAllPlans(planData, inputs({ hsaContribution: 3000 }));
    expect(byName(results, 'DMBA HSA 60').fsaForfeited).toBe(0);
  });
});

describe('2027 copays never cost more than the bill', () => {
  it('charges a $6 drug, not the $10 copay, on PPO 80', () => {
    const result = byName(
      calculateAllPlans(
        planData,
        inputs({
          costs: {
            categoryEstimates: [
              {
                categoryId: 'pharmacy_tier_1_retail_30',
                estimate: { quantity: 1, costPerVisit: 6, isInNetwork: true },
              },
            ],
          },
        })
      ),
      'DMBA PPO 80'
    );
    expect(result.outOfPocketCosts).toBe(6);
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
    // 50 fills x $10 copay = $500, which meets the deductible
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
            ],
          },
        })
      ),
      'DMBA PPO 80'
    );
    expect(result.outOfPocketCosts).toBe(500);
    const fills = result.ledger.inNetworkExpenses;
    expect(fills[fills.length - 1].deductibleRemaining).toBe(0);
  });
});

describe('2027 default year', () => {
  it('defaults to 2027, the newest year', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getDefaultYear } = require('../../services/planDataService');
    expect(getDefaultYear('dmba')).toBe(2027);
  });
});
