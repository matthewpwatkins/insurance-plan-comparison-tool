import React from 'react';
import { Card, Form, Row, Col, InputGroup } from 'react-bootstrap';
import { getMaxHSAContribution, getMaxFSAContribution, getEmployerHSAContribution } from '../services/planDataService';
import { getCompanyTexts, getCompanyData } from '../generated/dataHelpers';
import { PlanType } from '../types/enums';
import FormattedNumberInput from './FormattedNumberInput';
import HelpIcon from './HelpIcon';
import { UserInputs, PlanData } from '../types';

interface HSAFSASectionProps {
  inputs: UserInputs;
  onChange: (updates: Partial<UserInputs>) => void;
  planData: PlanData | null;
}

const HSAFSASection: React.FC<HSAFSASectionProps> = ({ inputs, onChange, planData }) => {
  const handleChange = (field: keyof UserInputs, value: any) => {
    onChange({ [field]: value });
  };

  const getEmployerHSAContributionForDisplay = (): number => {
    if (!planData) return 0;

    const hsaPlans = planData.plans.filter(plan => plan.type === PlanType.HSA);
    if (hsaPlans.length === 0) return 0;

    // Get the minimum employer contribution across HSA plans (most conservative)
    const minEmployerContribution = Math.min(
      ...hsaPlans.map(plan => getEmployerHSAContribution(plan, inputs.coverage))
    );

    return minEmployerContribution;
  };

  const getMaxEmployerHSAContribution = (): number => {
    if (!planData) return 0;

    const hsaPlans = planData.plans.filter(plan => plan.type === PlanType.HSA);
    if (hsaPlans.length === 0) return 0;

    // Get the maximum employer contribution across HSA plans
    const maxEmployerContribution = Math.max(
      ...hsaPlans.map(plan => getEmployerHSAContribution(plan, inputs.coverage))
    );

    return maxEmployerContribution;
  };

  // Calculate contribution limits and employer contributions
  const maxTotalHSAContribution = planData
    ? getMaxHSAContribution(planData, inputs.coverage, inputs.ageGroup)
    : 0;
  const minEmployerHSAContribution = getEmployerHSAContributionForDisplay();
  const maxEmployerHSAContribution = getMaxEmployerHSAContribution();
  
  // Calculate max employee contribution for each HSA plan based on current coverage
  const hsaPlansWithEmployeeMax = planData
    ? planData.plans.filter(plan => plan.type === PlanType.HSA).map(plan => {
        const employerContribution = getEmployerHSAContribution(plan, inputs.coverage);
        const employeeMax = Math.max(0, maxTotalHSAContribution - employerContribution);
        return { name: plan.name, employeeMax };
      })
    : [];
  
  // Use the maximum employee contribution across all HSA plans for validation
  const maxEmployeeHSAContribution = hsaPlansWithEmployeeMax.length > 0
    ? Math.max(...hsaPlansWithEmployeeMax.map(p => p.employeeMax))
    : 0;

  const maxFSAContribution = planData ? getMaxFSAContribution(planData) : 0;

  return (
    <Card className="mb-4">
      <Card.Header>
        <h3 className="d-flex justify-content-between align-items-center">
          <span>Personal HSA/FSA Contributions</span>
          <HelpIcon
            title="Personal HSA/FSA Contributions"
            content={
              <div>
                <div className="alert alert-info mb-3">
                  <strong>Important:</strong> Each plan has <i>either</i> an HSA <i>or</i> an FSA.. To compare all plan options, this tool asks for both values as hypothetical scenarios: "If you chose an FSA plan, how much would you contribute?" and "If you chose an HSA plan, how much would you contribute?"
                </div>

                <h6><strong>Health Savings Account (HSA)</strong></h6>
                <p>This is the most powerful account you can ever own. It's <i>quadruple</i>-tax-advantaged:</p>
                <ul>
                  <li><strong>No payroll taxes:</strong> Contributions made through your paycheck are exempt from Social Security and Medicare taxes</li>
                  <li><strong>Tax-deductible:</strong> Contributions you make (out of pocket or through your paycheck) are exempt from this year's federal and State income taxes</li>
                  <li><strong>Tax-free growth:</strong> The money the account earns over time isn't taxed</li>
                  <li><strong>Tax-free withdrawals:</strong> No taxes when you spend the money, even decades in the future, so long as you have medical receipts to justify the withdraw</li>
                </ul>
                <p><strong>Key HSA benefits:</strong></p>
                <ul>
                  <li>Money rolls over year to year (no "use it or lose it")</li>
                  <li>Can be invested like a retirement account</li>
                  <li>After age 65, you get additional access as you can treat it like a personal retirement account</li>
                </ul>

                <p>So an HSA is amazing by itself, but what's even better is it comes with an employer contribution!</p>

                <h6><strong>HSA Contribution Limits ({inputs.year}):</strong></h6>
                <ul>
                  <li><strong>Individual:</strong> ${planData ? getMaxHSAContribution(planData, 'single', inputs.ageGroup).toLocaleString() : 'N/A'}</li>
                  <li><strong>Family:</strong> ${planData ? getMaxHSAContribution(planData, 'family', inputs.ageGroup).toLocaleString() : 'N/A'}</li>
                  {inputs.ageGroup === '55_plus' && <li><em>Includes $1,000 catch-up contribution for 55+</em></li>}
                </ul>

                <h6><strong>Employer HSA Contributions by Plan:</strong></h6>
                <ul>
                  {planData?.plans.filter(plan => plan.type === PlanType.HSA).map(plan => (
                    <li key={plan.name}>
                      <strong>{plan.name}:</strong>
                      <ul>
                        <li>Single: ${plan.employer_hsa_contribution?.single?.toLocaleString() || '0'}</li>
                        <li>Two Party: ${plan.employer_hsa_contribution?.two_party?.toLocaleString() || '0'}</li>
                        <li>Family: ${plan.employer_hsa_contribution?.family?.toLocaleString() || '0'}</li>
                      </ul>
                    </li>
                  )) || <li>No HSA plans available</li>}
                </ul>
                <p><em>Only available with HSA-eligible plans (high-deductible health plans).</em></p>

                <hr className="my-3" />

                <h6><strong>Flexible Spending Account (FSA)</strong></h6>
                <p>Tax-free healthcare spending for PPO plans:</p>
                <ul>
                  <li><strong>Tax-deductible:</strong> Your personal contributions reduce your taxable income</li>
                  <li><strong>Tax-free spending:</strong> when used for qualified medical expenses during this year</li>
                </ul>

                <h6><strong>FSA Contribution Limit ({inputs.year}):</strong></h6>
                <ul>
                  <li><strong>Annual Maximum:</strong> ${planData ? maxFSAContribution.toLocaleString() : 'N/A'}</li>
                  <li><em>Same limit applies regardless of coverage type (single/family)</em></li>
                </ul>

                <p><strong>Important FSA limitations:</strong></p>
                <ul>
                  <li><strong>"Use it or lose it":</strong> Must spend by end of plan year or your employment</li>
                  <li><strong>Process:</strong> Need qualifying documentation to reimburse yourself</li>
                  <li><strong>Contribution limits:</strong> Lower maximum contributions than HSAs</li>
                  <li><strong>No employer contributions:</strong> Unlike HSAs, FSAs typically do not have employer contributions</li>
                  <li><strong>No investment growth:</strong> FSAs do not earn interest and are not investable</li>
                </ul>
                <p>Best for predictable medical expenses you know you'll have during the year.</p>
              </div>
            }
          />
        </h3>
      </Card.Header>
      <Card.Body>
        <div className="mb-3">
          <small className="text-muted">
            <strong>Note:</strong> Each plan has <i>either</i> an HSA <i>or</i> an FSA. Enter the maximum amount you'd be willing to contribute from your paycheck to each account type for accurate plan comparison. The max amounts shown for the HSA plans are your own contributions, not including the free money from your employer.
          </small>
        </div>
        <Form>
          <Row className="mb-3">
            <Col md={6} className="mb-3 mb-md-0">
              <Form.Group>
                <Form.Label className="d-flex justify-content-between">
                  <span>HSA <small className="text-muted">({hsaPlansWithEmployeeMax.map(p => `${p.name.replace(`${getCompanyData().company.shortName} `, '')} Max: $${p.employeeMax.toLocaleString()}`).join(' | ')})</small></span>
                  <HelpIcon
                    title="HSA"
                    content={
                      <div>
                        <p><strong>If I went with an HSA plan, I'd put up to this amount in my HSA</strong> (do not include the employer match in this number).</p>
                        <p>Enter the maximum amount you're willing to contribute from your paycheck to an HSA account.</p>
                        <p><strong>Max: ${maxEmployeeHSAContribution?.toLocaleString()}</strong> - This accounts for the highest employee contribution possible across all coverage types and plan options</p>
                        <p>Your employer will contribute an additional <strong>${minEmployerHSAContribution?.toLocaleString()}</strong> to <strong>${maxEmployerHSAContribution?.toLocaleString()}</strong> depending on your plan choice.</p>
                        <p>Your contribution comes from your paycheck as pre-tax deductions, reducing your taxable income.</p>
                      </div>
                    }
                  />
                </Form.Label>
                <InputGroup>
                  <InputGroup.Text>$</InputGroup.Text>
                  <FormattedNumberInput
                    value={inputs.hsaContribution}
                    onChange={(value) => handleChange('hsaContribution', value)}
                    min={0}
                    max={maxEmployeeHSAContribution}
                    step={100}
                    required
                  />
                </InputGroup>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label className="d-flex justify-content-between">
                  <span>FSA <small className="text-muted">(Max: ${maxFSAContribution?.toLocaleString()})</small></span>
                  <HelpIcon
                    title="FSA"
                    content={
                      <div>
                        <p><strong>If I went with a PPO plan, I'd put this amount in {getCompanyTexts().fsaText}.</strong></p>
                        <p>Enter the maximum amount you're willing to contribute from your paycheck to an FSA account.</p>
                        <p><strong>Max: ${maxFSAContribution?.toLocaleString()}</strong> - IRS annual limit for FSA contributions</p>
                        <p>FSAs typically have no employer contributions - this is your personal contribution only.</p>
                        <p>Your contribution comes from your paycheck as pre-tax deductions, reducing your taxable income.</p>
                        <p><strong>Remember:</strong> FSAs are "use it or lose it" - funds must be spent by the end of the plan year.</p>
                      </div>
                    }
                  />
                </Form.Label>
                <InputGroup>
                  <InputGroup.Text>$</InputGroup.Text>
                  <FormattedNumberInput
                    value={inputs.fsaContribution}
                    onChange={(value) => handleChange('fsaContribution', value)}
                    min={0}
                    max={maxFSAContribution}
                    step={100}
                    required
                  />
                </InputGroup>
              </Form.Group>
            </Col>
          </Row>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default HSAFSASection;