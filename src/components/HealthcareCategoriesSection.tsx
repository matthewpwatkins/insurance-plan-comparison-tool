import React, { useState } from 'react';
import { Card, Form, Row, Col, InputGroup, Button } from 'react-bootstrap';
import { getCategoriesData } from '../generated/dataHelpers';
import FormattedNumberInput from './FormattedNumberInput';
import { UserInputs, CategoryEstimate } from '../types';

interface HealthcareCategoriesSectionProps {
  inputs: UserInputs;
  onChange: (updates: Partial<UserInputs>) => void;
}

const HealthcareCategoriesSection: React.FC<HealthcareCategoriesSectionProps> = ({ inputs, onChange }) => {
  const [selectedCategoryToAdd, setSelectedCategoryToAdd] = useState<string>('');
  const categoriesData = getCategoriesData();

  const handleCostChange = (field: keyof UserInputs['costs'], value: any) => {
    onChange({
      costs: {
        ...inputs.costs,
        [field]: value
      }
    });
  };

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

  // Get categories already added
  const addedCategoryIds = inputs.costs.categoryEstimates.map(est => est.categoryId);

  // Get available categories to add (not already added)
  const availableCategories = Object.keys(categoriesData).filter(
    categoryId => !addedCategoryIds.includes(categoryId)
  );

  return (
    <>
          {/* Add Category Section */}
          <Row className="mb-3">
            <Col md={8}>
              <Form.Group>
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
    </>
  );
};

export default HealthcareCategoriesSection;