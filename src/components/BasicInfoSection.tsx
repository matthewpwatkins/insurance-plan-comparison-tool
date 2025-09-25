import React, { useEffect } from 'react';
import { Card, Form, Row, Col, InputGroup } from 'react-bootstrap';
import { getMaxHSAContribution, getMaxFSAContribution, getEmployerHSAContribution, getAvailableDataYears } from '../services/planDataService';
import { formatNumber } from '../utils/formatters';
import FormattedNumberInput from './FormattedNumberInput';
import HelpIcon from './HelpIcon';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons';
import { UserInputs, PlanData } from '../types';
import { FAQButtonRef } from './FAQButton';

interface BasicInfoSectionProps {
  inputs: UserInputs;
  onChange: (updates: Partial<UserInputs>) => void;
  planData: PlanData | null;
  faqRef?: FAQButtonRef | null;
}

const BasicInfoSection: React.FC<BasicInfoSectionProps> = ({ inputs, onChange, planData, faqRef }) => {
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
            <Col md={6}>
              <Form.Group>
                <Form.Label className="position-relative">
                  Coverage Year
                  <HelpIcon
                    title="Coverage Year"
                    content={
                      <div>
                        <p>Select the year for which you want to compare health plans.</p>
                        <p>Different years may have different:</p>
                        <ul>
                          <li>Premium costs</li>
                          <li>HSA/FSA contribution limits</li>
                          <li>Plan coverage details</li>
                          <li>Employer HSA contributions</li>
                        </ul>
                        <p>Choose the year when your coverage will be active.</p>
                      </div>
                    }
                  />
                </Form.Label>
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
                <Form.Label className="position-relative">
                  Coverage Type
                  <HelpIcon
                    title="Coverage Type"
                    content={
                      <div>
                        <p>Choose who will be covered under your health plan:</p>
                        <ul>
                          <li><strong>Single:</strong> Just you</li>
                          <li><strong>Two Party:</strong> You and one other person (spouse or child)</li>
                          <li><strong>Family:</strong> You and two or more family members</li>
                        </ul>
                        <p>Coverage type affects:</p>
                        <ul>
                          <li>Monthly premium costs</li>
                          <li>Deductible amounts</li>
                          <li>Out-of-pocket maximums</li>
                          <li>HSA contribution limits</li>
                        </ul>
                      </div>
                    }
                  />
                </Form.Label>
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
            <Col md={6}>
              <Form.Group>
                <Form.Label className="position-relative">
                  Age Group
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
                <Form.Label className="position-relative">
                  Marginal Tax Rate
                  <span
                    className="text-info"
                    style={{
                      cursor: 'pointer',
                      fontSize: '1em',
                      position: 'absolute',
                      right: '0',
                      top: '2px'
                    }}
                    onClick={() => faqRef?.openFAQ(0)}
                    title="Click to see FAQ about tax rates"
                  >
                    <FontAwesomeIcon icon={faCircleQuestion} />
                  </span>
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

          <h5>HSA/FSA Contributions</h5>
          <Row className="mb-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label className="position-relative">
                  Your HSA Contribution
                  <small className="text-muted"> (Max: ${maxUserHSAContribution?.toLocaleString()})</small>
                  <HelpIcon
                    title="HSA Contribution"
                    content={
                      <div>
                        <p><strong>Health Savings Account (HSA)</strong> - Triple tax advantage:</p>
                        <ul>
                          <li><strong>Tax-deductible:</strong> Contributions reduce your taxable income</li>
                          <li><strong>Tax-free growth:</strong> Investment earnings aren't taxed</li>
                          <li><strong>Tax-free withdrawals:</strong> For qualified medical expenses</li>
                        </ul>
                        <p><strong>Key benefits:</strong></p>
                        <ul>
                          <li>Money rolls over year to year (no "use it or lose it")</li>
                          <li>Can be invested like a retirement account</li>
                          <li>After age 65, works like a traditional IRA</li>
                        </ul>
                        <p>Your employer contributes ${employerHSAContribution?.toLocaleString()}, so your max is ${maxUserHSAContribution?.toLocaleString()}.</p>
                        <p><em>Only available with HSA-eligible plans (high-deductible health plans).</em></p>
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
                    max={maxUserHSAContribution}
                    step={100}
                    required
                  />
                </InputGroup>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label className="position-relative">
                  Your FSA Contribution
                  <small className="text-muted"> (Max: ${maxFSAContribution?.toLocaleString()})</small>
                  <HelpIcon
                    title="FSA Contribution"
                    content={
                      <div>
                        <p><strong>Flexible Spending Account (FSA)</strong> - Tax-free healthcare spending:</p>
                        <ul>
                          <li><strong>Tax-deductible:</strong> Contributions reduce your taxable income</li>
                          <li><strong>Tax-free spending:</strong> Use for qualified medical expenses</li>
                          <li><strong>Immediate access:</strong> Full annual amount available at start of year</li>
                        </ul>
                        <p><strong>Important limitations:</strong></p>
                        <ul>
                          <li><strong>"Use it or lose it":</strong> Must spend by end of plan year (small carryover may be allowed)</li>
                          <li><strong>Cannot invest:</strong> Money doesn't grow like HSA</li>
                          <li><strong>PPO plans only:</strong> Can't have both FSA and HSA</li>
                        </ul>
                        <p>Best for predictable medical expenses you know you'll have during the year.</p>
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

export default BasicInfoSection;