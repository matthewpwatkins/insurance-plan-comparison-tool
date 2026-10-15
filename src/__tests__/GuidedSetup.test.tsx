import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import App from '../App';
import { UserInputs, CoverageType } from '../types';

// Chart.js needs a real canvas; the results table is enough to see a comparison ran
jest.mock('../components/CostComparisonChart', () => ({ __esModule: true, default: () => null }));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Rendering with react-dom directly (no Testing Library), so events go through act by hand
/* eslint-disable testing-library/no-unnecessary-act */

const savedInputs = (overrides: Partial<UserInputs> = {}): UserInputs => ({
  year: 2026,
  coverage: CoverageType.Family,
  ageGroup: 'under_55',
  taxRate: 26.45,
  hsaContribution: 0,
  fsaContribution: 0,
  costs: {
    categoryEstimates: [
      {
        categoryId: 'office_visit_pcp',
        estimate: { quantity: 4, costPerVisit: 180, isInNetwork: true },
        notes: 'Checkups',
      },
    ],
  },
  ...overrides,
});

const saveProgress = (step: string, inputs: UserInputs = savedInputs()) => {
  localStorage.setItem('guided:dmba:inputs', JSON.stringify(inputs));
  localStorage.setItem(
    'guided:dmba:progress',
    JSON.stringify({ step, estimateChoice: 'estimate', hsaTouched: true, fsaTouched: true })
  );
};

describe('guided setup', () => {
  let container: HTMLDivElement;
  let root: Root | null;

  const renderAt = (url: string) => {
    window.history.pushState({}, '', url);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(<App />);
    });
  };

  const unmount = () => {
    act(() => root?.unmount());
    root = null;
    container.remove();
  };

  const text = () => container.textContent ?? '';
  const path = () => window.location.pathname;

  const button = (label: string): HTMLButtonElement => {
    const match = Array.from(container.querySelectorAll('button')).find(
      el => el.textContent?.trim() === label
    );
    if (!match) throw new Error(`No button "${label}" in: ${text()}`);
    return match;
  };

  const click = (target: string | HTMLElement) => {
    const el = typeof target === 'string' ? button(target) : target;
    act(() => {
      el.click();
    });
  };

  const setValue = (el: HTMLInputElement | HTMLSelectElement, value: string) => {
    const proto = Object.getPrototypeOf(el);
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
  };

  const choose = (value: string) => {
    const select = container.querySelector('select') as HTMLSelectElement;
    act(() => {
      setValue(select, value);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };

  const numberInput = () =>
    container.querySelector('input[inputmode="numeric"]') as HTMLInputElement;

  /** Types into a formatted number box; it only reports the number on blur. */
  const typeNumber = (value: string) => {
    const input = numberInput();
    act(() => {
      input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      setValue(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
  };

  /** The browser's back and forward buttons change the URL, then fire popstate. */
  const browserGoesTo = (url: string) => {
    act(() => {
      window.history.pushState({}, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  };

  beforeEach(() => {
    localStorage.clear();
    window.scrollTo = jest.fn();
    root = null;
  });

  afterEach(() => {
    if (root) unmount();
  });

  describe('navigation', () => {
    it('gives each step its own URL, forward and back', () => {
      renderAt('/dmba');

      click("Let's go");
      expect(path()).toBe('/dmba/setup/year');
      expect(text()).toContain('What plan year are you working on?');

      click('Next');
      expect(path()).toBe('/dmba/setup/coverage');
      expect(text()).toContain('who are you getting coverage for?');

      click('Back');
      expect(path()).toBe('/dmba/setup/year');

      click('Back');
      expect(path()).toBe('/dmba');
      expect(text()).toContain("Let's go");
    });

    it('follows the browser back and forward buttons', () => {
      renderAt('/dmba');
      click("Let's go");
      click('Next');

      browserGoesTo('/dmba/setup/year');
      expect(text()).toContain('What plan year are you working on?');

      browserGoesTo('/dmba');
      expect(text()).toContain("Let's go");

      browserGoesTo('/dmba/setup/coverage');
      expect(text()).toContain('who are you getting coverage for?');
    });

    it('opens a step from its link and counts the questions that apply', () => {
      renderAt('/dmba/setup/tax');

      expect(text()).toContain("What's your combined income tax rate?");
      // year, coverage, age, tax, hsa, fsa, estimate, import, edit
      expect(text()).toContain('Question 4 of 9');
    });

    it('sends a review link with no report loaded back to the import step', () => {
      renderAt('/dmba/setup/review');

      expect(path()).toBe('/dmba/setup/import');
      expect(text()).toContain("Start from last year's claims?");
    });

    it('moves between the full form and the guided steps with browser back', () => {
      renderAt('/dmba');

      click('Go straight to the full form');
      expect(text()).toContain('Basic Information');

      browserGoesTo('/dmba/setup/tax');
      expect(text()).toContain("What's your combined income tax rate?");
      expect(text()).not.toContain('Basic Information');

      browserGoesTo('/dmba?coverage=single');
      expect(text()).toContain('Basic Information');
    });

    it('waits for an answer before leaving the estimate question', () => {
      renderAt('/dmba/setup/estimate');

      expect(button('Next').disabled).toBe(true);
      click(container.querySelector('.card[role="button"]') as HTMLElement);
      expect(button('Next').disabled).toBe(false);
    });
  });

  describe('HSA and FSA amounts', () => {
    it('start at the most you can put in and follow coverage until edited', () => {
      renderAt('/dmba/setup/hsa');
      // Family limit $8,750 less HSA 80's $1,700, the plan that leaves the most room
      expect(numberInput().value).toBe('7,050');

      click('Next');
      expect(text()).toContain("What's the most you'd put in an FSA?");
      expect(numberInput().value).toBe('3,400');

      browserGoesTo('/dmba/setup/coverage');
      choose(CoverageType.Single);
      browserGoesTo('/dmba/setup/hsa');
      // Single limit $4,400 less HSA 80's $850
      expect(numberInput().value).toBe('3,550');

      typeNumber('1000');
      expect(numberInput().value).toBe('1,000');

      browserGoesTo('/dmba/setup/coverage');
      choose(CoverageType.Family);
      browserGoesTo('/dmba/setup/hsa');
      expect(numberInput().value).toBe('1,000');
    });

    it('caps a typed amount at the limit', () => {
      renderAt('/dmba/setup/fsa');

      typeNumber('9999');

      expect(numberInput().value).toBe('3,400');
    });
  });

  describe('saved progress', () => {
    it('picks up where the person left off', () => {
      renderAt('/dmba/setup/tax');
      typeNumber('30');
      unmount();

      renderAt('/dmba');
      expect(text()).toContain('Pick up where you left off');
      click('Pick up where you left off');

      expect(path()).toBe('/dmba/setup/tax');
      expect(numberInput().value).toBe('30');
    });

    it('starts over with the defaults and forgets what was saved', () => {
      saveProgress('tax', savedInputs({ taxRate: 30 }));
      renderAt('/dmba');

      click('Start over');

      expect(text()).toContain("Let's go");
      expect(localStorage.getItem('guided:dmba:progress')).toBeNull();
      click("Let's go");
      browserGoesTo('/dmba/setup/tax');
      expect(numberInput().value).toBe('26.45');
    });

    it('puts HSA and FSA amounts back on following the max after starting over', () => {
      saveProgress('hsa', savedInputs({ hsaContribution: 1000, fsaContribution: 500 }));
      renderAt('/dmba');

      click('Start over');
      browserGoesTo('/dmba/setup/hsa');
      // Family limit $8,750 less HSA 80's $1,700
      expect(numberInput().value).toBe('7,050');
      browserGoesTo('/dmba/setup/fsa');
      expect(numberInput().value).toBe('3,400');

      browserGoesTo('/dmba/setup/coverage');
      choose(CoverageType.Single);
      browserGoesTo('/dmba/setup/hsa');
      expect(numberInput().value).toBe('3,550');
    });

    it('reopens a saved review at the import step, since the report is not kept', () => {
      saveProgress('review');
      renderAt('/dmba');

      click('Pick up where you left off');

      expect(path()).toBe('/dmba/setup/import');
    });

    it('ignores saved answers for a year the company has no data for', () => {
      saveProgress('tax', savedInputs({ year: 2019, taxRate: 30 }));
      renderAt('/dmba/setup/tax');

      expect(numberInput().value).toBe('26.45');
    });
  });

  describe('with site storage blocked', () => {
    // Browsers with site data off throw on any touch of localStorage, even reading the property
    let restore: () => void;
    beforeEach(() => {
      const original = window.localStorage;
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get: () => {
          throw new DOMException('The operation is insecure.', 'SecurityError');
        },
      });
      restore = () =>
        Object.defineProperty(window, 'localStorage', { configurable: true, value: original });
    });
    afterEach(() => restore());

    it('still runs the guided setup', () => {
      renderAt('/dmba');

      click("Let's go");
      click('Next');
      expect(path()).toBe('/dmba/setup/coverage');
    });

    it('still opens the full form', () => {
      renderAt('/dmba?coverage=single');

      expect(text()).toContain('Basic Information');
    });

    it('opens the full form with every section open when skipping the guide', () => {
      renderAt('/dmba');

      click('Go straight to the full form');
      const toggles = container.querySelectorAll('.card-header [aria-expanded]');
      expect(toggles).toHaveLength(3);
      toggles.forEach(toggle => expect(toggle.getAttribute('aria-expanded')).toBe('true'));
    });
  });

  describe('finishing', () => {
    it('compares on preventive care alone, dropping earlier estimates', () => {
      saveProgress('estimate');
      renderAt('/dmba/setup/estimate');

      const preventive = Array.from(container.querySelectorAll('.card[role="button"]')).find(card =>
        card.textContent?.includes('Only preventive care')
      ) as HTMLElement;
      click(preventive);
      click('See my results');

      expect(text()).toContain('Plan Comparison Results');
      expect(path()).toBe('/dmba/results');
      expect(window.location.search).toContain('year=2026');
      // The inputs above the results start closed
      const toggles = container.querySelectorAll('.card-header [aria-expanded]');
      expect(toggles).toHaveLength(3);
      toggles.forEach(toggle => expect(toggle.getAttribute('aria-expanded')).toBe('false'));
      expect(window.location.search).not.toContain('categoryEstimates');
    });

    it('stays on the expense editor when Enter submits its one form', () => {
      saveProgress('edit');
      renderAt('/dmba/setup/edit');

      const forms = container.querySelectorAll('form');
      expect(forms).toHaveLength(1);
      act(() => {
        forms[0].dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });

      expect(path()).toBe('/dmba/setup/edit');
      expect(text()).not.toContain('Plan Comparison Results');
    });

    it('compares with the estimates and puts them in the link', () => {
      saveProgress('import');
      renderAt('/dmba/setup/import');

      click('Keep my 1 estimate');
      expect(path()).toBe('/dmba/setup/edit');
      expect(text()).toContain('What health expenses do you expect in 2026?');
      click('See my results');

      expect(text()).toContain('Plan Comparison Results');
      const params = new URLSearchParams(window.location.search);
      expect(JSON.parse(params.get('categoryEstimates') ?? '[]')).toEqual(
        savedInputs().costs.categoryEstimates
      );
      expect(params.get('taxRate')).toBe('26.45');
    });

    it('opens a shared link straight to its results', () => {
      const estimates = JSON.stringify(savedInputs().costs.categoryEstimates);
      renderAt(
        `/dmba/results?year=2026&coverage=single&taxRate=22&categoryEstimates=${encodeURIComponent(
          estimates
        )}`
      );

      expect(text()).not.toContain("Let's go");
      expect(text()).toContain('Plan Comparison Results');
      expect(text()).toContain('DMBA HSA 60');
    });
  });
});
