import React, { useState } from 'react';
import { Card, Form, Row, Col, Button } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { getCategoriesData } from '../generated/dataHelpers';
import CostInputRow from './CostInputRow';
import HelpIcon from './HelpIcon';
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

  // Get available categories to add (not already added), sorted alphabetically
  const availableCategories = Object.keys(categoriesData)
    .filter(categoryId => !addedCategoryIds.includes(categoryId))
    .sort((a, b) => categoriesData[a].name.localeCompare(categoriesData[b].name));

  return (
    <>
          {/* Category Estimates */}
          {inputs.costs.categoryEstimates.map((estimate) => (
            <Card key={estimate.categoryId} className="mb-3">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div className="d-flex align-items-center">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => removeCategory(estimate.categoryId)}
                      title="Remove category"
                      className="me-2"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </Button>
                    <h6 className="mb-0">
                      {categoriesData[estimate.categoryId]?.name || estimate.categoryId}
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
                <CostInputRow
                  inNetworkValue={estimate.inNetworkCost}
                  outOfNetworkValue={estimate.outOfNetworkCost}
                  onInNetworkChange={(value) => updateCategoryEstimate(estimate.categoryId, 'inNetworkCost', value)}
                  onOutOfNetworkChange={(value) => updateCategoryEstimate(estimate.categoryId, 'outOfNetworkCost', value)}
                  inNetworkHelpTitle="Category In-Network Cost"
                  outOfNetworkHelpTitle="Category Out-of-Network Cost"
                  inNetworkHelpContent={
                    <div>
                      <p>Estimate your annual spending for this healthcare category using <strong>in-network</strong> providers.</p>
                      <p><strong>This category has specific coverage rules:</strong></p>
                      <ul>
                        <li>May have fixed copays instead of coinsurance</li>
                        <li>Some services may be covered at 100%</li>
                        <li>Coverage details vary by plan type</li>
                      </ul>
                      <p><strong>Examples for this category:</strong></p>
                      <ul>
                        <li>Total cost of all visits/services in this category</li>
                        <li>Multiply: visits per year × average cost per visit</li>
                        <li>Consider both routine and unexpected needs</li>
                      </ul>
                    </div>
                  }
                  outOfNetworkHelpContent={
                    <div>
                      <p>Estimate your annual spending for this healthcare category using <strong>out-of-network</strong> providers.</p>
                      <p><strong>Important notes:</strong></p>
                      <ul>
                        <li>Out-of-network costs are significantly higher</li>
                        <li>Some categories may have limited or no out-of-network coverage</li>
                        <li>You may need to pay upfront and seek reimbursement</li>
                      </ul>
                      <p><strong>Consider:</strong></p>
                      <ul>
                        <li>Emergency care is usually covered at in-network rates</li>
                        <li>Some specialists may not be available in-network</li>
                        <li>Leave at $0 if you plan to stay in-network</li>
                      </ul>
                    </div>
                  }
                />
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
                        inNetworkCost: 0,
                        outOfNetworkCost: 0
                      };
                      handleCostChange('categoryEstimates', [...inputs.costs.categoryEstimates, newEstimate]);
                      setSelectedCategoryToAdd('');
                    }
                  }}
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
          </Row>
    </>
  );
};

export default HealthcareCategoriesSection;