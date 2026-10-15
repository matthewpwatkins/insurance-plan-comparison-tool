import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import App from '../App';
import { CoverageType } from '../types';
import { encodeUserInputs } from '../utils/urlParams';

// Chart.js needs a real canvas
jest.mock('../components/CostComparisonChart', () => ({ __esModule: true, default: () => null }));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('App routing', () => {
  let container: HTMLDivElement;
  let root: Root;

  const renderAt = (url: string) => {
    window.history.pushState({}, '', url);
    // Rendering with react-dom directly (no Testing Library), so act is required
    // eslint-disable-next-line testing-library/no-unnecessary-act
    act(() => {
      root.render(<App />);
    });
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('shows the company chooser at the root', () => {
    renderAt('/');

    expect(container.textContent).toContain('Choose your company');
    const links = Array.from(container.querySelectorAll('a')).map(a => a.getAttribute('href'));
    expect(links).toContain('/dmba');
  });

  it('shows the chooser with a notice for an unknown company', () => {
    renderAt('/nope');

    expect(container.textContent).toContain('No company found for "nope"');
    expect(container.textContent).toContain('Choose your company');
  });

  it('shows the company page at its slug', () => {
    renderAt('/dmba');

    expect(container.textContent).toContain('DMBA Health Plan Comparison Tool');
    expect(document.title).toBe('DMBA Health Plan Comparison Tool');
    expect(container.textContent).not.toContain('Choose your company');
  });

  it('starts first-time visitors on the guided setup', () => {
    renderAt('/dmba');

    expect(container.textContent).toContain("Let's go");
    expect(container.textContent).not.toContain('Basic Information');
  });

  it('opens the full form for a results link', () => {
    const shared = encodeUserInputs({
      year: 2026,
      coverage: CoverageType.Single,
      ageGroup: 'under_55',
      taxRate: 22,
      costs: { categoryEstimates: [] },
      hsaContribution: 0,
      fsaContribution: 0,
    });
    renderAt(`/dmba/results#${shared}`);

    expect(container.textContent).toContain('Basic Information');
    expect(container.textContent).not.toContain("Let's go");
  });

  it('treats the slug case-insensitively', () => {
    renderAt('/DMBA');

    expect(container.textContent).toContain('DMBA Health Plan Comparison Tool');
  });
});
