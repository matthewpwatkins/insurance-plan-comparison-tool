import React, { useState } from 'react';
import { Card, Form, Row, Col, Button, Badge } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { getCategoriesData } from '../generated/dataHelpers';
import NetworkVisitsInputRow from './NetworkVisitsInputRow';
import HelpIcon from './HelpIcon';
import { UserInputs, CategoryEstimate, PlanData } from '../types';

interface HealthcareCategoriesSectionProps {
  inputs: UserInputs;
  onChange: (updates: Partial<UserInputs>) => void;
  planData: PlanData | null;
}

const HealthcareCategoriesSection: React.FC<HealthcareCategoriesSectionProps> = ({ inputs, onChange, planData }) => {
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

  const updateCategoryEstimate = (index: number, network: 'inNetwork' | 'outOfNetwork', value: any) => {
    const updatedEstimates = inputs.costs.categoryEstimates.map((est, i) =>
      i === index
        ? { ...est, [network]: value }
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
                      {(() => {
                        // Calculate instance number when there are multiple instances of same category
                        const allCategories = inputs.costs.categoryEstimates;
                        const sameCategoryIndices = allCategories
                          .map((est, i) => ({ est, originalIndex: i }))
                          .filter(item => item.est.categoryId === estimate.categoryId);

                        const instanceNumber = sameCategoryIndices.length > 1 ?
                          sameCategoryIndices.findIndex(item => item.originalIndex === index) + 1 :
                          null;

                        const baseName = categoriesData[estimate.categoryId]?.name || estimate.categoryId;
                        return instanceNumber ? `${baseName} #${instanceNumber}` : baseName;
                      })()}
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
                <NetworkVisitsInputRow
                  inNetworkValue={estimate.inNetwork}
                  outOfNetworkValue={estimate.outOfNetwork}
                  onInNetworkChange={(value) => updateCategoryEstimate(index, 'inNetwork', value)}
                  onOutOfNetworkChange={(value) => updateCategoryEstimate(index, 'outOfNetwork', value)}
                  inNetworkHelpTitle="In-Network Visits"
                  outOfNetworkHelpTitle="Out-of-Network Visits"
                  inNetworkHelpContent={
                    <div>
                      <p>Estimate your visits using <strong>in-network</strong> providers for this category.</p>
                      <p><strong>In-network providers:</strong></p>
                      <ul>
                        <li>Have contracts with your insurance plan</li>
                        <li>Offer lower costs and better coverage</li>
                        <li>May have copays instead of coinsurance</li>
                        <li>Count toward your deductible and out-of-pocket maximum</li>
                      </ul>
                      <p><strong>Cost should be the full amount charged:</strong></p>
                      <ul>
                        <li>Not your copay - the provider's full charge</li>
                        <li>Check your EOBs for negotiated rates</li>
                        <li>The calculator will apply copays/coinsurance</li>
                      </ul>
                    </div>
                  }
                  outOfNetworkHelpContent={
                    <div>
                      <p>Estimate your visits using <strong>out-of-network</strong> providers for this category.</p>
                      <p><strong>Out-of-network providers:</strong></p>
                      <ul>
                        <li>Don't have contracts with your insurance plan</li>
                        <li>Result in higher costs and less coverage</li>
                        <li>May have separate deductibles and maximums</li>
                        <li>You might pay upfront and get reimbursed</li>
                      </ul>
                      <p><strong>Important:</strong></p>
                      <ul>
                        <li>Some plans don't cover out-of-network care at all</li>
                        <li>Emergency care is usually covered at in-network rates</li>
                        <li>Leave at 0 if you plan to stay in-network</li>
                      </ul>
                    </div>
                  }
                  inNetworkIsFree={isCategoryFree(estimate.categoryId, 'in_network')}
                  outOfNetworkIsFree={isCategoryFree(estimate.categoryId, 'out_of_network')}
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
                        inNetwork: {
                          quantity: 1,
                          costPerVisit: 0
                        },
                        outOfNetwork: {
                          quantity: 0,
                          costPerVisit: 0
                        }
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