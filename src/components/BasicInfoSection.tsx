import React, { useEffect } from 'react';
import { Card, Form, Row, Col, InputGroup } from 'react-bootstrap';
import { getMaxHSAContribution, getMaxFSAContribution, getEmployerHSAContribution, getAvailableDataYears } from '../services/planDataService';
import { formatNumber } from '../utils/formatters';
import FormattedNumberInput from './FormattedNumberInput';
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
            <Col md={6}>
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
            <Col md={6}>
              <Form.Group>
                <Form.Label>Age Group</Form.Label>
                <Form.Select
                  value={inputs.ageGroup}
                  onChange={(e) => handleChange('ageGroup', e.target.value)}
                >
                  <option value="under_55">Under 55</option>
                  <option value="55_plus">55+</option>
                </Form.Select>
                <Form.Text className="text-muted">
                  55+ allows additional HSA catch-up contributions
                </Form.Text>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Marginal Tax Rate</Form.Label>
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
                <Form.Text className="text-muted">
                  Your combined federal and state marginal tax rate
                </Form.Text>
              </Form.Group>
            </Col>
          </Row>

          <hr />

          <h5>HSA/FSA Contributions</h5>
          <Row className="mb-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>
                  Your HSA Contribution
                  <small className="text-muted"> (Max: ${maxUserHSAContribution?.toLocaleString()})</small>
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
                <Form.Text className="text-muted">
                  Maximum after employer contribution (${employerHSAContribution?.toLocaleString()}). Only applies to HSA plans.
                </Form.Text>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>
                  Your FSA Contribution
                  <small className="text-muted"> (Max: ${maxFSAContribution?.toLocaleString()})</small>
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
                <Form.Text className="text-muted">
                  Only applies to PPO plans (can't have both HSA and FSA)
                </Form.Text>
              </Form.Group>
            </Col>
          </Row>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default BasicInfoSection;