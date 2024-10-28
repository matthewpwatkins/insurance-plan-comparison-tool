import { Service } from "./services";
import { PlanDefinition } from "./plan-definition";
import { CoverageScope } from "./coverage-scope";

const COMMON_SERVICE_RATES = {
  [Service.PREVENTIVE_ROUTINE_WELL_EXAM]: { isFree: true },
  [Service.PREVENTIVE_COLORECTAL_SCREENING]: { isFree: true },
  [Service.PREVENTIVE_IMMUNIZATIONS]: { isFree: true },
  [Service.PREVENTIVE_LAB_OUTPATIENT]: { isFree: true },
  [Service.PREVENTIVE_MAMMOGRAM]: { isFree: true },
  [Service.PREVENTIVE_MATERNITY_PHYSICIAN]: { isFree: true },
  [Service.PREVENTIVE_OSTEOPOROSIS_SCREENING]: { isFree: true },
  [Service.PREVENTIVE_OTHER]: { isFree: true },
};

export const PPO_90: PlanDefinition = {
  name: 'PPO 90',
  premiums: {
    [CoverageScope.SINGLE]: 245.30,
    [CoverageScope.TWO_PARTY]: 499.70,
    [CoverageScope.FAMILY]: 793.70
  },
  deductibles: {
    [CoverageScope.SINGLE]: 0,
    [CoverageScope.TWO_PARTY]: 0,
    [CoverageScope.FAMILY]: 0
  },
  outOfPocketMaximums: {
    [CoverageScope.SINGLE]: 3000,
    [CoverageScope.TWO_PARTY]: 6000,
    [CoverageScope.FAMILY]: 6000
  },
  defaultServiceRate: {
    coinsurance: 0.1
  },
  serviceRates: {
    ...COMMON_SERVICE_RATES,
    [Service.ACUPUNCTURE]: { copay: 35 },
    [Service.AUDIOLOGY_EXAM_PCP]: { copay: 25 },
    [Service.AUDIOLOGY_EXAM_SPECIALIST]: { copay: 35 },
    [Service.BEHAVIORAL_HEALTH_OUTPATIENT]: { copay: 25 },
    [Service.CHIROPRACTIC_THERAPY]: { copay: 35 },
    [Service.EMERGENCY_ROOM]: { copay: 150, coinsurance: 0.1 },
    [Service.EYE_EXAM]: { copay: 35 },
    [Service.GENETIC_COUNSELING_PCP]: { copay: 25 },
    [Service.GENETIC_COUNSELING_SPECIALIST]: { copay: 35 },
    [Service.GENETIC_TESTING]: { isFree: true },
    [Service.HEARING_EXAM_PCP]: { copay: 25 },
    [Service.HEARING_EXAM_SPECIALIST]: { copay: 35 },
    [Service.PREVENTIVE_LAB_OUTPATIENT]: { isFree: true },
    [Service.LIFESTYLE_SCREENING]: { copay: 25 },
    [Service.OCCUPATIONAL_THERAPY_OUTPATIENT]: { copay: 35 },
    [Service.OFFICE_VISIT_PCP]: { copay: 25 },
    [Service.OFFICE_VISIT_PCP_AFTER_HOURS]: { copay: 30 },
    [Service.OFFICE_VISIT_SPECIALIST]: { copay: 35 },
    [Service.OFFICE_VISIT_SPECIALIST_AFTER_HOURS]: { copay: 40 },
    [Service.PHYSICAL_THERAPY_OUTPATIENT]: { copay: 35 },
    [Service.SPEECH_THERAPY_OUTPATIENT]: { copay: 35 },
    [Service.TELEMEDICINE_PCP]: { copay: 25 },
    [Service.TELEMEDICINE_SPECIALIST]: { copay: 35 },
    [Service.TELEMEDICINE_URGENT_CARE]: { copay: 45 },
    [Service.URGENT_CARE]: { copay: 45 },
    [Service.PRESCRIPTIONS_TIER_1_30_DAY]: { copay: 10 },
    [Service.PRESCRIPTIONS_TIER_1_90_DAY]: { copay: 20 },
    [Service.PRESCRIPTIONS_TIER_1_90_DAY_MAIL_ORDER]: { copay: 15 },
    [Service.PRESCRIPTIONS_TIER_2_30_DAY]: { coinsurance: 0.2, max_oop: 60 },
    [Service.PRESCRIPTIONS_TIER_2_90_DAY]: { coinsurance: 0.2, max_oop: 150 },
    [Service.PRESCRIPTIONS_TIER_2_90_DAY_MAIL_ORDER]: { coinsurance: 0.2, max_oop: 120 },
    [Service.PRESCRIPTIONS_TIER_3_30_DAY]: { coinsurance: 0.4, max_oop: 100 },
    [Service.PRESCRIPTIONS_TIER_3_90_DAY]: { coinsurance: 0.4, max_oop: 240 },
    [Service.PRESCRIPTIONS_TIER_3_90_DAY_MAIL_ORDER]: { coinsurance: 0.4, max_oop: 200 },
  }
};

export const PPO_70: PlanDefinition = {
  name: 'PPO 70',
  premiums: {
    [CoverageScope.SINGLE]: 101.20,
    [CoverageScope.TWO_PARTY]: 205.70,
    [CoverageScope.FAMILY]: 322.40
  },
  deductibles: {
    [CoverageScope.SINGLE]: 0,
    [CoverageScope.TWO_PARTY]: 0,
    [CoverageScope.FAMILY]: 0
  },
  outOfPocketMaximums: {
    [CoverageScope.SINGLE]: 5000,
    [CoverageScope.TWO_PARTY]: 8000,
    [CoverageScope.FAMILY]: 8000
  },
  defaultServiceRate: {
    coinsurance: 0.3
  },
  serviceRates: {
    ...COMMON_SERVICE_RATES,
    [Service.ACUPUNCTURE]: { copay: 35 },
    [Service.AUDIOLOGY_EXAM_PCP]: { copay: 25 },
    [Service.AUDIOLOGY_EXAM_SPECIALIST]: { copay: 35 },
    [Service.BEHAVIORAL_HEALTH_OUTPATIENT]: { copay: 25 },
    [Service.CHIROPRACTIC_THERAPY]: { copay: 35 },
    [Service.EMERGENCY_ROOM]: { copay: 150, coinsurance: 0.3 },
    [Service.EYE_EXAM]: { copay: 35 },
    [Service.GENETIC_COUNSELING_PCP]: { copay: 25 },
    [Service.GENETIC_COUNSELING_SPECIALIST]: { copay: 35 },
    [Service.GENETIC_TESTING]: { isFree: true },
    [Service.HEARING_EXAM_PCP]: { copay: 25 },
    [Service.HEARING_EXAM_SPECIALIST]: { copay: 35 },
    [Service.PREVENTIVE_LAB_OUTPATIENT]: { isFree: true },
    [Service.LIFESTYLE_SCREENING]: { copay: 25 },
    [Service.OCCUPATIONAL_THERAPY_OUTPATIENT]: { copay: 35 },
    [Service.OFFICE_VISIT_PCP]: { copay: 25 },
    [Service.OFFICE_VISIT_PCP_AFTER_HOURS]: { copay: 30 },
    [Service.OFFICE_VISIT_SPECIALIST]: { copay: 35 },
    [Service.OFFICE_VISIT_SPECIALIST_AFTER_HOURS]: { copay: 40 },
    [Service.PHYSICAL_THERAPY_OUTPATIENT]: { copay: 35 },
    [Service.SPEECH_THERAPY_OUTPATIENT]: { copay: 35 },
    [Service.TELEMEDICINE_PCP]: { copay: 25 },
    [Service.TELEMEDICINE_SPECIALIST]: { copay: 35 },
    [Service.TELEMEDICINE_URGENT_CARE]: { copay: 45 },
    [Service.URGENT_CARE]: { copay: 45 },
    [Service.PRESCRIPTIONS_TIER_1_30_DAY]: { copay: 10 },
    [Service.PRESCRIPTIONS_TIER_1_90_DAY]: { copay: 25 },
    [Service.PRESCRIPTIONS_TIER_1_90_DAY_MAIL_ORDER]: { copay: 20 },
    [Service.PRESCRIPTIONS_TIER_2_30_DAY]: { coinsurance: 0.3, max_oop: 75 },
    [Service.PRESCRIPTIONS_TIER_2_90_DAY]: { coinsurance: 0.3, max_oop: 200 },
    [Service.PRESCRIPTIONS_TIER_2_90_DAY_MAIL_ORDER]: { coinsurance: 0.3, max_oop: 150 },
    [Service.PRESCRIPTIONS_TIER_3_30_DAY]: { coinsurance: 0.5, max_oop: 125 },
    [Service.PRESCRIPTIONS_TIER_3_90_DAY]: { coinsurance: 0.5, max_oop: 300 },
    [Service.PRESCRIPTIONS_TIER_3_90_DAY_MAIL_ORDER]: { coinsurance: 0.5, max_oop: 250 },
  }
};

export const HSA_80: PlanDefinition = {
  name: 'HSA 80',
  premiums: {
    [CoverageScope.SINGLE]: 97.40,
    [CoverageScope.TWO_PARTY]: 199.40,
    [CoverageScope.FAMILY]: 248.70
  },
  deductibles: {
    [CoverageScope.SINGLE]: 1650,
    [CoverageScope.TWO_PARTY]: 3300,
    [CoverageScope.FAMILY]: 3300
  },
  outOfPocketMaximums: {
    [CoverageScope.SINGLE]: 4500,
    [CoverageScope.TWO_PARTY]: 8000,
    [CoverageScope.FAMILY]: 8000
  },
  defaultServiceRate: {
    coinsurance: 0.2
  },
  employerHsaContributions: {
    [CoverageScope.SINGLE]: 825,
    [CoverageScope.TWO_PARTY]: 1650,
    [CoverageScope.FAMILY]: 1650
  },
  serviceRates: {
    ...COMMON_SERVICE_RATES,
    [Service.PRESCRIPTIONS_TIER_1_30_DAY]: { copay: 5 },
    [Service.PRESCRIPTIONS_TIER_1_90_DAY]: { copay: 10 },
    [Service.PRESCRIPTIONS_TIER_1_90_DAY_MAIL_ORDER]: { copay: 7 },
    [Service.PRESCRIPTIONS_TIER_2_30_DAY]: { copay: 45 },
    [Service.PRESCRIPTIONS_TIER_2_90_DAY]: { copay: 115 },
    [Service.PRESCRIPTIONS_TIER_2_90_DAY_MAIL_ORDER]: { copay: 90 },
    [Service.PRESCRIPTIONS_TIER_3_30_DAY]: { copay: 90 },
    [Service.PRESCRIPTIONS_TIER_3_90_DAY]: { copay: 230 },
    [Service.PRESCRIPTIONS_TIER_3_90_DAY_MAIL_ORDER]: { copay: 180 },
  }
};

export const HSA_60: PlanDefinition = {
  name: 'HSA 60',
  premiums: {
    [CoverageScope.SINGLE]: 55.70,
    [CoverageScope.TWO_PARTY]: 91.90,
    [CoverageScope.FAMILY]: 111.60
  },
  deductibles: {
    [CoverageScope.SINGLE]: 3000,
    [CoverageScope.TWO_PARTY]: 6000,
    [CoverageScope.FAMILY]: 6000
  },
  outOfPocketMaximums: {
    [CoverageScope.SINGLE]: 7500,
    [CoverageScope.TWO_PARTY]: 15000,
    [CoverageScope.FAMILY]: 15000
  },
  defaultServiceRate: {
    coinsurance: 0.4
  },
  employerHsaContributions: {
    [CoverageScope.SINGLE]: 1500,
    [CoverageScope.TWO_PARTY]: 3000,
    [CoverageScope.FAMILY]: 3000
  },
  serviceRates: {
    ...COMMON_SERVICE_RATES,
    [Service.PRESCRIPTIONS_TIER_1_30_DAY]: { copay: 10 },
    [Service.PRESCRIPTIONS_TIER_1_90_DAY]: { copay: 20 },
    [Service.PRESCRIPTIONS_TIER_1_90_DAY_MAIL_ORDER]: { copay: 15 },
    [Service.PRESCRIPTIONS_TIER_2_30_DAY]: { copay: 90 },
    [Service.PRESCRIPTIONS_TIER_2_90_DAY]: { copay: 230 },
    [Service.PRESCRIPTIONS_TIER_2_90_DAY_MAIL_ORDER]: { copay: 180 },
    [Service.PRESCRIPTIONS_TIER_3_30_DAY]: { copay: 140 },
    [Service.PRESCRIPTIONS_TIER_3_90_DAY]: { copay: 310 },
    [Service.PRESCRIPTIONS_TIER_3_90_DAY_MAIL_ORDER]: { copay: 280 },
  }
};

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  PPO_90,
  PPO_70,
  HSA_80,
  HSA_60
];