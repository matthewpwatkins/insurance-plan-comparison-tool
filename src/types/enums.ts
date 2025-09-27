// Plan type enums
export enum PlanType {
  PPO = 'PPO',
  HSA = 'HSA',
  HRA = 'HRA'
}

// Coverage type enums
export enum CoverageType {
  SINGLE = 'single',
  TWO_PARTY = 'two_party',
  FAMILY = 'family'
}

// Age group enums for HSA contribution limits
export enum AgeGroup {
  UNDER_55 = 'under_55',
  FIFTY_FIVE_PLUS = '55_plus'
}

// Contribution type enums
export enum ContributionType {
  HSA = 'HSA',
  FSA = 'FSA',
  HRA = 'HRA'
}

// Network type enums
export enum NetworkType {
  IN_NETWORK = 'in_network',
  OUT_OF_NETWORK = 'out_of_network'
}

// Coverage type display names
export const COVERAGE_TYPE_DISPLAY = {
  [CoverageType.SINGLE]: 'Individual',
  [CoverageType.TWO_PARTY]: 'Two Party',
  [CoverageType.FAMILY]: 'Family'
} as const;

// Age group display names
export const AGE_GROUP_DISPLAY = {
  [AgeGroup.UNDER_55]: 'Under 55',
  [AgeGroup.FIFTY_FIVE_PLUS]: '55+'
} as const;

// Plan type display names and colors
export const PLAN_TYPE_DISPLAY = {
  [PlanType.PPO]: {
    name: 'PPO',
    badgeColor: 'secondary'
  },
  [PlanType.HSA]: {
    name: 'HSA',
    badgeColor: 'primary'
  },
  [PlanType.HRA]: {
    name: 'HRA',
    badgeColor: 'info'
  }
} as const;