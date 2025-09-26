import React, { useState } from 'react';
import { Card, Form, Row, Col, Button, Badge, InputGroup } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faPencil } from '@fortawesome/free-solid-svg-icons';
import { getCategoriesData } from '../generated/dataHelpers';
import FormattedNumberInput from './FormattedNumberInput';
import HelpIcon from './HelpIcon';
import { UserInputs, CategoryEstimate, PlanData } from '../types';

interface HealthcareCategoriesSectionProps {
  inputs: UserInputs;
  onChange: (updates: Partial<UserInputs>) => void;
  planData: PlanData | null;
}

const HealthcareCategoriesSection: React.FC<HealthcareCategoriesSectionProps> = ({
  inputs,
  onChange,
  planData
}) => {
  const [selectedCategoryToAdd, setSelectedCategoryToAdd] = useState<string>('');
  const categoriesData = getCategoriesData();

  // Helper function to check if a category is free for in-network or out-of-network
  const isCategoryFree = (categoryId: string, network: 'in_network' | 'out_of_network'): boolean => {
    if (!planData) return false;

    // Get plans that have this category defined
    const plansWithCategory = planData.plans.filter(plan => plan.categories[categoryId]);

    // If no plans have this category, it's not free
    if (plansWithCategory.length === 0) return false;

    // Check if ALL plans with this category have it marked as free for the specified network
    return plansWithCategory.every(plan => {
      const categoryConfig = plan.categories[categoryId];
      const coverage = network === 'in_network'
        ? categoryConfig.in_network_coverage
        : categoryConfig.out_of_network_coverage;

      return coverage?.is_free === true;
    });
  };

  const handleCostChange = (field: keyof UserInputs['costs'], value: any) => {
    onChange({
      costs: {
        ...inputs.costs,
        [field]: value
      }
    });
  };

  const removeCategory = (index: number) => {
    const updatedEstimates = inputs.costs.categoryEstimates.filter((_, i) => i !== index);
    handleCostChange('categoryEstimates', updatedEstimates);
  };

  const updateCategoryEstimate = (index: number, field: 'estimate' | 'notes', value: any) => {
    const updatedEstimates = inputs.costs.categoryEstimates.map((est, i) =>
      i === index
        ? { ...est, [field]: value }
        : est
    );
    handleCostChange('categoryEstimates', updatedEstimates);
  };

  // Get all available categories, sorted alphabetically by display name (allows multiple instances)
  const availableCategories = Object.keys(categoriesData)
    .sort((a, b) => {
      const displayNameA = `${categoriesData[a].preventive ? '[Preventive] ' : ''}${categoriesData[a].name}`;
      const displayNameB = `${categoriesData[b].preventive ? '[Preventive] ' : ''}${categoriesData[b].name}`;
      return displayNameA.localeCompare(displayNameB);
    });

  return (
    <>
      {/* Category Estimates */}
      {inputs.costs.categoryEstimates.map((estimate, index) => (
        <Card key={index} className="mb-3">
          <Card.Body>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="d-flex align-items-center">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => removeCategory(index)}
                  title="Remove category"
                  className="me-2"
                >
                  <FontAwesomeIcon icon={faTrash} />
                </Button>
                <h6 className="mb-0 d-flex align-items-center">
                  {categoriesData[estimate.categoryId]?.name || estimate.categoryId}
                  {categoriesData[estimate.categoryId]?.preventive && (
                    <Badge bg="success" className="ms-2">Preventive</Badge>
                  )}
                </h6>
              </div>
              {categoriesData[estimate.categoryId]?.description && (
                <HelpIcon
                  title={categoriesData[estimate.categoryId].name}
                  content={
                    <div>
                      {categoriesData[estimate.categoryId].description}
                    </div>
                  }
                />
              )}
            </div>

            {/* First Row: Network Radio + Notes */}
            <Row className="align-items-center mb-2">
              <Col md={3} className="mb-3">
                <div>
                  <Form.Check
                    type="radio"
                    id={`in-network-${index}`}
                    name={`network-${index}`}
                    label="In-Network"
                    checked={estimate.estimate.isInNetwork}
                    onChange={() => updateCategoryEstimate(index, 'estimate', { ...estimate.estimate, isInNetwork: true })}
                  />
                  <Form.Check
                    type="radio"
                    id={`out-network-${index}`}
                    name={`network-${index}`}
                    label="Out-of-Network"
                    checked={!estimate.estimate.isInNetwork}
                    onChange={() => updateCategoryEstimate(index, 'estimate', { ...estimate.estimate, isInNetwork: false })}
                  />
                  {isCategoryFree(estimate.categoryId, estimate.estimate.isInNetwork ? 'in_network' : 'out_of_network') && (
                    <Badge bg="primary" className="mt-1">Free</Badge>
                  )}
                </div>
              </Col>

              <Col md={9} className="mb-3">
                <InputGroup>
                  <InputGroup.Text>
                    <FontAwesomeIcon icon={faPencil} className="text-muted" />
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Optional notes: ex. Jill's allergy medicine"
                    value={estimate.notes || ''}
                    maxLength={100}
                    onChange={(e) => updateCategoryEstimate(index, 'notes', e.target.value)}
                    style={{ backgroundColor: '#fffbef', border: '1px solid #f0e68c' }}
                  />
                </InputGroup>
              </Col>
            </Row>

            {/* Second Row: Quantity + Cost + Help */}
            <Row className="align-items-center">
              <Col md={3} className="mb-3">
                <Form.Group>
                  <Form.Label className="small text-muted">Visits</Form.Label>
                  <FormattedNumberInput
                    value={estimate.estimate.quantity}
                    onChange={(value: number) => updateCategoryEstimate(index, 'estimate', { ...estimate.estimate, quantity: value })}
                    min={0}
                    step={1}
                  />
                </Form.Group>
              </Col>

              <Col md={9} className="mb-3 position-relative">
                <Form.Group>
                  <Form.Label className="small text-muted">Cost Per Visit</Form.Label>
                  <InputGroup>
                    <InputGroup.Text>$</InputGroup.Text>
                    <FormattedNumberInput
                      value={isCategoryFree(estimate.categoryId, estimate.estimate.isInNetwork ? 'in_network' : 'out_of_network') ? 0 : estimate.estimate.costPerVisit}
                      onChange={(value: number) => updateCategoryEstimate(index, 'estimate', { ...estimate.estimate, costPerVisit: value })}
                      min={0}
                      step={10}
                      disabled={isCategoryFree(estimate.categoryId, estimate.estimate.isInNetwork ? 'in_network' : 'out_of_network')}
                    />
                  </InputGroup>
                </Form.Group>
                <div className="position-absolute" style={{ top: '0', right: '0' }}>
                  <HelpIcon
                    title="Cost Estimate"
                    content={
                      <div>
                        <p><strong>Quantity:</strong> How many times you expect to use this service annually.</p>
                        <p><strong>Cost per visit:</strong> The full amount charged by the provider (not your copay).</p>
                        <p><strong>Network:</strong></p>
                        <ul>
                          <li><strong>In-Network:</strong> Providers with contracts with your insurance plan. Lower costs, better coverage.</li>
                          <li><strong>Out-of-Network:</strong> Providers without contracts. Higher costs, less coverage.</li>
                        </ul>
                        <p><strong>Tip:</strong> Check your EOBs for negotiated rates to get accurate cost estimates.</p>
                      </div>
                    }
                  />
                </div>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      ))}

      {/* Add Category Section */}
      <Row className="mb-3">
        <Col>
          <Form.Group>
            <Form.Select
              value={selectedCategoryToAdd}
              onChange={(e) => {
                const categoryId = e.target.value;
                if (categoryId) {
                  setSelectedCategoryToAdd(categoryId);
                  const newEstimate: CategoryEstimate = {
                    categoryId: categoryId,
                    estimate: {
                      quantity: 1,
                      costPerVisit: 0,
                      isInNetwork: true // Default to in-network
                    },
                    notes: ''
                  };
                  handleCostChange('categoryEstimates', [...inputs.costs.categoryEstimates, newEstimate]);
                  setSelectedCategoryToAdd('');
                }
              }}
            >
              <option value="">Select a category to add...</option>
              {availableCategories.map(categoryId => (
                <option key={categoryId} value={categoryId}>
                  {categoriesData[categoryId].preventive ? '[Preventive] ' : ''}{categoriesData[categoryId].name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
      </Row>
    </>
  );
};

export default HealthcareCategoriesSection;