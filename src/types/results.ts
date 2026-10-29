import { ContributionType } from './plan';

export interface ContributionEntry {
  type: 'contribution' | 'savings';
  description: string;
  amount: number;
}

export interface PremiumEntry {
  type: 'premium';
  description: string;
  amount: number;
}

export interface ExpenseEntry {
  type: 'expense';
  network: 'in_network' | 'out_of_network';
  category: string;
  categoryDisplayName: string;
  isPreventive: boolean;
  isFree: boolean;
  isNotCovered?: boolean; // Care no plan pays toward, at full price
  billedAmount: number;
  copay?: number;
  employeeResponsibility: number;
  insuranceResponsibility: number;
  deductibleRemaining: number;
  outOfPocketRemaining: number;
  notes?: string;
}

export interface OrganizedLedger {
  contributionsAndSavings: ContributionEntry[];
  premiums: PremiumEntry[];
  /** In-network and out-of-network care in one list, since they share one deductible */
  expenses: ExpenseEntry[];
}

/** How much to put in an HSA or FSA on this plan, when it differs from what you entered */
export interface ContributionAdvice {
  recommendedLow: number;
  recommendedHigh: number; // The HSA limit for an HSA
  extraSavings: number; // More tax savings from raising your contribution to cover expected care
  maxSavings: number; // More tax savings from raising your contribution to the top of the range
  avoidedLoss: number; // FSA money you'd lose by putting in all you entered
  rollover: number; // Most unused FSA money that rolls into next year
}

export interface PlanResult {
  planName: string;
  contributionType: ContributionType;
  annualPremiums: number; // Premiums for the year
  netAnnualPremiums: number; // Premiums less the taxes skipped on them
  premiumDiscount: number; // Tax savings on premiums
  userContribution: number; // What the estimate assumes you put in
  enteredContribution: number; // What you said you'd put in at most, within the legal limit
  employerContribution: number;
  totalContributions: number;
  taxSavings: number; // HSA/FSA contribution tax savings only
  taxSavedOn: number; // The part of your contribution that earns this year's tax savings
  bestCaseTaxSavings: number; // Tax savings with no care beyond free care
  worstCaseTaxSavings: number; // Tax savings at the out-of-pocket max
  contributionAdvice?: ContributionAdvice;
  outOfPocketCosts: number; // Your share of care the plan covers
  uncoveredCosts: number; // Care no plan pays for, at full price
  uncoveredEligibleCosts: number; // The part of it HSA or FSA money can pay for
  totalCost: number;
  outOfPocketMax: number; // Plan's in-network out-of-pocket max for this coverage
  maxAnnualCost: number; // Maximum possible cost in worst-case scenario (at OOP max)
  breakdown: {
    premiums: number;
    premiumDiscount: number;
    contributionTaxSavings: number; // HSA/FSA contribution tax savings
    employerContribution: number;
    outOfPocket: number;
    uncovered: number;
    net: number;
  };
  ledger: OrganizedLedger;
}
