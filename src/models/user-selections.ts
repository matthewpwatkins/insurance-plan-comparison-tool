import { CoverageScope } from "./coverage-scope";
import { Service } from "./services";

export type UserSelections = {
  taxRate: number;
  coverageScope: CoverageScope;
  expenses: ExpenseEstimate[];
};

export type ExpenseEstimate = {
  service: Service,
  quantity: number,
  cost: number
};