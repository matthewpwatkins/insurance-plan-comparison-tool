import { CoverageScope } from "./coverage-scope";
import { getServiceRate, PlanDefinition } from "./plan-definition";
import { Service } from "./services";

export class PlanExecution {
  private _planDefinition: PlanDefinition;
  private coverageScope: CoverageScope;
  private payments: Payments = new Payments();
  private gains: Gains = new Gains();

  constructor(plan: PlanDefinition, coverageScope: CoverageScope, participantTaxRate: number) {
    this._planDefinition = plan;
    this.coverageScope = coverageScope;

    this.payments.premiums = plan.premiums[coverageScope] * 12;
    this.gains.employerContribution = plan.employerHealthAccountContributions[coverageScope];
    // TODO: Allow participants to specify their own contribution
    const participantHsaContribution = plan.healthAccountLimits[coverageScope] - this.gains.employerContribution;
    this.gains.taxSavings = participantHsaContribution * participantTaxRate;
  }

  public get planDefinition(): PlanDefinition {
    return this._planDefinition;
  }

  public netCost(): number {
    return this.payments.total() - this.gains.total();
  }

  public recordExpense(service: Service, cost: number): void {
    if (this.oopRemaining() <= 0) {
      return;
    }

    const rate = getServiceRate(this._planDefinition, service);
    if (rate.isFree) {
      return;
    }

    let remainingCost = cost;

    // Apply any copays
    const applicableCopay = Math.min(rate.copay || 0, remainingCost, this.deductibleRemaining(), this.oopRemaining());
    this.payments.outOfPocket += applicableCopay;
    remainingCost -= applicableCopay;

    // Apply deductible
    const applicableDeductible = Math.min(this.deductibleRemaining(), remainingCost);
    this.payments.outOfPocket += applicableDeductible;
    remainingCost -= applicableDeductible;

    // Apply coinsurance
    const applicableCoinsurance = Math.min((rate.coinsurance || 0) * remainingCost, this.oopRemaining());
    this.payments.outOfPocket += applicableCoinsurance;

    // Insurance covers the rest
  }

  private oopRemaining(): number {
    return this._planDefinition.outOfPocketMaximums[this.coverageScope] - this.payments.outOfPocket;
  }

  private deductibleRemaining(): number {
    return this._planDefinition.deductibles[this.coverageScope] - this.payments.outOfPocket;
  }
}

export class Payments {
  public premiums: number = 0;
  public outOfPocket: number = 0;

  public total(): number {
    return this.premiums + this.outOfPocket;
  }
}

export class Gains {
  public employerContribution: number = 0;
  public taxSavings: number = 0;

  total(): number {
    return this.employerContribution + this.taxSavings;
  }
}