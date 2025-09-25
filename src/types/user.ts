export interface CategoryEstimate {
  categoryId: string;
  inNetworkCost: number;
  outOfNetworkCost: number;
}

export interface UserCosts {
  categoryEstimates: CategoryEstimate[];
  otherCosts?: {
    inNetworkCost: number;
    outOfNetworkCost: number;
  };
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