import { calculateAllPlans } from '../costCalculator';
import { loadPlanData } from '../../services/planDataService';
import { CategoryEstimate, CoverageType, UserInputs } from '../../types';

const inputsWith = (categoryEstimates: CategoryEstimate[]): UserInputs => ({
  year: 2026,
  coverage: CoverageType.Family,
  ageGroup: 'under_55',
  taxRate: 22,
  hsaContribution: 0,
  fsaContribution: 0,
  costs: { categoryEstimates },
});

const acupuncture = (quantity: number, notes: string): CategoryEstimate => ({
  categoryId: 'acupuncture',
  estimate: { quantity, costPerVisit: 100, isInNetwork: true },
  notes,
});

describe('visit limits', () => {
  it('count visits across every row of the same category', () => {
    // Acupuncture is limited to 12 visits a year, so 16 visits cost the same whether
    // they're entered as one row or split between two people.
    const planData = loadPlanData('dmba', 2026);
    const oneRow = calculateAllPlans(planData, inputsWith([acupuncture(16, 'Family')]));
    const twoRows = calculateAllPlans(
      planData,
      inputsWith([acupuncture(8, 'Parent'), acupuncture(8, 'Child')])
    );
    for (const result of oneRow) {
      const split = twoRows.find(r => r.planName === result.planName);
      expect(split?.totalCost).toBeCloseTo(result.totalCost, 2);
    }
  });

  it('charges a fractional visit count as the nearest whole number of visits', () => {
    const planData = loadPlanData('dmba', 2026);
    const cost = (quantity: number) =>
      calculateAllPlans(planData, inputsWith([acupuncture(quantity, '')])).map(r => [
        r.planName,
        r.totalCost,
      ]);
    expect(cost(1.4)).toEqual(cost(1));
    expect(cost(1.5)).toEqual(cost(2));
  });
});
