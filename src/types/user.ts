export interface NetworkVisits {
  quantity: number;
  costPerVisit: number;
}

export interface CategoryEstimate {
  categoryId: string;
  inNetwork: NetworkVisits;
  outOfNetwork: NetworkVisits;
}

export interface UserCosts {
  categoryEstimates: CategoryEstimate[];
  otherCosts?: {
    inNetwork: NetworkVisits;
    outOfNetwork: NetworkVisits;
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