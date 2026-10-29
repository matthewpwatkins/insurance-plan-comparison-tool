export enum CoverageType {
  Single = 'single',
  TwoParty = 'two_party',
  Family = 'family',
}

export interface CostEstimate {
  quantity: number;
  costPerVisit: number;
  isInNetwork: boolean;
}

export interface CategoryEstimate {
  categoryId: string;
  estimate: CostEstimate;
  notes?: string;
  /** Who the care is for, numbered from 1. Unset rows count together as one unnamed person. */
  person?: number;
}

export interface UserCosts {
  categoryEstimates: CategoryEstimate[];
}

export interface UserInputs {
  year: number;
  coverage: CoverageType;
  ageGroup: 'under_55' | '55_plus';
  taxRate: number;
  costs: UserCosts;
  hsaContribution: number;
  fsaContribution: number;
  /** Optional names for people 1, 2, ...; blank or missing shows "Person N" */
  peopleNames: string[];
}

export interface PartialUserInputs extends Omit<Partial<UserInputs>, 'costs'> {
  costs?: Partial<UserCosts>;
}
