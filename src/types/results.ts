export interface LedgerEntry {
  description: string;
  amount: number; // Positive for income/credits, negative for expenses
  deductibleRemaining: number;
  outOfPocketRemaining: number;
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
  ledger: LedgerEntry[];
}