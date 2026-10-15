import { act, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import HealthcareCategoriesSection from '../components/HealthcareCategoriesSection';
import { loadPlanData } from '../services/planDataService';
import { CategoryEstimate, CoverageType, UserInputs } from '../types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Rendering with react-dom directly (no Testing Library), so events go through act by hand
/* eslint-disable testing-library/no-unnecessary-act */

const planData = loadPlanData('dmba', 2026);

const row = (categoryId: string, quantity: number, notes: string): CategoryEstimate => ({
  categoryId,
  estimate: { quantity, costPerVisit: 100, isInNetwork: true },
  notes,
});

describe('expense editor', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: UserInputs;

  const Harness = ({ initial }: { initial: CategoryEstimate[] }) => {
    const [inputs, setInputs] = useState<UserInputs>({
      year: 2026,
      coverage: CoverageType.Family,
      ageGroup: 'under_55',
      taxRate: 22,
      hsaContribution: 0,
      fsaContribution: 0,
      costs: { categoryEstimates: initial },
    });
    latest = inputs;
    return (
      <HealthcareCategoriesSection
        inputs={inputs}
        planData={planData}
        onChange={updates => setInputs(prev => ({ ...prev, ...updates }))}
      />
    );
  };

  const render = (initial: CategoryEstimate[] = []) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<Harness initial={initial} />);
    });
  };

  const rows = () => Array.from(container.querySelectorAll('.list-group-item')) as HTMLElement[];
  const estimates = () => latest.costs.categoryEstimates;

  const setValue = (el: HTMLInputElement | HTMLSelectElement, value: string) =>
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')!.set!.call(el, value);

  const typeInto = (input: HTMLInputElement, value: string) =>
    act(() => {
      input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      setValue(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });

  const field = (rowEl: HTMLElement, label: string) =>
    rowEl.querySelector(`[aria-label="${label}"]`) as HTMLInputElement;

  const click = (el: HTMLElement) =>
    act(() => {
      el.click();
    });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('adds a category as one in-network visit', () => {
    render();

    const add = container.querySelector('select') as HTMLSelectElement;
    act(() => {
      setValue(add, 'urgent_care');
      add.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(estimates()).toEqual([
      {
        categoryId: 'urgent_care',
        estimate: { quantity: 1, costPerVisit: 0, isInNetwork: true },
        notes: '',
      },
    ]);
    expect(add.value).toBe('');
  });

  it('edits visits, price, network and note on the right row', () => {
    render([row('office_visit_pcp', 2, 'First'), row('urgent_care', 1, 'Second')]);

    const second = rows()[1];
    typeInto(field(second, 'Per year'), '3');
    typeInto(field(second, 'Price each'), '1,250');
    click(second.querySelector('button[title="Out-of-network"]') as HTMLElement);
    act(() => {
      const notes = field(second, 'Notes');
      setValue(notes, 'Ankle');
      notes.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(estimates()[0]).toEqual(row('office_visit_pcp', 2, 'First'));
    expect(estimates()[1]).toEqual({
      categoryId: 'urgent_care',
      estimate: { quantity: 3, costPerVisit: 1250, isInNetwork: false },
      notes: 'Ankle',
    });
  });

  it('shows preventive care first but edits and removes the row clicked', () => {
    // Entered second, shown first
    render([row('office_visit_pcp', 2, 'Sick visits'), row('wellness_exam', 1, 'Checkup')]);

    expect(rows()[0].textContent).toContain('Preventive');
    typeInto(field(rows()[0], 'Per year'), '2');
    expect(estimates().map(e => [e.notes, e.estimate.quantity])).toEqual([
      ['Sick visits', 2],
      ['Checkup', 2],
    ]);

    click(rows()[0].querySelector('button[aria-label="Remove"]') as HTMLElement);
    expect(estimates().map(e => e.notes)).toEqual(['Sick visits']);
    expect(rows()).toHaveLength(1);
    expect(field(rows()[0], 'Per year').value).toBe('2');
  });

  it("takes counts over the strictest plan's visit limit, with a hint", () => {
    // Acupuncture: DMBA plans cover 12 a year
    render([row('acupuncture', 2, '')]);

    const perYear = field(rows()[0], 'Per year');
    typeInto(perYear, '20');

    expect(estimates()[0].estimate.quantity).toBe(20);
    expect(perYear.value).toBe('20');
    expect(perYear.title).toContain('12 a year');
  });

  it('never lets a count go below zero', () => {
    render([row('urgent_care', 2, '')]);

    typeInto(field(rows()[0], 'Per year'), '-4');

    expect(estimates()[0].estimate.quantity).toBe(0);
  });
});
