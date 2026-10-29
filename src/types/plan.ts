export enum ContributionType {
  HSA = 'HSA',
  FSA = 'FSA',
}

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
  requires_deductible_to_be_met?: boolean;
  contributes_to_deductible?: boolean;
  contributes_to_out_of_pocket_max?: boolean;
  qty_cap?: number;
  cost_cap?: number;
}

export interface NetworkBenefits {
  in_network_coverage?: CostStructure;
  out_of_network_coverage?: CostStructure;
  qty_cap?: number;
  /** The plan covers visits past qty_cap once preauthorized, so the limit is only a note */
  extra_visits_with_preauthorization?: boolean;
  cost_cap?: number;
}

export interface Category {
  name: string;
  description?: string;
  preventive?: boolean;
  notes?: string[];
  /** False for costs no plan pays, which skip the deductible and out-of-pocket max (default true) */
  covered_by_insurance?: boolean;
  /** Whether HSA or FSA money can pay for it (default true) */
  hsa_fsa_eligible?: boolean;
}

export interface HealthPlan {
  name: string;
  short_name: string;
  chart_color?: string;
  monthly_premiums: PlanPremiums;
  annual_deductible: PlanDeductible;
  out_of_pocket_maximum: PlanOutOfPocket;
  default: NetworkBenefits;
  categories: Record<string, NetworkBenefits | undefined>;
  employer_hsa_contribution?: PlanPremiums;
  prescriptions_subject_to_deductible?: boolean;
  premiums_are_pre_tax?: boolean; // Defaults to true - indicates premiums paid through Section 125 cafeteria plan
}

export interface CategoriesData {
  [categoryId: string]: Category;
}
