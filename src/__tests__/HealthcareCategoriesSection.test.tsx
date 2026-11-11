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

  const newForm = () => container.querySelector('[aria-label="New expense"]') as HTMLElement;
  const choose = (select: HTMLSelectElement, value: string) =>
    act(() => {
      setValue(select, value);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  const addButton = () =>
    Array.from(newForm().querySelectorAll('button')).find(b => b.textContent === 'Add')!;

  it('adds an expense only once who, count and price are filled in', () => {
    render([{ ...row('office_visit_pcp', 2, 'First'), person: 2 }]);

    choose(field(newForm(), 'New category') as unknown as HTMLSelectElement, 'urgent_care');
    // Nothing joins the list yet, and no person is assumed
    expect(estimates()).toHaveLength(1);
    expect((field(newForm(), 'Who') as unknown as HTMLSelectElement).value).toBe('');

    click(addButton());
    expect(estimates()).toHaveLength(1);
    expect(newForm().textContent).toContain('who it is for');

    choose(field(newForm(), 'Who') as unknown as HTMLSelectElement, '1');
    typeInto(field(newForm(), 'Per year'), '2');
    typeInto(field(newForm(), 'Price each'), '150');
    click(addButton());

    expect(estimates()[1]).toEqual({
      categoryId: 'urgent_care',
      estimate: { quantity: 2, costPerVisit: 150, isInNetwork: true },
      notes: '',
      person: 1,
    });
    // The form clears for the next one
    expect((field(newForm(), 'New category') as unknown as HTMLSelectElement).value).toBe('');
  });

  it('adds shared care when the person is "Not sure"', () => {
    render();

    choose(field(newForm(), 'New category') as unknown as HTMLSelectElement, 'urgent_care');
    choose(field(newForm(), 'Who') as unknown as HTMLSelectElement, 'shared');
    typeInto(field(newForm(), 'Price each'), '200');
    click(addButton());

    expect(estimates()).toEqual([
      {
        categoryId: 'urgent_care',
        estimate: { quantity: 1, costPerVisit: 200, isInNetwork: true },
        notes: '',
      },
    ]);
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

  it('shows rows in the order entered until the user sorts them', () => {
    render([row('office_visit_pcp', 2, 'Sick visits'), row('wellness_exam', 3, 'Checkup')]);

    expect(rows().map(r => field(r, 'Notes').value)).toEqual(['Sick visits', 'Checkup']);

    choose(container.querySelector('[aria-label="Sort by"]') as HTMLSelectElement, 'quantity');
    expect(rows().map(r => field(r, 'Notes').value)).toEqual(['Checkup', 'Sick visits']);

    // Edits and removals still hit the row clicked, not the row at that spot in entry order
    typeInto(field(rows()[0], 'Per year'), '4');
    expect(estimates().map(e => [e.notes, e.estimate.quantity])).toEqual([
      ['Sick visits', 2],
      ['Checkup', 4],
    ]);
    click(rows()[0].querySelector('button[aria-label="Remove"]') as HTMLElement);
    expect(estimates().map(e => e.notes)).toEqual(['Sick visits']);
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
