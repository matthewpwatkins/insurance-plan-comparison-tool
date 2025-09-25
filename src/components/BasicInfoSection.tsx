import React, { useEffect } from 'react';
import { Card, Form, Row, Col, InputGroup } from 'react-bootstrap';
import { getMaxHSAContribution, getMaxFSAContribution, getEmployerHSAContribution, getAvailableDataYears } from '../services/planDataService';
import { formatNumber } from '../utils/formatters';
import FormattedNumberInput from './FormattedNumberInput';
import HelpIcon from './HelpIcon';
import { UserInputs, PlanData } from '../types';

interface BasicInfoSectionProps {
  inputs: UserInputs;
  onChange: (updates: Partial<UserInputs>) => void;
  planData: PlanData | null;
}

const BasicInfoSection: React.FC<BasicInfoSectionProps> = ({ inputs, onChange, planData }) => {
  const handleChange = (field: keyof UserInputs, value: any) => {
    onChange({ [field]: value });
  };

  const availableYears = getAvailableDataYears();

  const getEmployerHSAContributionForDisplay = (): number => {
    if (!planData) return 0;

    const hsaPlans = planData.plans.filter(plan => plan.type === 'HSA');
    if (hsaPlans.length === 0) return 0;

    // Get the minimum employer contribution across HSA plans (most conservative)
    const minEmployerContribution = Math.min(
      ...hsaPlans.map(plan => getEmployerHSAContribution(plan, inputs.coverage))
    );

    return minEmployerContribution;
  };

  // Calculate contribution limits and employer contributions
  const maxUserHSAContribution = planData
    ? getMaxHSAContribution(planData, inputs.coverage, inputs.ageGroup) - getEmployerHSAContributionForDisplay()
    : 0;

  const maxFSAContribution = planData ? getMaxFSAContribution(planData) : 0;

  const employerHSAContribution = getEmployerHSAContributionForDisplay();

  // Update default contribution values when dependencies change
  useEffect(() => {
    if (planData) {
      const newValues: Partial<UserInputs> = {};

      // Set default HSA contribution if it's currently 0 or null
      if (inputs.hsaContribution === 0 || inputs.hsaContribution === null) {
        newValues.hsaContribution = maxUserHSAContribution;
      }

      // Set default FSA contribution if it's currently 0 or null
      if (inputs.fsaContribution === 0 || inputs.fsaContribution === null) {
        newValues.fsaContribution = maxFSAContribution;
      }

      if (Object.keys(newValues).length > 0) {
        onChange(newValues);
      }
    }
  }, [planData, inputs.coverage, inputs.ageGroup, maxUserHSAContribution, maxFSAContribution, inputs.hsaContribution, inputs.fsaContribution, onChange]);

  return (
    <Card className="mb-4">
      <Card.Header>
        <h3>Basic Information</h3>
      </Card.Header>
      <Card.Body>
        <Form>
          <Row className="mb-3">
            <Col md={6} className="mb-3 mb-md-0">
              <Form.Group>
                <Form.Label>Coverage Year</Form.Label>
                <Form.Select
                  value={inputs.year}
                  onChange={(e) => handleChange('year', parseInt(e.target.value))}
                >
                  {availableYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Coverage Type</Form.Label>
                <Form.Select
                  value={inputs.coverage}
                  onChange={(e) => handleChange('coverage', e.target.value)}
                >
                  <option value="single">Single</option>
                  <option value="two_party">Two Party</option>
                  <option value="family">Family</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>

          <Row className="mb-3">
            <Col md={6} className="mb-3 mb-md-0">
              <Form.Group>
                <Form.Label className="d-flex justify-content-between">
                  <span>Age</span>
                  <HelpIcon
                    title="Age Group"
                    content={
                      <div>
                        <p>Select your age group to determine HSA contribution limits:</p>
                        <ul>
                          <li><strong>Under 55:</strong> Standard HSA contribution limits apply</li>
                          <li><strong>55+:</strong> You're eligible for additional "catch-up" HSA contributions of $1,000 per year</li>
                        </ul>
                        <p>This only affects HSA plans. If you or your spouse will turn 55 during the coverage year, select "55+" to maximize your tax savings.</p>
                      </div>
                    }
                  />
                </Form.Label>
                <Form.Select
                  value={inputs.ageGroup}
                  onChange={(e) => handleChange('ageGroup', e.target.value)}
                >
                  <option value="under_55">Under 55</option>
                  <option value="55_plus">55+</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label className="d-flex justify-content-between">
                  <span>Marginal Tax Rate</span>
                  <HelpIcon
                    title="Marginal Tax Rate"
                    content={
                      <div>
                        <p>Your marginal tax rate is the percentage of tax you pay on your last dollar of income.</p>
                        <p><strong>How to find your rate:</strong></p>
                        <ul>
                          <li>Check your most recent tax return or pay stub</li>
                          <li>Use online tax calculators</li>
                          <li>Consult with a tax professional</li>
                        </ul>
                        <p><strong>Why it matters:</strong></p>
                        <ul>
                          <li>HSA and FSA contributions reduce your taxable income</li>
                          <li>Higher tax rates = more savings from pre-tax contributions</li>
                          <li>This affects the true cost comparison between plans</li>
                        </ul>
                        <p><strong>Common rates:</strong> 12%, 22%, 24%, 32%, 35%, 37% (for federal income tax, plus state taxes if applicable)</p>
                      </div>
                    }
                  />
                </Form.Label>
                <InputGroup>
                  <FormattedNumberInput
                    value={inputs.taxRate}
                    onChange={(value) => handleChange('taxRate', value)}
                    min={0}
                    max={100}
                    step={0.5}
                    required
                  />
                  <InputGroup.Text>%</InputGroup.Text>
                </InputGroup>
              </Form.Group>
            </Col>
          </Row>

          <hr />

          <h5 className="d-flex justify-content-between align-items-center">
            <span>HSA/FSA Contributions</span>
            <HelpIcon
              title="HSA/FSA Contributions"
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
                    {planData?.plans.filter(plan => plan.type === 'HSA').map(plan => (
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
          </h5>
          <div className="mb-3">
            <small className="text-muted">
              <strong>Note:</strong> Each plan has <i>either</i> an HSA <i>or</i> an FSA. Specify how much you would contribute in each scenario to get an accurate comparison.
            </small>
          </div>
          <Row className="mb-3">
            <Col md={6} className="mb-3 mb-md-0">
              <Form.Group>
                <Form.Label>HSA <small className="text-muted">(Max: ${maxUserHSAContribution?.toLocaleString()})</small></Form.Label>
                <InputGroup>
                  <InputGroup.Text>$</InputGroup.Text>
                  <FormattedNumberInput
                    value={inputs.hsaContribution}
                    onChange={(value) => handleChange('hsaContribution', value)}
                    min={0}
                    max={maxUserHSAContribution}
                    step={100}
                    required
                  />
                </InputGroup>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>FSA <small className="text-muted">(Max: ${maxFSAContribution?.toLocaleString()})</small></Form.Label>
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

export default BasicInfoSection;