export interface PlanPremiums {
  single: number;
  two_party: number;
  family: number;
}

export interface NetworkDeductible {
  single: number;
  family: number;
}

export interface PlanDeductible {
  in_network: NetworkDeductible;
  out_of_network: NetworkDeductible;
}

export interface NetworkOutOfPocket {
  individual: number;
  family: number;
}

export interface PlanOutOfPocket {
  in_network: NetworkOutOfPocket;
  out_of_network: NetworkOutOfPocket;
}

export interface CostStructure {
  copay?: number;
  coinsurance?: number;
  max_coinsurance?: number;
}

export interface NetworkBenefits {
  in_network_coverage?: CostStructure;
  out_of_network_coverage?: CostStructure;
}

export interface Category {
  name: string;
}

export interface HealthPlan {
  name: string;
  type: 'PPO' | 'HSA';
  monthly_premiums: PlanPremiums;
  annual_deductible: PlanDeductible;
  out_of_pocket_maximum: PlanOutOfPocket;
  default: NetworkBenefits;
  categories: Record<string, NetworkBenefits>;
  employer_hsa_contribution?: PlanPremiums;
}

export interface HSAContributionLimits {
  single_coverage: number;
  family_coverage: number;
  catch_up_age_55_plus: number;
}

export interface FSAContributionLimits {
  healthcare_fsa: number;
}

export interface CategoriesData {
  [categoryId: string]: Category;
}

export interface PlanData {
  year: number;
  hsa_contribution_limits: HSAContributionLimits;
  fsa_contribution_limits: FSAContributionLimits;
  plans: HealthPlan[];
}

export interface UserCosts {
  totalAnnualCosts: number;
  networkMix: 'in_network' | 'mixed' | 'out_network';
}

export interface UserInputs {
  year: number;
  coverage: 'single' | 'two_party' | 'family';
  ageGroup: 'under_55' | '55_plus';
  taxRate: number;
  costInputMode: 'simple' | 'detailed';
  costs: UserCosts;
  hsaContribution: number;
  fsaContribution: number;
}

export interface PartialUserInputs extends Omit<Partial<UserInputs>, 'costs'> {
  costs?: Partial<UserCosts>;
}

export interface PlanResult {
  planName: string;
  planType: 'PPO' | 'HSA';
  annualPremiums: number;
  userContribution: number;
  employerContribution: number;
  totalContributions: number;
  taxSavings: number;
  outOfPocketCosts: number;
  totalCost: number;
  breakdown: {
    premiums: number;
    taxSavings: number;
    outOfPocket: number;
    net: number;
  };
}

export interface URLParams {
  year?: string;
  coverage?: string;
  ageGroup?: string;
  taxRate?: string;
  totalAnnualCosts?: string;
  networkMix?: string;
  hsaContribution?: string;
  fsaContribution?: string;
}