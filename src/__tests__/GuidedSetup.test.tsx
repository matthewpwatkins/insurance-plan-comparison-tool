import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import App from '../App';
import { UserInputs, CoverageType } from '../types';
import { decodeUserInputs, encodeUserInputs } from '../utils/urlParams';

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
  /** The inputs the current results link carries. */
  const linkInputs = () => {
    const shared = decodeUserInputs(window.location.hash, [2027, 2026, 2025]);
    if (shared.status !== 'ok') throw new Error(`Unreadable link: ${window.location.href}`);
    return shared.inputs;
  };

  const button = (label: string): HTMLButtonElement => {
    const match = Array.from(container.querySelectorAll('button')).find(
      el => el.textContent?.trim() === label
    );
    if (!match) throw new Error(`No button "${label}" in: ${text()}`);
    return match;
  };

  /** A button in a popup, which renders outside the page's container */
  const popupButton = (label: string): HTMLButtonElement => {
    const match = Array.from(document.body.querySelectorAll('.modal button')).find(
      el => el.textContent?.trim() === label
    ) as HTMLButtonElement | undefined;
    if (!match) throw new Error(`No popup button "${label}" in: ${document.body.textContent}`);
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

  /** Clicks Next through the questions until the one that finishes */
  const nextUntilLastStep = () => {
    for (let i = 0; i < 12 && !text().includes('See my results'); i++) click('Next');
  };

  /** Lists this many people on the coverage question, which sets the coverage */
  const setPeople = (count: number) => {
    const listed = () => container.querySelectorAll('input[aria-label^="Name for person"]').length;
    while (listed() > count) {
      const removes = container.querySelectorAll('button[aria-label^="Remove person"]');
      click(removes[removes.length - 1] as HTMLElement);
    }
    while (listed() < count) click('Add person');
  };

  const numberInput = () =>
    container.querySelector('input[inputmode="numeric"]') as HTMLInputElement;
  const hsaInput = () =>
    container.querySelector('input[aria-label="Most you\'d put in an HSA"]') as HTMLInputElement;
  const fsaInput = () =>
    container.querySelector('input[aria-label="Most you\'d put in an FSA"]') as HTMLInputElement;

  /** Types into a formatted number box; it only reports the number on blur. */
  const typeNumber = (value: string, input: HTMLInputElement = numberInput()) => {
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
      expect(path()).toBe('/dmba/setup/estimate');
      expect(text()).toContain('How do you want to estimate your health expenses?');

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

      browserGoesTo('/dmba/setup/estimate');
      expect(text()).toContain('How do you want to estimate your health expenses?');
    });

    it('opens a step from its link and counts the questions that apply', () => {
      renderAt('/dmba/setup/tax');

      expect(text()).toContain("What's your combined income tax rate?");
      // year, estimate, import, coverage, age, tax, accounts, edit
      expect(text()).toContain('Question 6 of 8');
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

      browserGoesTo(`/dmba/results#${encodeUserInputs(savedInputs())}`);
      expect(text()).toContain('Basic Information');
      expect(text()).not.toContain("What's your combined income tax rate?");
    });

    it('starts the estimate question on starting from claims', () => {
      renderAt('/dmba/setup/estimate');

      const chosen = container.querySelector('.card.border-primary');
      expect(chosen?.textContent).toContain('Start from my claims');
      expect(button('Next').disabled).toBe(false);
    });
  });

  describe('HSA and FSA amounts', () => {
    it('start at the most you can put in and follow coverage until edited', () => {
      renderAt('/dmba/setup/accounts');
      // Family limit $9,000 less the $1,250 both HSA plans put in
      expect(hsaInput().value).toBe('7,750');
      expect(fsaInput().value).toBe('3,500');

      browserGoesTo('/dmba/setup/coverage');
      setPeople(1);
      browserGoesTo('/dmba/setup/accounts');
      // Single limit $4,500 less the $625 both HSA plans put in
      expect(hsaInput().value).toBe('3,875');

      typeNumber('1000', hsaInput());
      expect(hsaInput().value).toBe('1,000');

      browserGoesTo('/dmba/setup/coverage');
      setPeople(3);
      browserGoesTo('/dmba/setup/accounts');
      expect(hsaInput().value).toBe('1,000');
    });

    it('caps a typed amount at the limit', () => {
      renderAt('/dmba/setup/accounts');

      typeNumber('9999', fsaInput());

      expect(fsaInput().value).toBe('3,500');
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

      // Straight to the first question, with nothing kept from before
      expect(path()).toBe('/dmba/setup/year');
      expect(localStorage.getItem('guided:dmba:progress')).not.toContain('"tax"');
      browserGoesTo('/dmba/setup/tax');
      expect(numberInput().value).toBe('26.45');
    });

    it('puts HSA and FSA amounts back on following the max after starting over', () => {
      saveProgress('accounts', savedInputs({ hsaContribution: 1000, fsaContribution: 500 }));
      renderAt('/dmba');

      click('Start over');
      browserGoesTo('/dmba/setup/accounts');
      // Family limit $9,000 less the $1,250 both HSA plans put in
      expect(hsaInput().value).toBe('7,750');
      expect(fsaInput().value).toBe('3,500');

      browserGoesTo('/dmba/setup/coverage');
      setPeople(1);
      browserGoesTo('/dmba/setup/accounts');
      expect(hsaInput().value).toBe('3,875');
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
      expect(path()).toBe('/dmba/setup/estimate');
    });

    it('still opens a shared link', () => {
      renderAt(`/dmba/results#${encodeUserInputs(savedInputs())}`);

      expect(text()).toContain('Basic Information');
      expect(text()).toContain('Plan Comparison Results');
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
      nextUntilLastStep();
      click('See my results');

      expect(text()).toContain('Plan Comparison Results');
      expect(path()).toBe('/dmba/results');
      expect(window.location.search).toBe('');
      expect(linkInputs().year).toBe(2026);
      // The inputs above the results start closed
      const toggles = container.querySelectorAll('.card-header [aria-expanded]');
      expect(toggles).toHaveLength(3);
      toggles.forEach(toggle => expect(toggle.getAttribute('aria-expanded')).toBe('false'));
      expect(linkInputs().costs?.categoryEstimates).toEqual([]);
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
      expect(path()).toBe('/dmba/setup/coverage');
      nextUntilLastStep();
      expect(path()).toBe('/dmba/setup/edit');
      expect(text()).toContain('What health expenses do you expect in 2026?');
      click('See my results');
      expect(document.body.textContent).toContain("Anything insurance won't pay for?");
      click(popupButton('Skip, see my results'));

      expect(text()).toContain('Plan Comparison Results');
      expect(linkInputs().costs?.categoryEstimates).toEqual(savedInputs().costs.categoryEstimates);
      expect(linkInputs().taxRate).toBe(26.45);

      // Browser back from the results returns to the guide
      browserGoesTo('/dmba/setup/edit');
      expect(text()).toContain('What health expenses do you expect in 2026?');
      expect(text()).not.toContain('Basic Information');
    });

    it("reminds once about costs insurance won't pay for, and adds a row for them", () => {
      saveProgress('import');
      renderAt('/dmba/setup/import');
      click('Keep my 1 estimate');
      nextUntilLastStep();

      click('See my results');
      click(popupButton('Add them'));
      expect(path()).toBe('/dmba/setup/edit');
      // The added row stands out from the rest
      const highlighted = container.querySelectorAll('.list-group-item.bg-warning-subtle');
      expect(highlighted).toHaveLength(1);
      expect(highlighted[0].querySelector('select')?.value).toBe('other_hsa_fsa_eligible');
      // A starting guess of $50 for each of the family's 3 people
      const price = highlighted[0].querySelector(
        'input[aria-label="Price each"]'
      ) as HTMLInputElement;
      expect(price.value).toBe('150');

      // With the row added, the next click goes straight to results
      click('See my results');
      expect(text()).toContain('Plan Comparison Results');
      expect(linkInputs().costs?.categoryEstimates?.map(e => e.categoryId)).toContain(
        'other_hsa_fsa_eligible'
      );
    });

    it('opens a shared link straight to its results', () => {
      const shared = savedInputs({ coverage: CoverageType.Single, taxRate: 22 });
      renderAt(`/dmba/results#${encodeUserInputs(shared)}`);

      expect(text()).not.toContain("Let's go");
      expect(text()).toContain('Plan Comparison Results');
      expect(text()).toContain('DMBA HSA 60');
      expect(text()).not.toContain("couldn't be read");
      expect(linkInputs()).toEqual(shared);
    });

    it('opens the form with defaults and a note when a link cannot be read', () => {
      saveProgress('edit');
      renderAt('/dmba/results#v1.garbage');

      expect(text()).toContain("This link couldn't be read.");
      expect(text()).toContain('Basic Information');
      expect(text()).not.toContain('Plan Comparison Results');
      expect(text()).not.toContain('Checkups');
    });

    it('treats a link from a newer or older format as unreadable', () => {
      renderAt(`/dmba/results#${encodeUserInputs(savedInputs()).replace(/^v1\./, 'v9.')}`);

      expect(text()).toContain("This link couldn't be read.");
      expect(text()).not.toContain('Plan Comparison Results');
    });

    it('loads a results link pasted into the same tab', () => {
      renderAt('/dmba/results#v1.garbage');

      const shared = savedInputs({ coverage: CoverageType.Single });
      act(() => {
        window.history.pushState({}, '', `/dmba/results#${encodeUserInputs(shared)}`);
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });

      expect(text()).not.toContain("couldn't be read");
      expect(text()).toContain('Plan Comparison Results');
      // 4 visits at $180 from the pasted link
      expect(text()).toContain('for the $720 in total medical costs');
    });
  });
});
