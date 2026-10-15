import { parseEstimatesCsv } from '../estimateCsv';
import { CategoriesData } from '../../types';

const categories: CategoriesData = {
  office_visit_pcp: { name: 'Primary Care Office Visit' },
  urgent_care: { name: 'Urgent Care' },
  wellness_exam: { name: 'Wellness Exam', preventive: true },
};

describe('parseEstimatesCsv', () => {
  it('reads rows by category id, skipping the header', () => {
    const { estimates, errors } = parseEstimatesCsv(
      'category,network,visits,cost_per_visit,notes\noffice_visit_pcp,in,4,180,Sick visits\n',
      categories
    );
    expect(errors).toEqual([]);
    expect(estimates).toEqual([
      {
        categoryId: 'office_visit_pcp',
        estimate: { quantity: 4, costPerVisit: 180, isInNetwork: true },
        notes: 'Sick visits',
      },
    ]);
  });

  it('matches categories by display name and reads out-of-network rows', () => {
    const { estimates } = parseEstimatesCsv('Urgent Care,out-of-network,2,$95,', categories);
    expect(estimates[0].categoryId).toBe('urgent_care');
    expect(estimates[0].estimate.isInNetwork).toBe(false);
    expect(estimates[0].estimate.costPerVisit).toBe(95);
  });

  it('rounds an averaged visit count to whole visits', () => {
    const { estimates, errors } = parseEstimatesCsv(
      'urgent_care,in,1.5,100,\nurgent_care,in,2.4,100,\nurgent_care,in,0.3,100,',
      categories
    );
    expect(errors).toEqual([]);
    expect(estimates.map(e => e.estimate.quantity)).toEqual([2, 2, 0]);
  });

  it('keeps commas and quotes inside quoted notes', () => {
    const { estimates } = parseEstimatesCsv(
      'urgent_care,in,2,"1,250","Twice, ""maybe"" three times"',
      categories
    );
    expect(estimates[0].estimate.costPerVisit).toBe(1250);
    expect(estimates[0].notes).toBe('Twice, "maybe" three times');
  });

  it('strips a markdown code fence and text around it', () => {
    const { estimates, errors } = parseEstimatesCsv(
      'Here is your file:\n```csv\ncategory,network,visits,cost_per_visit,notes\nwellness_exam,in,1,0,\n```\nLet me know!',
      categories
    );
    expect(errors).toEqual([]);
    expect(estimates).toHaveLength(1);
  });

  it('reports bad rows by line and keeps the good ones', () => {
    const { estimates, errors } = parseEstimatesCsv(
      [
        'category,network,visits,cost_per_visit,notes',
        'dentist,in,1,100,',
        'urgent_care,sideways,1,100,',
        'urgent_care,in,several,100,',
        'urgent_care,in,1,lots,',
        'office_visit_pcp,,3,150,',
      ].join('\r\n'),
      categories
    );
    expect(errors.map(e => e.line)).toEqual([2, 3, 4, 5]);
    expect(errors[0].message).toContain('dentist');
    expect(estimates).toHaveLength(1);
    expect(estimates[0].estimate.isInNetwork).toBe(true);
  });
});
