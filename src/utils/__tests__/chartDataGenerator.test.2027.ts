import {
  generateChartData,
  calculateUserSpending,
  breakEvenSpending,
  rateAfterDeductible,
  ChartDataResult,
} from '../chartDataGenerator';
import { calculateAllPlans } from '../costCalculator';
import { loadPlanData } from '../../services/planDataService';
import { UserInputs, CoverageType, CategoryEstimate, PlanData } from '../../types';

const planData = loadPlanData('dmba', 2027);

const familyInputs = (categoryEstimates: CategoryEstimate[]): UserInputs => ({
  year: 2027,
  coverage: CoverageType.Family,
  ageGroup: 'under_55',
  taxRate: 22,
  hsaContribution: 0,
  fsaContribution: 0,
  costs: { categoryEstimates },
});

const visits = (categoryId: string, quantity: number, costPerVisit: number): CategoryEstimate => ({
  categoryId,
  estimate: { quantity, costPerVisit, isInNetwork: true },
  notes: '',
});

// Total cost at a spending level, interpolating between chart points
const costAt = (chart: ChartDataResult, planName: string, spending: number): number => {
  const data = chart.plans.find(p => p.planName === planName)!.data;
  const upper = data.findIndex(point => point.spending >= spending);
  if (data[upper].spending === spending) {
    return data[upper].totalCost;
  }
  const a = data[upper - 1];
  const b = data[upper];
  return (
    a.totalCost +
    ((b.totalCost - a.totalCost) * (spending - a.spending)) / (b.spending - a.spending)
  );
};

const slope = (chart: ChartDataResult, planName: string, from: number, to: number): number =>
  (costAt(chart, planName, to) - costAt(chart, planName, from)) / (to - from);

// Family deductible, default in-network coinsurance, and billed spending where the OOP max is reached
const plans = [
  { name: 'DMBA HSA 60', deductible: 8_000, coinsurance: 0.4, flatline: 24_250 },
  { name: 'DMBA HSA 80', deductible: 5_000, coinsurance: 0.2, flatline: 40_000 },
  { name: 'DMBA PPO 80', deductible: 1_000, coinsurance: 0.2, flatline: 46_000 },
];

describe('chart lines 2027 without estimates (default coverage)', () => {
  const inputs = familyInputs([]);
  const chart = generateChartData(planData, inputs);
  const results = calculateAllPlans(planData, inputs);

  it.each(plans)('$name pays 100% before the deductible', ({ name, deductible }) => {
    expect(slope(chart, name, 0, deductible)).toBeCloseTo(1, 6);
  });

  it.each(plans)('$name pays default coinsurance up to the OOP max', plan => {
    expect(slope(chart, plan.name, plan.deductible, plan.flatline)).toBeCloseTo(
      plan.coinsurance,
      6
    );
  });

  it.each(plans)('$name bends exactly at its deductible and flat point', plan => {
    const data = chart.plans.find(p => p.planName === plan.name)!.data;
    expect(data.some(point => point.spending === plan.deductible)).toBe(true);
    expect(data.some(point => point.spending === plan.flatline)).toBe(true);
  });

  it.each(plans)('$name is flat at the worst case past the OOP max', ({ name, flatline }) => {
    const result = results.find(r => r.planName === name)!;
    expect(costAt(chart, name, flatline)).toBeCloseTo(result.maxAnnualCost, 6);
    expect(slope(chart, name, flatline, chart.maxSpending)).toBeCloseTo(0, 6);
    expect(costAt(chart, name, flatline - 100)).toBeLessThan(result.maxAnnualCost);
  });

  it.each(plans)('$name starts at the base cost the results use', ({ name }) => {
    const result = results.find(r => r.planName === name)!;
    const baseCost = result.netAnnualPremiums - result.taxSavings - result.employerContribution;
    expect(costAt(chart, name, 0)).toBeCloseTo(baseCost, 6);
  });

  it('runs the x-axis a margin past the last plan to flatten', () => {
    expect(chart.maxSpending).toBe(46_000 + 10_000);
  });

  it('has no dots without estimates', () => {
    expect(chart.dots).toEqual([]);
  });

  it('uses the family deductible for two-party coverage', () => {
    const twoParty = generateChartData(planData, { ...inputs, coverage: CoverageType.TwoParty });
    expect(slope(twoParty, 'DMBA HSA 80', 0, 5_000)).toBeCloseTo(1, 6);
    expect(slope(twoParty, 'DMBA HSA 80', 5_000, 40_000)).toBeCloseTo(0.2, 6);
  });
});

describe('chart x position 2027 (spending not free on every plan)', () => {
  const spending = (estimates: CategoryEstimate[], data: PlanData = planData) =>
    calculateUserSpending(data, familyInputs(estimates));

  it('leaves out care free on every plan', () => {
    expect(spending([visits('wellness_exam', 3, 300)])).toBe(0);
    expect(spending([visits('mammograms', 1, 400)])).toBe(0);
  });

  it('counts free visits past the yearly limit at full cost', () => {
    expect(spending([visits('mammograms', 2, 400)])).toBe(400);
    // The limit spans rows, so a second row for the same category is over it
    expect(spending([visits('mammograms', 1, 400), visits('mammograms', 1, 400)])).toBe(400);
  });

  it('counts care free on only some plans', () => {
    const someFree: PlanData = {
      ...planData,
      plans: planData.plans.map((plan, i) =>
        i === 0 ? { ...plan, categories: { ...plan.categories, wellness_exam: undefined } } : plan
      ),
    };
    expect(spending([visits('wellness_exam', 2, 300)], someFree)).toBe(600);
  });

  it('counts ordinary care in full', () => {
    expect(spending([visits('emergency_room', 1, 5_000), visits('wellness_exam', 1, 300)])).toBe(
      5_000
    );
  });
});

describe('chart dots 2027', () => {
  const inputs: UserInputs = {
    ...familyInputs([
      visits('emergency_room', 1, 5_000),
      visits('chiropractic_therapy', 30, 250),
      visits('pharmacy_tier_1_retail_30', 12, 20),
      visits('wellness_exam', 2, 300),
    ]),
    hsaContribution: 3_000,
    fsaContribution: 2_000,
  };
  const chart = generateChartData(planData, inputs);
  const results = calculateAllPlans(planData, inputs);

  it('places one dot per plan at the real total and non-free spending', () => {
    expect(chart.userSpending).toBe(5_000 + 30 * 250 + 12 * 20);
    expect(chart.dots).toHaveLength(results.length);
    for (const result of results) {
      const dot = chart.dots.find(d => d.planName === result.planName)!;
      expect(dot.spending).toBe(chart.userSpending);
      expect(dot.totalCost).toBe(result.totalCost);
    }
  });

  it('keeps the x-axis at least 1.5 times the user’s spending', () => {
    const big = generateChartData(planData, familyInputs([visits('emergency_room', 1, 80_000)]));
    expect(big.maxSpending).toBe(120_000);
    expect(chart.maxSpending).toBeGreaterThanOrEqual(chart.userSpending * 1.5);
  });
});

describe('chart lines 2027 with copays blended in', () => {
  // 10 PCP visits at $200 (PPO 80: $25 copay) and a $10,000 surgery (coinsurance on every plan)
  const inputs = familyInputs([visits('office_visit_pcp', 10, 200), visits('surgery', 1, 10_000)]);
  const chart = generateChartData(planData, inputs);
  const plan = (name: string) => planData.plans.find(p => p.name === name)!;

  it('replaces coinsurance with the copay on the copay share of PPO 80 bills', () => {
    // (0.2 x $10,000 coinsurance + 10 x $25 copays) / $12,000 billed
    const expected = (0.2 * 10_000 + 10 * 25) / 12_000;
    expect(expected).toBeCloseTo(0.1875, 10);
    expect(rateAfterDeductible(plan('DMBA PPO 80'), planData, inputs)).toBeCloseTo(expected, 10);
    expect(slope(chart, 'DMBA PPO 80', 1_000, 40_000)).toBeCloseTo(expected, 6);
  });

  it('still bills 100% before the deductible', () => {
    expect(slope(chart, 'DMBA PPO 80', 0, 1_000)).toBeCloseTo(1, 6);
  });

  it('moves the flat point to where the blended slope reaches the OOP max', () => {
    // $1,000 deductible, then $9,000 more out of pocket at 18.75%
    const flatline = 1_000 + 9_000 / 0.1875;
    const result = calculateAllPlans(planData, inputs).find(r => r.planName === 'DMBA PPO 80')!;
    const data = chart.plans.find(p => p.planName === 'DMBA PPO 80')!.data;
    expect(data.some(point => point.spending === flatline)).toBe(true);
    expect(costAt(chart, 'DMBA PPO 80', flatline)).toBeCloseTo(result.maxAnnualCost, 6);
    expect(slope(chart, 'DMBA PPO 80', flatline, chart.maxSpending)).toBeCloseTo(0, 6);
  });

  it('leaves plans without copays for this care at their coinsurance', () => {
    const noPcpCopay = plans.filter(
      ({ name }) => !plan(name).categories.office_visit_pcp?.in_network_coverage?.copay
    );
    expect(noPcpCopay.length).toBeGreaterThan(0);
    for (const { name, coinsurance } of noPcpCopay) {
      expect(rateAfterDeductible(plan(name), planData, inputs)).toBeCloseTo(coinsurance, 10);
    }
  });

  it('charges a copay of no more than the visit itself', () => {
    const cheap = familyInputs([visits('office_visit_pcp', 10, 20)]);
    expect(rateAfterDeductible(plan('DMBA PPO 80'), planData, cheap)).toBeCloseTo(1, 10);
  });

  it('ignores care free on every plan', () => {
    const withFree = familyInputs([
      visits('office_visit_pcp', 10, 200),
      visits('surgery', 1, 10_000),
      visits('wellness_exam', 2, 300),
    ]);
    expect(rateAfterDeductible(plan('DMBA PPO 80'), planData, withFree)).toBeCloseTo(0.1875, 10);
  });

  it('puts the PPO 80 dot closer to its line for a copay-heavy mix', () => {
    const copayHeavy = familyInputs([
      visits('office_visit_pcp', 40, 200),
      visits('surgery', 1, 1_000),
    ]);
    const blended = generateChartData(planData, copayHeavy);
    const plain = generateChartData(planData, familyInputs([]));
    const x = blended.userSpending;
    const dot = blended.dots.find(d => d.planName === 'DMBA PPO 80')!.totalCost;
    const gapNow = Math.abs(dot - costAt(blended, 'DMBA PPO 80', x));
    const gapBefore = Math.abs(dot - costAt(plain, 'DMBA PPO 80', x));
    expect(gapNow).toBeLessThan(gapBefore);
  });
});

describe('breakEvenSpending 2027', () => {
  it('is where the plan’s line crosses $0', () => {
    // A large HSA deposit makes HSA 60's base cost negative
    const inputs: UserInputs = { ...familyInputs([]), hsaContribution: 7_000, taxRate: 32 };
    const result = calculateAllPlans(planData, inputs).find(r => r.planName === 'DMBA HSA 60')!;
    const baseCost = result.netAnnualPremiums - result.taxSavings - result.employerContribution;
    expect(baseCost).toBeLessThan(0);

    const breakEven = breakEvenSpending(planData, inputs, result)!;
    // Before the deductible every dollar of care is the user's, so break-even is -baseCost
    expect(breakEven).toBeCloseTo(-baseCost, 1);
    const chart = generateChartData(planData, inputs);
    expect(costAt(chart, 'DMBA HSA 60', breakEven - 5)).toBeLessThan(0);
    expect(costAt(chart, 'DMBA HSA 60', breakEven + 5)).toBeGreaterThan(0);
  });

  it('ignores estimates without copays, which leave the line unchanged', () => {
    const plain: UserInputs = { ...familyInputs([]), hsaContribution: 7_000, taxRate: 32 };
    const withCare: UserInputs = {
      ...plain,
      costs: { categoryEstimates: [visits('chiropractic_therapy', 20, 100)] },
    };
    const result = calculateAllPlans(planData, withCare).find(r => r.planName === 'DMBA HSA 60')!;
    expect(breakEvenSpending(planData, withCare, result)).toBe(
      breakEvenSpending(planData, plain, result)
    );
  });

  it('is null when the plan never pays you', () => {
    const inputs = familyInputs([]);
    const result = calculateAllPlans(planData, inputs).find(r => r.planName === 'DMBA PPO 80')!;
    expect(breakEvenSpending(planData, inputs, result)).toBeNull();
  });
});
