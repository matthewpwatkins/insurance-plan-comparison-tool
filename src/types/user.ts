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

export interface UserInputs {
  year: number;
  coverage: 'single' | 'two_party' | 'family';
  ageGroup: 'under_55' | '55_plus';
  taxRate: number;
  costs: UserCosts;
  hsaContribution: number;
  fsaContribution: number;
}

export interface PartialUserInputs extends Omit<Partial<UserInputs>, 'costs'> {
  costs?: Partial<UserCosts>;
}