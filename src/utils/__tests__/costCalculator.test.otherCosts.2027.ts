import { calculateAllPlans } from '../costCalculator';
import { generateChartData } from '../chartDataGenerator';
import { loadPlanData } from '../../services/planDataService';
import { CategoryEstimate, CoverageType, PlanResult, UserInputs } from '../../types';

const planData = loadPlanData('dmba', 2027);

const inputsWith = (
  categoryEstimates: CategoryEstimate[],
  overrides: Partial<UserInputs> = {}
): UserInputs => ({
  year: 2027,
  coverage: CoverageType.Family,
  ageGroup: 'under_55',
  taxRate: 22,
  hsaContribution: 0,
  fsaContribution: 0,
  peopleNames: [],
  costs: { categoryEstimates },
  ...overrides,
});

const row = (
  categoryId: string,
  quantity: number,
  costPerVisit: number,
  person?: number
): CategoryEstimate => ({
  categoryId,
  estimate: { quantity, costPerVisit, isInNetwork: true },
  notes: '',
  ...(person ? { person } : {}),
});

const byName = (results: PlanResult[]) =>
  Object.fromEntries(results.map(result => [result.planName, result]));

describe('costs insurance does not cover', () => {
  const office = row('office_visit_specialist', 4, 300);

  it('adds the same full price to every plan and leaves the deductible alone', () => {
    const without = byName(calculateAllPlans(planData, inputsWith([office])));
    const withOther = byName(
      calculateAllPlans(planData, inputsWith([office, row('other_hsa_fsa_ineligible', 1, 500)]))
    );
    for (const name of Object.keys(without)) {
      expect(withOther[name].uncoveredCosts).toBe(500);
      expect(withOther[name].outOfPocketCosts).toBeCloseTo(without[name].outOfPocketCosts, 6);
      expect(withOther[name].totalCost).toBeCloseTo(without[name].totalCost + 500, 6);
      expect(withOther[name].maxAnnualCost).toBeCloseTo(without[name].maxAnnualCost + 500, 6);
    }
  });

  it('counts eligible costs as FSA spending, so they earn tax savings', () => {
    const fsa = { fsaContribution: 3000 };
    const eligible = byName(
      calculateAllPlans(planData, inputsWith([row('other_hsa_fsa_eligible', 1, 400)], fsa))
    );
    const ineligible = byName(
      calculateAllPlans(planData, inputsWith([row('other_hsa_fsa_ineligible', 1, 400)], fsa))
    );
    const ppo = planData.plans.find(plan => plan.name.includes('PPO'))!.name;
    expect(eligible[ppo].taxSavedOn).toBe(400);
    expect(ineligible[ppo].taxSavedOn).toBe(0);
  });

  it('raises every chart line by the same amount and stays off the bottom axis', () => {
    const plain = generateChartData(planData, inputsWith([office]));
    const other = generateChartData(
      planData,
      inputsWith([office, row('other_hsa_fsa_ineligible', 1, 500)])
    );
    expect(other.userSpending).toBe(plain.userSpending);
    plain.plans.forEach((line, i) =>
      expect(other.plans[i].data[0].totalCost).toBeCloseTo(line.data[0].totalCost + 500, 6)
    );
  });
});

describe('visit limits that more visits can be approved past', () => {
  it('charges physical therapy past 25 visits at normal plan rates', () => {
    const results = calculateAllPlans(
      planData,
      inputsWith([row('physical_therapy_outpatient', 40, 200)])
    );
    for (const result of results) {
      const over = result.ledger.expenses.filter(entry =>
        entry.categoryDisplayName.includes('[Over visit limit]')
      );
      expect(over).toHaveLength(0);
    }
  });
});

describe('people', () => {
  it('applies a visit limit to each person separately', () => {
    // Acupuncture is limited to 12 visits a year per person
    const split = byName(
      calculateAllPlans(
        planData,
        inputsWith([row('acupuncture', 8, 100, 1), row('acupuncture', 8, 100, 2)])
      )
    );
    const onePerson = byName(
      calculateAllPlans(planData, inputsWith([row('acupuncture', 16, 100, 1)]))
    );
    for (const name of Object.keys(split)) {
      const overFor = (result: PlanResult) =>
        result.ledger.expenses.filter(e => e.categoryDisplayName.includes('[Over visit limit]'));
      expect(overFor(split[name])).toHaveLength(0);
      expect(overFor(onePerson[name])).toHaveLength(4);
    }
  });

  it("stops one person's costs at their own out-of-pocket max", () => {
    const surgery = (person?: number) => [row('surgery', 1, 200_000, person)];
    const assigned = calculateAllPlans(planData, inputsWith(surgery(1)));
    const shared = byName(calculateAllPlans(planData, inputsWith(surgery())));
    for (const result of assigned) {
      const plan = planData.plans.find(p => p.name === result.planName)!;
      expect(result.outOfPocketCosts).toBeCloseTo(
        plan.out_of_pocket_maximum.in_network.individual,
        6
      );
      expect(shared[result.planName].outOfPocketCosts).toBeCloseTo(
        plan.out_of_pocket_maximum.in_network.family,
        6
      );
    }
  });

  it('ignores the person with single coverage', () => {
    const single = { coverage: CoverageType.Single };
    const withPerson = calculateAllPlans(
      planData,
      inputsWith([row('surgery', 1, 200_000, 1)], single)
    );
    const without = calculateAllPlans(planData, inputsWith([row('surgery', 1, 200_000)], single));
    expect(withPerson.map(r => r.totalCost)).toEqual(without.map(r => r.totalCost));
  });

  it("flattens the chart line where one person's care meets their own max", () => {
    const chart = generateChartData(planData, inputsWith([row('surgery', 1, 200_000, 1)]));
    const results = byName(
      calculateAllPlans(planData, inputsWith([row('surgery', 1, 200_000, 1)]))
    );
    for (const line of chart.plans) {
      const atUser = line.data.find(point => point.spending === chart.userSpending)!;
      expect(atUser.totalCost).toBeCloseTo(results[line.planName].totalCost, 2);
    }
  });
});
