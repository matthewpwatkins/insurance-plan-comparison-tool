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
}