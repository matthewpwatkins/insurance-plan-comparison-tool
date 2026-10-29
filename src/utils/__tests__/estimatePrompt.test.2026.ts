import { buildEstimatePrompt } from '../estimatePrompt';
import { parseEstimatesCsv } from '../estimateCsv';
import { loadPlanData } from '../../services/planDataService';
import { getCompany } from '../../generated/dataHelpers';
import { CoverageType } from '../../types';

describe('buildEstimatePrompt', () => {
  const planData = loadPlanData('dmba', 2026);
  const company = getCompany('dmba')!;
  const prompt = buildEstimatePrompt(company, planData, CoverageType.Family);

  it('lists every category id', () => {
    for (const id of Object.keys(planData.categories)) {
      expect(prompt).toContain(`- ${id} | `);
    }
  });

  it('gives example rows the importer accepts', () => {
    const examples = prompt.split('Example rows:\n')[1].split('\n\n')[0];
    const { estimates, errors } = parseEstimatesCsv(examples, planData.categories);
    expect(errors).toEqual([]);
    expect(estimates).toHaveLength(2);
  });

  it('names the year and coverage', () => {
    expect(prompt).toContain('for 2026');
    expect(prompt).toContain('my family');
  });

  it("suggests the plan year's expected price increase", () => {
    expect(prompt).toContain(`suggest ${planData.healthcare_price_increase}%`);
    expect(planData.healthcare_price_increase).toBe(3.5);
  });

  it('says which coverage is being compared', () => {
    expect(buildEstimatePrompt(company, planData, CoverageType.Single)).toContain('just myself');
    expect(buildEstimatePrompt(company, planData, CoverageType.TwoParty)).toContain(
      'myself and one other person'
    );
  });

  it('asks for exactly the columns the importer reads', () => {
    expect(prompt).toContain('\ncategory,network,visits,cost_per_visit,notes,person\n');
  });
});
