import { calculateAllPlans } from '../costCalculator';
import { loadPlanData } from '../../services/planDataService';
import { ContributionType, CoverageType, PlanResult, UserInputs } from '../../types';

const planData = loadPlanData('dmba', 2026);

const inputs = (overrides: Partial<UserInputs> = {}): UserInputs => ({
  year: 2026,
  coverage: CoverageType.Family,
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

describe('HSA and FSA contributions with 2026 DMBA data', () => {
  it.each([CoverageType.Single, CoverageType.TwoParty, CoverageType.Family])(
    'treats the HSA plans as HSA and the PPOs as FSA for %s coverage',
    coverage => {
      const results = calculateAllPlans(planData, inputs({ coverage }));

      for (const result of results) {
        const expected = result.planName.includes('HSA')
          ? ContributionType.HSA
          : ContributionType.FSA;
        expect(result.contributionType).toBe(expected);
      }
    }
  );

  it('caps each HSA plan at the family limit less its employer contribution', () => {
    const results = calculateAllPlans(planData, inputs({ hsaContribution: 7050 }));

    // $8,750 family limit: HSA 60 adds $3,050, HSA 80 adds $1,700
    const hsa60 = byName(results, 'DMBA HSA 60');
    expect(hsa60.employerContribution).toBe(3050);
    expect(hsa60.userContribution).toBe(5700);
    expect(hsa60.taxSavings).toBeCloseTo(5700 * SAVINGS_RATE, 2);

    const hsa80 = byName(results, 'DMBA HSA 80');
    expect(hsa80.employerContribution).toBe(1700);
    expect(hsa80.userContribution).toBe(7050);
  });

  it('adds the catch-up amount at 55 and over', () => {
    const results = calculateAllPlans(
      planData,
      inputs({ hsaContribution: 20000, ageGroup: '55_plus' })
    );

    expect(byName(results, 'DMBA HSA 60').userContribution).toBe(8750 + 1000 - 3050);
  });

  it('two-party coverage uses the family limit', () => {
    const results = calculateAllPlans(
      planData,
      inputs({ hsaContribution: 20000, coverage: CoverageType.TwoParty })
    );

    expect(byName(results, 'DMBA HSA 60').userContribution).toBe(8750 - 3050);
  });

  it('caps the FSA at the yearly limit and ignores the HSA amount on PPOs', () => {
    const results = calculateAllPlans(
      planData,
      inputs({ hsaContribution: 5000, fsaContribution: 10000 })
    );

    const ppo = byName(results, 'DMBA PPO 70');
    expect(ppo.userContribution).toBe(3400);
    expect(ppo.employerContribution).toBe(0);
    expect(ppo.taxSavings).toBeCloseTo(3400 * SAVINGS_RATE, 2);
  });

  it('adds every part into the total and sorts cheapest first', () => {
    const results = calculateAllPlans(
      planData,
      inputs({
        hsaContribution: 4000,
        fsaContribution: 2000,
        costs: {
          categoryEstimates: [
            {
              categoryId: 'office_visit_specialist',
              estimate: { quantity: 6, costPerVisit: 250, isInNetwork: true },
            },
          ],
        },
      })
    );

    for (const r of results) {
      expect(r.netAnnualPremiums).toBeCloseTo(r.annualPremiums * (1 - SAVINGS_RATE), 2);
      expect(r.totalCost).toBeCloseTo(
        r.netAnnualPremiums +
          r.outOfPocketCosts +
          r.fsaForfeited -
          r.taxSavings -
          r.employerContribution,
        2
      );
    }
    const totals = results.map(r => r.totalCost);
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
  });
});
