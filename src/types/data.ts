import { HealthPlan } from './plan';
import { CompanyData } from './company';

export interface HSAContributionLimits {
  single_coverage: number;
  family_coverage: number;
  catch_up_age_55_plus: number;
}

export interface FSAContributionLimits {
  healthcare_fsa: number;
}

export interface PayrollTaxRates {
  social_security: number;
  medicare: number;
}

export interface PlanData {
  year: number;
  hsa_contribution_limits: HSAContributionLimits;
  fsa_contribution_limits: FSAContributionLimits;
  payroll_tax_rates: PayrollTaxRates;
  plans: HealthPlan[];
  company?: CompanyData;
}