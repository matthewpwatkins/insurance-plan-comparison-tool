import React from 'react';
import { Card, Form, Row, Col, InputGroup } from 'react-bootstrap';
import { getAvailableDataYears } from '../services/planDataService';
import FormattedNumberInput from './FormattedNumberInput';
import HelpIcon from './HelpIcon';
import { UserInputs, PlanData, CoverageType, AgeGroup, COVERAGE_TYPE_DISPLAY, AGE_GROUP_DISPLAY } from '../types';

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
                  <option value={CoverageType.SINGLE}>{COVERAGE_TYPE_DISPLAY[CoverageType.SINGLE]}</option>
                  <option value={CoverageType.TWO_PARTY}>{COVERAGE_TYPE_DISPLAY[CoverageType.TWO_PARTY]}</option>
                  <option value={CoverageType.FAMILY}>{COVERAGE_TYPE_DISPLAY[CoverageType.FAMILY]}</option>
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
                  <option value={AgeGroup.UNDER_55}>{AGE_GROUP_DISPLAY[AgeGroup.UNDER_55]}</option>
                  <option value={AgeGroup.FIFTY_FIVE_PLUS}>{AGE_GROUP_DISPLAY[AgeGroup.FIFTY_FIVE_PLUS]}</option>
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
        </Form>
      </Card.Body>
    </Card>
  );
};

export default BasicInfoSection;