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
  inNetworkExpenses: ExpenseEntry[];
  outOfNetworkExpenses: ExpenseEntry[];
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
    employerContribution: number;
    outOfPocket: number;
    net: number;
  };
  ledger: OrganizedLedger;
}