import { Payments, PlanExecution } from "./plan-execution";
import { CoverageScope } from "./coverage-scope";
import { Service } from "./services";
import { PPO_70 } from "./plans";

describe('PlanExecution', () => {
  it('should calculate net cost', () => {
    const planExecution = new PlanExecution(PPO_70, CoverageScope.SINGLE, 0.25);
    planExecution.recordExpense(Service.OFFICE_VISIT_PCP, 100);
    // Make sure the out of pocket and total are $25
    expect(planExecution.payments.outOfPocket).toEqual(25);
  });
});

