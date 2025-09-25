import React, { useEffect, useState } from 'react';
import { Card, Form, Row, Col, InputGroup, Button, Badge } from 'react-bootstrap';
import { getMaxHSAContribution, getMaxFSAContribution, getEmployerHSAContribution, getAvailableDataYears } from '../services/planDataService';
import { getCategoriesData } from '../generated/dataHelpers';
import { formatNumber } from '../utils/formatters';
import FormattedNumberInput from './FormattedNumberInput';
import { UserInputs, PlanData, CategoryEstimate } from '../types';

interface CostInputFormProps {
  inputs: UserInputs;
  onChange: (updates: Partial<UserInputs>) => void;
  planData: PlanData | null;
}

const CostInputForm: React.FC<CostInputFormProps> = ({ inputs, onChange, planData }) => {
  const handleChange = (field: keyof UserInputs, value: any) => {
    onChange({ [field]: value });
  };

  const handleCostChange = (field: keyof UserInputs['costs'], value: any) => {
    onChange({
      costs: {
        ...inputs.costs,
        [field]: value
      }
    });
  };

  const [selectedCategoryToAdd, setSelectedCategoryToAdd] = useState<string>('');
  const categoriesData = getCategoriesData();

  const addCategory = () => {
    if (!selectedCategoryToAdd) return;

    const newEstimate: CategoryEstimate = {
      categoryId: selectedCategoryToAdd,
      inNetworkCost: 0,
      outOfNetworkCost: 0
    };

    handleCostChange('categoryEstimates', [...inputs.costs.categoryEstimates, newEstimate]);
    setSelectedCategoryToAdd('');
  };

  const removeCategory = (categoryId: string) => {
    const updatedEstimates = inputs.costs.categoryEstimates.filter(est => est.categoryId !== categoryId);
    handleCostChange('categoryEstimates', updatedEstimates);
  };

  const updateCategoryEstimate = (categoryId: string, field: 'inNetworkCost' | 'outOfNetworkCost', value: number) => {
    const updatedEstimates = inputs.costs.categoryEstimates.map(est =>
      est.categoryId === categoryId
        ? { ...est, [field]: value }
        : est
    );
    handleCostChange('categoryEstimates', updatedEstimates);
  };

  const updateOtherCosts = (field: 'inNetworkCost' | 'outOfNetworkCost', value: number) => {
    handleCostChange('otherCosts', {
      ...inputs.costs.otherCosts,
      [field]: value
    });
  };

  // Get available categories (not already added)
  const availableCategories = Object.keys(categoriesData).filter(
    categoryId => !inputs.costs.categoryEstimates.some(est => est.categoryId === categoryId)
  );

  // Calculate max contributions for display and defaults
  const maxHSAContribution = planData
    ? getMaxHSAContribution(planData, inputs.coverage, inputs.ageGroup)
    : 0;
  const maxFSAContribution = planData
    ? getMaxFSAContribution(planData)
    : 0;

  // Calculate max user contributions (total max minus employer contribution for HSA)
  const getMaxUserHSAContribution = () => {
    if (!planData) return 0;

    // For HSA plans, we need to find the HSA plans and get their employer contributions
    const hsaPlans = planData.plans.filter(plan => plan.type === 'HSA');
    if (hsaPlans.length === 0) return maxHSAContribution;

    // Get the minimum employer contribution across HSA plans (most conservative)
    const minEmployerContribution = Math.min(
      ...hsaPlans.map(plan => getEmployerHSAContribution(plan, inputs.coverage))
    );

    return Math.max(0, maxHSAContribution - minEmployerContribution);
  };

  const maxUserHSAContribution = getMaxUserHSAContribution();

  // Get employer HSA contribution amount for display
  const getEmployerHSAContributionForDisplay = () => {
    if (!planData) return 0;

    const hsaPlans = planData.plans.filter(plan => plan.type === 'HSA');
    if (hsaPlans.length === 0) return 0;

    // Get the minimum employer contribution across HSA plans (most conservative)
    const minEmployerContribution = Math.min(
      ...hsaPlans.map(plan => getEmployerHSAContribution(plan, inputs.coverage))
    );

    return minEmployerContribution;
  };

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
    <>
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
                  {getAvailableDataYears().map(year => (
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
                <Form.Label>Your Age</Form.Label>
                <Form.Select
                  value={inputs.ageGroup}
                  onChange={(e) => handleChange('ageGroup', e.target.value)}
                >
                  <option value="under_55">Under 55</option>
                  <option value="55_plus">55 or older</option>
                </Form.Select>
                <Form.Text className="text-muted">
                  {inputs.ageGroup === '55_plus' ? 'Eligible for HSA catch-up contribution (+$1,000)' : 'Note: If you turn 55 this year, select "55 or older"'}
                </Form.Text>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Marginal Tax Rate</Form.Label>
                <InputGroup>
                  <Form.Control
                    type="number"
                    value={inputs.taxRate}
                    onChange={(e) => handleChange('taxRate', parseFloat(e.target.value) || 0)}
                    min="0"
                    max="50"
                    step="0.1"
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
                  Only applies to PPO plans.
                </Form.Text>
              </Form.Group>
            </Col>
          </Row>
        </Form>
      </Card.Body>
    </Card>

    <Card className="mb-4">
      <Card.Header>
        <h3>Healthcare Cost Estimates</h3>
      </Card.Header>
      <Card.Body>
        <Form>

          {/* Add Category Section */}
          <Row className="mb-3">
            <Col md={8}>
              <Form.Group>
                <Form.Label>Add Healthcare Category</Form.Label>
                <Form.Select
                  value={selectedCategoryToAdd}
                  onChange={(e) => setSelectedCategoryToAdd(e.target.value)}
                >
                  <option value="">Select a category to add...</option>
                  {availableCategories.map(categoryId => (
                    <option key={categoryId} value={categoryId}>
                      {categoriesData[categoryId].name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4} className="d-flex align-items-end">
              <Button
                variant="primary"
                onClick={addCategory}
                disabled={!selectedCategoryToAdd}
                className="w-100"
              >
                Add Category
              </Button>
            </Col>
          </Row>

          {/* Category Estimates */}
          {inputs.costs.categoryEstimates.map((estimate) => (
            <Card key={estimate.categoryId} className="mb-3">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="mb-0">
                    {categoriesData[estimate.categoryId]?.name || estimate.categoryId}
                  </h6>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => removeCategory(estimate.categoryId)}
                  >
                    Remove
                  </Button>
                </div>
                <Row>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>In-Network Annual Cost</Form.Label>
                      <InputGroup>
                        <InputGroup.Text>$</InputGroup.Text>
                        <FormattedNumberInput
                          value={estimate.inNetworkCost}
                          onChange={(value) => updateCategoryEstimate(estimate.categoryId, 'inNetworkCost', value)}
                          min={0}
                          step={50}
                        />
                      </InputGroup>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Out-of-Network Annual Cost</Form.Label>
                      <InputGroup>
                        <InputGroup.Text>$</InputGroup.Text>
                        <FormattedNumberInput
                          value={estimate.outOfNetworkCost}
                          onChange={(value) => updateCategoryEstimate(estimate.categoryId, 'outOfNetworkCost', value)}
                          min={0}
                          step={50}
                        />
                      </InputGroup>
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          ))}

          {/* Other Costs Category */}
          <Card className="mb-3">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="mb-0">
                  Other Covered Healthcare Costs
                </h6>
                <small className="text-muted">Uses plan default coverage rates</small>
              </div>
              <Row>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>In-Network Annual Cost</Form.Label>
                    <InputGroup>
                      <InputGroup.Text>$</InputGroup.Text>
                      <FormattedNumberInput
                        value={inputs.costs.otherCosts?.inNetworkCost || 0}
                        onChange={(value) => updateOtherCosts('inNetworkCost', value)}
                        min={0}
                        step={50}
                      />
                    </InputGroup>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Out-of-Network Annual Cost</Form.Label>
                    <InputGroup>
                      <InputGroup.Text>$</InputGroup.Text>
                      <FormattedNumberInput
                        value={inputs.costs.otherCosts?.outOfNetworkCost || 0}
                        onChange={(value) => updateOtherCosts('outOfNetworkCost', value)}
                        min={0}
                        step={50}
                      />
                    </InputGroup>
                  </Form.Group>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Form>
      </Card.Body>
    </Card>
    </>
  );
};

export default CostInputForm;