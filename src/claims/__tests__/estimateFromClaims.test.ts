import {
  describeExpense,
  estimatesFromCarryOvers,
  groupPastExpenses,
  limitToRecent,
  prepareClaims,
  suggestCarryOver,
  yearsCovered,
} from '../estimateFromClaims';
import { ClaimCharge } from '../types';
import { ClaimsReport } from '../../types';

const report: ClaimsReport = {
  format: 'dmba-eob',
  service_map: {
    'OFFICE VISIT': ['office_visit_pcp', 'office_visit_specialist'],
    SURGERY: ['surgery'],
    'PRESCRIPTION DRUGS': ['pharmacy_tier_1_retail_30'],
  },
  preventive_map: { 'OFFICE VISIT': ['wellness_exam'] },
  add_to_main_service: ['MEDICAL SUPPLIES', 'PRESCRIPTION DRUGS'],
};

const charge = (overrides: Partial<ClaimCharge>): ClaimCharge => ({
  claimId: 'C1',
  date: '2025-07-01',
  patient: 'JANE DOE',
  provider: 'DR A',
  service: 'OFFICE VISIT',
  allowed: 100,
  preventive: false,
  inNetwork: true,
  ...overrides,
});

describe('past expenses from claims', () => {
  it('folds supplies and drugs on a claim into its main service', () => {
    const prepared = prepareClaims(
      [
        charge({ claimId: 'S', provider: 'SURGERY CENTER', service: 'SURGERY', allowed: 5000 }),
        charge({
          claimId: 'S',
          provider: 'SURGERY CENTER',
          service: 'MEDICAL SUPPLIES',
          allowed: 90,
        }),
        charge({
          claimId: 'S',
          provider: 'SURGERY CENTER',
          service: 'PRESCRIPTION DRUGS',
          allowed: 200,
        }),
        charge({ claimId: 'P', provider: 'PHARMACY', service: 'PRESCRIPTION DRUGS', allowed: 12 }),
      ],
      report
    );
    expect(prepared.visits.map(v => [v.service, v.cost])).toEqual([
      ['SURGERY', 5290],
      ['PRESCRIPTION DRUGS', 12],
    ]);
  });

  it('drops zero-dollar charges', () => {
    const prepared = prepareClaims(
      [charge({ claimId: 'D', allowed: 0 }), charge({ claimId: 'V' })],
      report
    );
    expect(prepared.visits).toHaveLength(1);
  });

  it('counts a preventive claim as one visit mapped through the preventive list', () => {
    const prepared = prepareClaims(
      [
        charge({ claimId: 'W', preventive: true, allowed: 150 }),
        charge({ claimId: 'W', preventive: true, service: 'LAB / PATHOLOGY', allowed: 30 }),
        charge({ claimId: 'W', service: 'LAB / PATHOLOGY', allowed: 40 }),
      ],
      report
    );
    expect(prepared.visits.map(v => [v.service, v.preventive, v.cost])).toEqual([
      ['OFFICE VISIT', true, 180],
      ['LAB / PATHOLOGY', false, 40],
    ]);
    const wellness = groupPastExpenses(prepared.visits, report).find(e => e.preventive);
    expect(wellness?.choices).toEqual(['wellness_exam']);
  });

  it('adds a lone add-on charge to the checkup it came with', () => {
    // A small screening billed on a preventive checkup's claim, but not paid as preventive
    const prepared = prepareClaims(
      [
        charge({ claimId: 'W', preventive: true, allowed: 150 }),
        charge({ claimId: 'W', service: 'MEDICAL SUPPLIES', allowed: 12 }),
      ],
      report
    );
    expect(prepared.visits.map(v => [v.service, v.preventive, v.cost])).toEqual([
      ['OFFICE VISIT', true, 162],
    ]);
  });

  it('lists every expense by person, provider and service', () => {
    const prepared = prepareClaims(
      [
        charge({ claimId: '1', patient: 'JOHN DOE' }),
        charge({ claimId: '2', patient: 'JANE DOE', date: '2025-01-01' }),
        charge({ claimId: '3', patient: 'JANE DOE', date: '2025-03-01' }),
        charge({ claimId: '4', patient: 'JANE DOE', provider: 'DR B' }),
      ],
      report
    );
    const expenses = groupPastExpenses(prepared.visits, report);
    expect(expenses.map(e => [e.patient, e.provider, e.visits.length])).toEqual([
      ['JANE DOE', 'DR A', 2],
      ['JANE DOE', 'DR B', 1],
      ['JOHN DOE', 'DR A', 1],
    ]);
    expect(describeExpense(expenses[0])).toBe('Jane: Dr A');
  });

  it('suggests visits per year over the report and grows prices by inflation', () => {
    const prepared = prepareClaims(
      ['2024-07-01', '2025-01-01', '2025-07-01', '2026-07-01'].map((date, i) =>
        charge({ claimId: String(i), date })
      ),
      report
    );
    const [expense] = groupPastExpenses(prepared.visits, report);
    const options = { planYear: 2027, years: yearsCovered(prepared), inflationRate: 0 };
    expect(suggestCarryOver(expense, options)).toEqual({
      include: true,
      categoryId: 'office_visit_pcp',
      quantity: 2,
      costPerVisit: 100,
    });
    const inflated = suggestCarryOver(expense, { ...options, inflationRate: 5 });
    expect(inflated.costPerVisit).toBeGreaterThan(105);
    expect(inflated.costPerVisit).toBeLessThan(115);
  });

  it('can look at only the last 12 months, counting visits as they happened', () => {
    const prepared = prepareClaims(
      ['2024-10-16', '2025-09-25', '2025-09-26', '2026-03-01', '2026-09-25'].map((date, i) =>
        charge({ claimId: String(i), date })
      ),
      report
    );
    const recent = limitToRecent(prepared, 12);
    expect(recent.firstDate).toBe('2025-09-26');
    expect(recent.visits.map(v => v.date)).toEqual(['2025-09-26', '2026-03-01', '2026-09-25']);
    const [expense] = groupPastExpenses(recent.visits, report);
    expect(
      suggestCarryOver(expense, { planYear: 2027, years: yearsCovered(recent), inflationRate: 0 })
        .quantity
    ).toBe(3);
  });

  it('keeps unknown services checked, with no category for the person to fill in', () => {
    const prepared = prepareClaims([charge({ service: 'MYSTERY' })], report);
    const [expense] = groupPastExpenses(prepared.visits, report);
    expect(suggestCarryOver(expense, { planYear: 2027, years: 1, inflationRate: 5 })).toEqual(
      expect.objectContaining({ include: true, categoryId: null })
    );
  });

  it('makes one estimate per kept expense', () => {
    const prepared = prepareClaims(
      [charge({ claimId: '1' }), charge({ claimId: '2', provider: 'DR B' })],
      report
    );
    const [a, b] = groupPastExpenses(prepared.visits, report);
    const estimates = estimatesFromCarryOvers([a, b], {
      [a.key]: {
        include: true,
        categoryId: 'office_visit_specialist',
        quantity: 3,
        costPerVisit: 150,
      },
      [b.key]: { include: false, categoryId: 'office_visit_pcp', quantity: 1, costPerVisit: 100 },
    });
    expect(estimates).toEqual([
      {
        categoryId: 'office_visit_specialist',
        estimate: { quantity: 3, costPerVisit: 150, isInNetwork: true },
        notes: 'Jane: Dr A',
      },
    ]);
  });
});
