import {
  clearGuided,
  guidedStepPath,
  loadGuidedInputs,
  loadGuidedProgress,
  readGuidedStepFromPath,
  saveGuidedInputs,
  saveGuidedProgress,
} from '../guidedStorage';
import { CoverageType, UserInputs } from '../../types';

const inputs: UserInputs = {
  year: 2026,
  coverage: CoverageType.TwoParty,
  ageGroup: '55_plus',
  taxRate: 24,
  hsaContribution: 1200,
  fsaContribution: 0,
  costs: {
    categoryEstimates: [
      {
        categoryId: 'office_visit_pcp',
        estimate: { quantity: 2, costPerVisit: 150, isInNetwork: false },
        notes: 'Sick visits',
      },
    ],
  },
};

const progress = {
  step: 'edit',
  estimateChoice: 'estimate',
  claimsPeriod: 'Jan 1, 2025 to Dec 31, 2025',
  hsaTouched: true,
  fsaTouched: false,
};

describe('guided storage', () => {
  beforeEach(() => localStorage.clear());

  it('saves and loads answers and progress per company', () => {
    saveGuidedInputs('dmba', inputs);
    saveGuidedProgress('dmba', progress);

    expect(loadGuidedInputs('dmba')).toEqual(inputs);
    expect(loadGuidedProgress('dmba')).toEqual(progress);
    expect(loadGuidedInputs('other-co')).toBeNull();
    expect(loadGuidedProgress('other-co')).toBeNull();
  });

  it('clears only that company', () => {
    saveGuidedInputs('dmba', inputs);
    saveGuidedProgress('dmba', progress);
    saveGuidedInputs('other-co', inputs);

    clearGuided('dmba');

    expect(loadGuidedInputs('dmba')).toBeNull();
    expect(loadGuidedProgress('dmba')).toBeNull();
    expect(loadGuidedInputs('other-co')).toEqual(inputs);
  });

  it('treats unreadable saved data as nothing saved', () => {
    localStorage.setItem('guided:dmba:inputs', '{not json');

    expect(loadGuidedInputs('dmba')).toBeNull();
  });

  it('never throws when the browser blocks storage', () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    const spies = [
      jest.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked),
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked),
      jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked),
    ];
    try {
      expect(() => saveGuidedInputs('dmba', inputs)).not.toThrow();
      expect(() => saveGuidedProgress('dmba', progress)).not.toThrow();
      expect(loadGuidedInputs('dmba')).toBeNull();
      expect(loadGuidedProgress('dmba')).toBeNull();
      expect(() => clearGuided('dmba')).not.toThrow();
    } finally {
      spies.forEach(spy => spy.mockRestore());
    }
  });
});

describe('guided step URLs', () => {
  it('reads the step from /<company>/setup/<step>', () => {
    expect(readGuidedStepFromPath('/dmba/setup/tax')).toBe('tax');
    expect(readGuidedStepFromPath('/dmba/setup/tax/')).toBe('tax');
  });

  it('has no step outside the setup section', () => {
    expect(readGuidedStepFromPath('/dmba')).toBeNull();
    expect(readGuidedStepFromPath('/dmba/setup')).toBeNull();
    expect(readGuidedStepFromPath('/dmba/other/tax')).toBeNull();
    expect(readGuidedStepFromPath('/')).toBeNull();
  });

  it('puts the welcome step at the company page and the rest under setup', () => {
    expect(guidedStepPath('dmba', 'welcome')).toBe('/dmba');
    expect(guidedStepPath('dmba', 'hsa')).toBe('/dmba/setup/hsa');
    expect(readGuidedStepFromPath(guidedStepPath('dmba', 'hsa'))).toBe('hsa');
  });
});
