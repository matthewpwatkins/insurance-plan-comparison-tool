import { CoverageScope } from "./coverage-scope";
import { getServiceRate, PlanDefinition } from "./plan-definition";
import { Service } from "./services";

export class PlanExecution {
  private _planDefinition: PlanDefinition;
  private _coverageScope: CoverageScope;
  private _participantHealthAccountContribution: number;
  private _payments: Payments = new Payments();
  private _gains: Gains = new Gains();

  // TODO: Allow participants to specify their own contribution
  constructor(plan: PlanDefinition, coverageScope: CoverageScope, participantTaxRate: number) {
    this._planDefinition = plan;
    this._coverageScope = coverageScope;
    this._payments.premiums = plan.premiums[coverageScope] * 12;
    this._gains.employerHealthAccountContribution = plan.employerHealthAccountContributions[coverageScope];
    this._participantHealthAccountContribution = plan.healthAccountLimits[coverageScope] - this._gains.employerHealthAccountContribution;
    this._gains.taxSavings = this._participantHealthAccountContribution * participantTaxRate;
  }

  public get planDefinition(): PlanDefinition {
    return this._planDefinition;
  }

  public get coverageScope(): CoverageScope {
    return this._coverageScope;
  }

  public get participantHealthAccountContribution(): number {
    return this._participantHealthAccountContribution;
  }

  public get payments(): Payments {
    return this._payments;
  }

  public get gains(): Gains {
    return this._gains;
  }

  public netCost(): number {
    return this._payments.total() - this._gains.total();
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
    const rateCopay = rate.copay || 0;
    const deductibleApplicableForCopay = this.deductibleRemaining() > 0 ? this.deductibleRemaining() : Number.POSITIVE_INFINITY;
    const applicableCopay = Math.min(rateCopay, remainingCost, deductibleApplicableForCopay, this.oopRemaining());
    this._payments.outOfPocket += applicableCopay;
    remainingCost -= applicableCopay;

    // Apply deductible
    const applicableDeductible = Math.min(this.deductibleRemaining(), remainingCost);
    this._payments.outOfPocket += applicableDeductible;
    remainingCost -= applicableDeductible;

    // Apply coinsurance
    const applicableCoinsurance = Math.min((rate.coinsurance || 0) * remainingCost, this.oopRemaining());
    this._payments.outOfPocket += applicableCoinsurance;

    // Insurance covers the rest
  }

  private oopRemaining(): number {
    return this._planDefinition.outOfPocketMaximums[this._coverageScope] - this._payments.outOfPocket;
  }

  private deductibleRemaining(): number {
    return Math.max(0, this._planDefinition.deductibles[this._coverageScope] - this._payments.outOfPocket);
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
  public employerHealthAccountContribution: number = 0;
  public taxSavings: number = 0;

  total(): number {
    return this.employerHealthAccountContribution + this.taxSavings;
  }
}