import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ClaimsDraft, ClaimsReview, LoadedClaims } from '../components/ClaimsReportImporter';
import { groupPastExpenses, prepareClaims } from '../claims/estimateFromClaims';
import { ClaimCharge } from '../claims/types';
import { getCompany } from '../generated/dataHelpers';
import { loadPlanData } from '../services/planDataService';
import { PlanData } from '../types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Rendering with react-dom directly (no Testing Library), so events go through act by hand
/* eslint-disable testing-library/no-unnecessary-act */

const report = getCompany('dmba')!.claims_report!;

const charge = (overrides: Partial<ClaimCharge>): ClaimCharge => ({
  claimId: 'C1',
  date: '2025-06-01',
  patient: 'PAT ONE',
  provider: 'CLINIC A',
  service: 'OFFICE VISIT',
  allowed: 200,
  preventive: false,
  inNetwork: true,
  ...overrides,
});

// A year of claims for two made-up people
const charges: ClaimCharge[] = [
  charge({ claimId: 'A1', date: '2025-01-15', allowed: 180 }),
  charge({ claimId: 'A2', date: '2025-06-15', allowed: 220 }),
  charge({ claimId: 'L1', provider: 'LAB B', service: 'LAB / PATHOLOGY', allowed: 90 }),
  charge({ claimId: 'X1', provider: 'MYSTERY CO', service: 'UNHEARD OF', allowed: 300 }),
  charge({
    claimId: 'T1',
    date: '2025-12-31',
    patient: 'PAT TWO',
    provider: 'THERAPY C',
    service: 'PSYCHOTHERAPY',
    allowed: 150,
    inNetwork: false,
  }),
];

const loadClaims = (): LoadedClaims => {
  const prepared = prepareClaims(charges, report);
  return { prepared, expenses: groupPastExpenses(prepared.visits, report), trimmed: false };
};

describe('claims review', () => {
  let container: HTMLDivElement;
  let root: Root;
  let draft: ClaimsDraft | null;

  const render = (planData: PlanData) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <ClaimsReview claims={loadClaims()} planData={planData} onDraftChange={d => (draft = d)} />
      );
    });
  };

  const byLabel = <T extends HTMLElement>(label: string): T => {
    const el = container.querySelector(`[aria-label="${label}"]`);
    if (!el) throw new Error(`Nothing labeled "${label}"`);
    return el as T;
  };

  const click = (el: HTMLElement) =>
    act(() => {
      el.click();
    });

  const setValue = (el: HTMLInputElement | HTMLSelectElement, value: string, event: string) =>
    act(() => {
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')!.set!.call(el, value);
      el.dispatchEvent(new Event(event, { bubbles: true }));
    });

  const kept = () => draft!.estimates.map(estimate => estimate.categoryId).sort();
  const priceOf = (categoryId: string) =>
    draft!.estimates.find(estimate => estimate.categoryId === categoryId)!.estimate.costPerVisit;

  beforeEach(() => {
    draft = null;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('starts with every expense it can place, at its default category', () => {
    render(loadPlanData('dmba', 2026));

    expect(draft!.ready).toBe(true);
    expect(kept()).toEqual([
      'behavioral_mental_health_outpatient',
      'laboratory_outpatient',
      'office_visit_pcp',
    ]);
    const office = draft!.estimates.find(e => e.categoryId === 'office_visit_pcp')!;
    expect(office.estimate.quantity).toBe(2);
    expect(office.notes).toBe('Pat: Clinic A');
    const therapy = draft!.estimates.find(
      e => e.categoryId === 'behavioral_mental_health_outpatient'
    )!;
    expect(therapy.estimate.isInNetwork).toBe(false);
  });

  it("grows prices by the plan year's expected increase, and the slider changes it", () => {
    const planData = loadPlanData('dmba', 2026);
    render(planData);

    expect(container.textContent).toContain(`${planData.healthcare_price_increase.toFixed(1)}%`);
    const grown = priceOf('office_visit_pcp');
    // $200 average from mid-2025 grown about a year at 3.5%
    expect(grown).toBeGreaterThan(200);
    expect(grown).toBeLessThan(200 * 1.05);

    setValue(container.querySelector('#claims-inflation') as HTMLInputElement, '0', 'input');
    expect(priceOf('office_visit_pcp')).toBe(200);

    setValue(container.querySelector('#claims-inflation') as HTMLInputElement, '10', 'input');
    expect(priceOf('office_visit_pcp')).toBeGreaterThan(grown);
  });

  it('starts each year at its own price increase', () => {
    const planData = loadPlanData('dmba', 2025);
    render(planData);

    expect(planData.healthcare_price_increase).not.toBe(
      loadPlanData('dmba', 2026).healthcare_price_increase
    );
    expect(container.textContent).toContain(`${planData.healthcare_price_increase.toFixed(1)}%`);
  });

  it('holds Continue until a checked unknown service has a category', () => {
    render(loadPlanData('dmba', 2026));

    click(byLabel('Include MYSTERY CO'));
    expect(draft!.ready).toBe(false);
    expect(container.textContent).toContain('Pick a category for every checked row');

    setValue(byLabel<HTMLSelectElement>('Category for MYSTERY CO'), 'urgent_care', 'change');
    expect(draft!.ready).toBe(true);
    expect(kept()).toContain('urgent_care');
  });

  it('leaves out what the person unchecks', () => {
    render(loadPlanData('dmba', 2026));

    click(byLabel('Include LAB B'));
    expect(kept()).not.toContain('laboratory_outpatient');

    click(byLabel('Select all for Pat Two'));
    expect(kept()).toEqual(['office_visit_pcp']);

    click(container.querySelector('#claims-select-all') as HTMLElement);
    // Select all checks the unknown service too, which then needs a category
    expect(draft!.ready).toBe(false);

    click(container.querySelector('#claims-select-all') as HTMLElement);
    expect(draft!.estimates).toEqual([]);
  });

  it('clears the selection when the review closes', () => {
    render(loadPlanData('dmba', 2026));
    expect(draft).not.toBeNull();

    act(() => root.unmount());
    root = createRoot(container);

    expect(draft).toBeNull();
  });
});
