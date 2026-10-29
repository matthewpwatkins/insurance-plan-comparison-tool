import { addPerson, coverageFor, peopleCount, removePerson, renamePerson } from '../people';
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
});
