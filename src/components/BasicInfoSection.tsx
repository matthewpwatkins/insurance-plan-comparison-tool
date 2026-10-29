import React from 'react';
import { Form, Row, Col, InputGroup } from 'react-bootstrap';
import { getAvailableDataYears } from '../services/planDataService';
import FormattedNumberInput from './FormattedNumberInput';
import CollapsibleCard from './CollapsibleCard';
import HelpIcon from './HelpIcon';
import TaxRateGuide from './TaxRateGuide';
import PeopleList from './PeopleList';
import { peopleCount } from '../utils/people';
import { UserInputs, PlanData, Company, CoverageType } from '../types';

interface BasicInfoSectionProps {
  /** Whether the section starts open */
  defaultOpen?: boolean;
  inputs: UserInputs;
  onChange: (updates: Partial<UserInputs>) => void;
  planData: PlanData | null;
  company: Company;
}

const COVERAGE_LABELS: Record<CoverageType, string> = {
  [CoverageType.Single]: 'Single',
  [CoverageType.TwoParty]: 'Two party',
  [CoverageType.Family]: 'Family',
};

const BasicInfoSection: React.FC<BasicInfoSectionProps> = ({
  inputs,
  onChange,
  company,
  defaultOpen,
}) => {
  const handleChange = (field: keyof UserInputs, value: any) => {
    onChange({ [field]: value });
  };

  const availableYears = getAvailableDataYears(company.slug);

  return (
    <CollapsibleCard
      title="Basic Information"
      summary={`${inputs.year} · ${peopleCount(inputs)} ${peopleCount(inputs) === 1 ? 'person' : 'people'} · ${inputs.taxRate}% tax`}
      defaultOpen={defaultOpen}
    >
      <Form>
        <Row className="mb-3">
          <Col md={6} className="mb-3 mb-md-0">
            <Form.Group>
              <Form.Label>Coverage Year</Form.Label>
              <Form.Select
                value={inputs.year}
                onChange={e => handleChange('year', parseInt(e.target.value))}
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label>
                Who's covered{' '}
                <span className="text-muted small">
                  ({COVERAGE_LABELS[inputs.coverage]} coverage)
                </span>
              </Form.Label>
              <PeopleList inputs={inputs} onChange={onChange} size="sm" />
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
                        <li>
                          <strong>Under 55:</strong> Standard HSA contribution limits apply
                        </li>
                        <li>
                          <strong>55+:</strong> You're eligible for additional "catch-up" HSA
                          contributions of $1,000 per year
                        </li>
                      </ul>
                      <p>
                        This only affects HSA plans. If you or your spouse will turn 55 during the
                        coverage year, select "55+" to maximize your tax savings.
                      </p>
                    </div>
                  }
                />
              </Form.Label>
              <Form.Select
                value={inputs.ageGroup}
                onChange={e => handleChange('ageGroup', e.target.value)}
              >
                <option value="under_55">Under 55</option>
                <option value="55_plus">55+</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label className="d-flex justify-content-between">
                <span>Combined Income Tax Rate</span>
                <HelpIcon
                  title="Combined Income Tax Rate"
                  content={
                    <div>
                      <p>
                        Premiums and HSA/FSA contributions come out of your paycheck before taxes,
                        so a higher tax rate means bigger savings.
                      </p>
                      <TaxRateGuide />
                    </div>
                  }
                />
              </Form.Label>
              <InputGroup>
                <FormattedNumberInput
                  value={inputs.taxRate}
                  onChange={value => handleChange('taxRate', value)}
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
    </CollapsibleCard>
  );
};

export default BasicInfoSection;
