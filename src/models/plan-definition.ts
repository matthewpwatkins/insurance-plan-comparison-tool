import { CoverageScope } from "./coverage-scope";
import { Service } from "./services";

export type PlanDefinition = {
  name: string;
  premiums: Record<CoverageScope, number>;
  deductibles: Record<CoverageScope, number>;
  outOfPocketMaximums: Record<CoverageScope, number>;
  employerHealthAccountContributions: Record<CoverageScope, number>;
  healthAccountLimits: Record<CoverageScope, number>;
  defaultServiceRate: ServiceRate;
  serviceRates: Partial<Record<Service, ServiceRate>>;
};

export function getServiceRate(plan: PlanDefinition, serviceName: Service): ServiceRate {
  return plan.serviceRates[serviceName] || plan.defaultServiceRate;
}
export interface ServiceRate {
  isFree?: boolean;
  copay?: number;
  coinsurance?: number;
  max_oop?: number;
}
