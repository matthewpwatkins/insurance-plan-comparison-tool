export interface CostEstimate {
  quantity: number;
  costPerVisit: number;
  isInNetwork: boolean;
}

export interface CategoryEstimate {
  categoryId: string;
  estimate: CostEstimate;
  notes?: string;
}

export interface UserCosts {
  categoryEstimates: CategoryEstimate[];
}

import { CoverageType, AgeGroup } from './enums';

export interface UserInputs {
  year: number;
  coverage: CoverageType;
  ageGroup: AgeGroup;
  taxRate: number;
  costs: UserCosts;
  hsaContribution: number;
  fsaContribution: number;
}

export interface PartialUserInputs extends Omit<Partial<UserInputs>, 'costs'> {
  costs?: Partial<UserCosts>;
}