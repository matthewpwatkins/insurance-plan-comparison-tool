import {
  addPerson,
  coverageFor,
  peopleCount,
  removePerson,
  renamePerson,
  rowsWithoutPerson,
} from '../people';
import { CategoryEstimate, CoverageType, UserInputs } from '../../types';

const row = (person?: number): CategoryEstimate => ({
  categoryId: 'office_visit_pcp',
  estimate: { quantity: 1, costPerVisit: 100, isInNetwork: true },
  ...(person ? { person } : {}),
});

const inputs = (overrides: Partial<UserInputs> = {}): UserInputs => ({
  year: 2027,
  coverage: CoverageType.Family,
  ageGroup: 'under_55',
  taxRate: 22,
  hsaContribution: 0,
  fsaContribution: 0,
  peopleNames: [],
  costs: { categoryEstimates: [] },
  ...overrides,
});

describe('people', () => {
  it('picks the coverage from how many people are listed', () => {
    expect([1, 2, 3, 6].map(coverageFor)).toEqual([
      CoverageType.Single,
      CoverageType.TwoParty,
      CoverageType.Family,
      CoverageType.Family,
    ]);
  });

  it("starts from the coverage's fewest people until someone is listed", () => {
    expect(peopleCount(inputs())).toBe(3);
    expect(peopleCount(inputs({ coverage: CoverageType.TwoParty }))).toBe(2);
    expect(peopleCount(inputs({ peopleNames: ['', '', '', ''] }))).toBe(4);
  });

  it('renames one person and keeps the others blank', () => {
    expect(renamePerson(inputs(), 2, 'Sam').peopleNames).toEqual(['', 'Sam', '']);
  });

  it('adds a person and raises the coverage to match', () => {
    expect(addPerson(inputs({ coverage: CoverageType.Single }))).toEqual({
      peopleNames: ['', ''],
      coverage: CoverageType.TwoParty,
    });
  });

  it('removes a person, sharing their rows and moving later people up', () => {
    const before = inputs({
      peopleNames: ['A', 'B', 'C'],
      costs: { categoryEstimates: [row(1), row(2), row(3), row()] },
    });
    const after = removePerson(before, 2);
    expect(after.peopleNames).toEqual(['A', 'C']);
    expect(after.coverage).toBe(CoverageType.TwoParty);
    expect(after.costs?.categoryEstimates.map(e => e.person)).toEqual([1, undefined, 2, undefined]);
  });

  describe('rowsWithoutPerson', () => {
    const otc: CategoryEstimate = { ...row(), categoryId: 'otc' };
    const covered = (categoryId: string) => categoryId !== 'otc';
    const rows = [row(1), row(), row(), otc];

    it('counts care insurance pays toward with no person, for two-party and family', () => {
      expect(rowsWithoutPerson(inputs({ costs: { categoryEstimates: rows } }), covered)).toBe(2);
      expect(
        rowsWithoutPerson(
          inputs({ coverage: CoverageType.TwoParty, costs: { categoryEstimates: rows } }),
          covered
        )
      ).toBe(2);
    });

    it('never counts with single coverage, which has one person', () => {
      expect(
        rowsWithoutPerson(
          inputs({ coverage: CoverageType.Single, costs: { categoryEstimates: rows } }),
          covered
        )
      ).toBe(0);
    });
  });
});
