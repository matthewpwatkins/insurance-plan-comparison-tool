import { CoverageScope } from "./coverage-scope";
import { Service } from "./services";

export type UserSelections = {
  taxRate: number;
  coverageScope: CoverageScope;
  expenses: ExpenseEstimate[];
};

export const DefaultUserSelections: UserSelections = {
  taxRate: .24,
  coverageScope: CoverageScope.FAMILY,
  expenses: [
  //   {
  //   service: Service.TELEMEDICINE_PCP,
  //   quantity: 6,
  //   cost: 70
  // }
  ]
};

export type ExpenseEstimate = {
  service: Service,
  quantity: number,
  cost: number
};