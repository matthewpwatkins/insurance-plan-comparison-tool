import { CoverageType, UserInputs } from '../types';

/** Fewest people each coverage level has, so the person list starts with that many */
const MIN_PEOPLE: Record<CoverageType, number> = {
  [CoverageType.Single]: 1,
  [CoverageType.TwoParty]: 2,
  [CoverageType.Family]: 3,
};

/** Whether rows say who they're for. Single coverage has only one person, so it never asks. */
export const tracksPeople = (coverage: CoverageType): boolean => coverage !== CoverageType.Single;

/** The coverage level for a number of people */
export const coverageFor = (count: number): CoverageType =>
  count <= 1 ? CoverageType.Single : count === 2 ? CoverageType.TwoParty : CoverageType.Family;

/** Names entered so far, blank for unnamed people; inputs saved before names existed have none */
export const peopleNames = (inputs: UserInputs): string[] => inputs.peopleNames ?? [];

/**
 * How many people are covered: as many as listed, or the coverage's minimum before anyone is
 * listed, and never fewer than the rows use
 */
export const peopleCount = (inputs: UserInputs): number =>
  Math.max(
    peopleNames(inputs).length || MIN_PEOPLE[inputs.coverage],
    ...inputs.costs.categoryEstimates.map(estimate => estimate.person ?? 0)
  );

/** Whether the list says more than the coverage alone would, so a link needs to carry it */
export const listsExtraPeople = (inputs: UserInputs): boolean =>
  peopleNames(inputs).length > MIN_PEOPLE[inputs.coverage] ||
  peopleNames(inputs).some(name => name.trim());

/** The name entered for a person, or "Person N" */
export const personName = (inputs: UserInputs, person: number): string =>
  peopleNames(inputs)[person - 1]?.trim() || `Person ${person}`;

/** Every listed person's name, blank where none was entered */
const listed = (inputs: UserInputs): string[] =>
  Array.from({ length: peopleCount(inputs) }, (_, i) => peopleNames(inputs)[i] ?? '');

/** The list with one person renamed */
export const renamePerson = (
  inputs: UserInputs,
  person: number,
  name: string
): Partial<UserInputs> => {
  const names = listed(inputs);
  names[person - 1] = name;
  return { peopleNames: names };
};

/** The list with one more person, and the coverage to match */
export const addPerson = (inputs: UserInputs): Partial<UserInputs> => {
  const names = [...listed(inputs), ''];
  return { peopleNames: names, coverage: coverageFor(names.length) };
};

/**
 * The list without one person, and the coverage to match. Their rows become shared care, and
 * everyone after them moves up a number.
 */
export const removePerson = (inputs: UserInputs, person: number): Partial<UserInputs> => {
  const names = listed(inputs).filter((_, i) => i !== person - 1);
  const categoryEstimates = inputs.costs.categoryEstimates.map(estimate => {
    if (estimate.person === undefined || estimate.person < person) return estimate;
    const { person: removed, ...rest } = estimate;
    return removed === person ? rest : { ...rest, person: removed - 1 };
  });
  return {
    peopleNames: names,
    coverage: coverageFor(names.length),
    costs: { ...inputs.costs, categoryEstimates },
  };
};
