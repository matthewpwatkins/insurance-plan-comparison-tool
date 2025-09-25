import { HealthPlan } from './plan';

export interface HSAContributionLimits {
  single_coverage: number;
  family_coverage: number;
  catch_up_age_55_plus: number;
}

export interface FSAContributionLimits {
  healthcare_fsa: number;
}

export interface PlanData {
  year: number;
  hsa_contribution_limits: HSAContributionLimits;
  fsa_contribution_limits: FSAContributionLimits;
  plans: HealthPlan[];
}