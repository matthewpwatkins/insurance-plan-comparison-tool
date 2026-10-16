import { HealthPlan, CategoriesData } from './plan';

export interface HSAContributionLimits {
  single_coverage: number;
  family_coverage: number;
  catch_up_age_55_plus: number;
}

export interface FSAContributionLimits {
  healthcare_fsa: number;
  /** Most unused money that rolls into the next plan year */
  carryover: number;
}

export interface HSAQualificationLimits {
  minimum_deductible: {
    single: number;
    family: number;
  };
  maximum_out_of_pocket: {
    single: number;
    family: number;
  };
}

export interface PayrollTaxRates {
  social_security: number;
  medicare: number;
}

export interface PlanData {
  year: number;
  hsa_contribution_limits: HSAContributionLimits;
  hsa_qualification_limits: HSAQualificationLimits;
  fsa_contribution_limits: FSAContributionLimits;
  payroll_tax_rates: PayrollTaxRates;
  /** Expected yearly healthcare price growth going into this year, in percent */
  healthcare_price_increase: number;
  plans: HealthPlan[];
  categories: CategoriesData;
}

export interface ClaimsPortal {
  name: string;
  url: string;
  steps?: string[];
}

export interface CostEstimator {
  provider: string;
  name: string;
  url: string;
}

export interface AIAssistant {
  name: string;
  url: string;
  note?: string;
}

/** How to turn the company's downloadable claims report into cost estimates */
export interface ClaimsReport {
  /** Which reader understands the report's layout, e.g. "dmba-eob" */
  format: string;
  /** Insurer service label to candidate category ids; the first is the default */
  service_map: Record<string, string[]>;
  /** Same as service_map, for charges the report marks as preventive */
  preventive_map?: Record<string, string[]>;
  /** Labels whose cost belongs with the main service on the same claim, like supplies */
  add_to_main_service?: string[];
}

export interface Company {
  slug: string;
  name: string;
  insurer_name?: string;
  welcome?: string;
  /** Plan year selected by default; the newest year when unset */
  default_year?: number;
  fsa_name?: string;
  claims_portal?: ClaimsPortal;
  cost_estimator?: CostEstimator;
  ai_assistant?: AIAssistant;
  claims_report?: ClaimsReport;
}
