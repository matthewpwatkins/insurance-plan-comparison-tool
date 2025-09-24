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

export interface OfficeVisitCosts {
  pcp: number | string;
  specialist: number | string;
}

export interface NetworkCosts {
  in_network: OfficeVisitCosts;
  out_of_network: OfficeVisitCosts;
}

export interface PharmacyTier {
  retail_30: number | string;
  retail_90: number | string;
  mail_90: number | string;
}

export interface PharmacyCosts {
  tier_1: PharmacyTier;
  tier_2: PharmacyTier;
  tier_3: PharmacyTier;
  specialty: {
    tier_1: number;
    tier_2: number;
  };
}

export interface ImagingCosts {
  facility: string;
  professional: string;
}

export interface NetworkImaging {
  in_network: ImagingCosts;
  out_of_network: ImagingCosts;
}

export interface TherapyCosts {
  outpatient: number | string;
  inpatient?: string;
  inpatient_eval?: string;
}

export interface NetworkTherapy {
  in_network: TherapyCosts;
  out_of_network: TherapyCosts;
}

export interface TelemedicineCosts extends OfficeVisitCosts {
  urgent_care?: number | string;
}

export interface NetworkTelemedicine {
  in_network: TelemedicineCosts;
  out_of_network: TelemedicineCosts;
}

export interface WellnessExamCosts {
  adult?: number;
  child?: number;
  pcp?: number | string;
  specialist?: number | string;
}

export interface NetworkWellness {
  in_network: WellnessExamCosts;
  out_of_network?: WellnessExamCosts;
}

export interface HealthPlan {
  name: string;
  type: 'PPO' | 'HSA';
  monthly_premiums: PlanPremiums;
  annual_deductible: PlanDeductible;
  office_visit: NetworkCosts;
  preventive?: NetworkWellness;
  wellness_exam?: NetworkWellness;
  telemedicine: NetworkTelemedicine;
  eye_exams: NetworkCosts;
  behavioral_mental_health_outpatient: NetworkCosts;
  laboratory_outpatient: number | string;
  emergency_room: string;
  pharmacy: PharmacyCosts;
  imaging_diagnostic: NetworkImaging;
  hospital_inpatient: NetworkCosts;
  maternity_inpatient: NetworkCosts;
  behavioral_mental_health_inpatient: NetworkCosts;
  imaging_advanced: NetworkImaging;
  surgery: NetworkCosts;
  maternity_physician: NetworkCosts;
  aba_therapy: NetworkCosts;
  physical_therapy: NetworkTherapy;
  occupational_therapy: NetworkTherapy;
  chiropractic_therapy: NetworkCosts;
  speech_therapy: NetworkTherapy;
  durable_medical_equipment: NetworkCosts;
  out_of_pocket_maximum: PlanOutOfPocket;
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