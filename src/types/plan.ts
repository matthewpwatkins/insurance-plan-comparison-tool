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
  is_free?: boolean;
}

export interface NetworkBenefits {
  in_network_coverage?: CostStructure;
  out_of_network_coverage?: CostStructure;
}

export interface Category {
  name: string;
  description?: string;
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

export interface CategoriesData {
  [categoryId: string]: Category;
}