import React, { useState } from 'react';
import { Form, Row, Col, Button, ButtonGroup, Badge, InputGroup, ListGroup } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faNoteSticky, faTrash } from '@fortawesome/free-solid-svg-icons';
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
  planData,
}) => {
  const [selectedCategoryToAdd, setSelectedCategoryToAdd] = useState<string>('');
  const categoriesData = planData?.categories ?? {};

  // Helper function to check if a category is free for in-network or out-of-network
  const isCategoryFree = (
    categoryId: string,
    network: 'in_network' | 'out_of_network'
  ): boolean => {
    if (!planData) return false;

    // Get plans that have this category defined
    const plansWithCategory = planData.plans.filter(plan => plan.categories[categoryId]);

    // If no plans have this category, it's not free
    if (plansWithCategory.length === 0) return false;

    // Check if ALL plans with this category have it marked as free for the specified network
    return plansWithCategory.every(plan => {
      const categoryConfig = plan.categories[categoryId];
      if (!categoryConfig) return false;

      const coverage =
        network === 'in_network'
          ? categoryConfig.in_network_coverage
          : categoryConfig.out_of_network_coverage;

      return coverage?.is_free === true;
    });
  };

  // Helper function to get the quantity cap for a category
  const getCategoryQuantityCap = (
    categoryId: string,
    network: 'in_network' | 'out_of_network'
  ): number | undefined => {
    if (!planData) return undefined;

    // The strictest plan's limit, shown as a hint; counts above it are allowed and billed in full
    const plansWithCategory = planData.plans.filter(plan => plan.categories[categoryId]);
    if (plansWithCategory.length === 0) return undefined;

    let minQuantityCap: number | undefined = undefined;

    for (const plan of plansWithCategory) {
      const categoryConfig = plan.categories[categoryId];
      if (!categoryConfig) continue;

      // Check category-level cap first
      if (categoryConfig.qty_cap !== undefined) {
        minQuantityCap =
          minQuantityCap === undefined
            ? categoryConfig.qty_cap
            : Math.min(minQuantityCap, categoryConfig.qty_cap);
        continue;
      }

      // Check network-specific cap
      const coverage =
        network === 'in_network'
          ? categoryConfig.in_network_coverage
          : categoryConfig.out_of_network_coverage;

      if (coverage?.qty_cap !== undefined) {
        minQuantityCap =
          minQuantityCap === undefined
            ? coverage.qty_cap
            : Math.min(minQuantityCap, coverage.qty_cap);
      }
    }

    return minQuantityCap;
  };

  const handleCostChange = (field: keyof UserInputs['costs'], value: any) => {
    onChange({
      costs: {
        ...inputs.costs,
        [field]: value,
      },
    });
  };

  const removeCategory = (index: number) => {
    const updatedEstimates = inputs.costs.categoryEstimates.filter((_, i) => i !== index);
    handleCostChange('categoryEstimates', updatedEstimates);
  };

  const updateCategoryEstimate = (index: number, field: 'estimate' | 'notes', value: any) => {
    const updatedEstimates = inputs.costs.categoryEstimates.map((est, i) =>
      i === index ? { ...est, [field]: value } : est
    );
    handleCostChange('categoryEstimates', updatedEstimates);
  };

  // Get all available categories, sorted alphabetically by display name (allows multiple instances)
  const availableCategories = Object.keys(categoriesData).sort((a, b) => {
    const displayNameA = `${categoriesData[a].preventive ? '[Preventive] ' : ''}${categoriesData[a].name}`;
    const displayNameB = `${categoriesData[b].preventive ? '[Preventive] ' : ''}${categoriesData[b].name}`;
    return displayNameA.localeCompare(displayNameB);
  });

  // Preventive care first, otherwise in the order entered
  const isPreventive = (estimate: CategoryEstimate) =>
    categoriesData[estimate.categoryId]?.preventive ? 0 : 1;
  const displayOrder = inputs.costs.categoryEstimates
    .map((_, index) => index)
    .sort(
      (a, b) =>
        isPreventive(inputs.costs.categoryEstimates[a]) -
          isPreventive(inputs.costs.categoryEstimates[b]) || a - b
    );

  const networkOf = (estimate: CategoryEstimate) =>
    estimate.estimate.isInNetwork ? 'in_network' : 'out_of_network';

  return (
    <>
      {inputs.costs.categoryEstimates.length > 0 && (
        <>
          {/* Column labels for wider screens; phones label each field instead */}
          <Row className="g-2 d-none d-md-flex small text-muted px-3 mb-1">
            <Col md>Note</Col>
            <Col md={2}>In network</Col>
            <Col md={2}>Per year</Col>
            <Col md={2} className="text-nowrap">
              Price each{' '}
              <HelpIcon
                title="Entering an expense"
                content={
                  <div>
                    <p>
                      <strong>Per year:</strong> How many visits, fills or tests you expect
                      annually.
                    </p>
                    <p>
                      <strong>Price each:</strong> The full negotiated price each time (not your
                      copay). Your claims history shows these prices.
                    </p>
                    <p>
                      <strong>In-network</strong> providers have contracts with your plan, so they
                      cost less and are covered better. <strong>Out-of-network</strong> providers
                      don't.
                    </p>
                    <p className="mb-0">
                      Preventive care, like in-network checkups, costs you $0, but enter its real
                      price anyway: you pay it for visits over a plan's yearly limit.
                    </p>
                  </div>
                }
              />
            </Col>
          </Row>
          <ListGroup className="mb-3">
            {displayOrder.map(index => {
              const estimate = inputs.costs.categoryEstimates[index];
              const category = categoriesData[estimate.categoryId];
              const network = networkOf(estimate);
              const free = isCategoryFree(estimate.categoryId, network);
              const cap = getCategoryQuantityCap(estimate.categoryId, network);
              const deleteButton = (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => removeCategory(index)}
                  title="Remove"
                  aria-label="Remove"
                  className="text-danger p-0"
                >
                  <FontAwesomeIcon icon={faTrash} />
                </Button>
              );
              const update = (changes: Partial<CategoryEstimate['estimate']>) =>
                updateCategoryEstimate(index, 'estimate', { ...estimate.estimate, ...changes });
              return (
                <ListGroup.Item key={index} className="py-2">
                  {/* Name across the whole row, with the badge and delete button at its right */}
                  <div className="d-flex align-items-start gap-2 mb-1">
                    <span className="flex-grow-1" style={{ minWidth: 0 }}>
                      <span className="fw-semibold me-2">
                        {category?.name || estimate.categoryId}
                        {category?.notes && <span className="text-primary">*</span>}
                      </span>
                      {category?.description && (
                        <HelpIcon
                          title={category.name}
                          content={
                            <div>
                              {category.description}
                              {category.notes && (
                                <div className="mt-3 pt-2 border-top">
                                  <p className="mb-1">
                                    <strong>* Important Notes:</strong>
                                  </p>
                                  <ul className="mb-0">
                                    {category.notes.map((note, noteIndex) => (
                                      <li key={noteIndex}>{note}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          }
                        />
                      )}
                    </span>
                    <span className="d-flex flex-shrink-0 align-items-center gap-2">
                      {category?.preventive && <Badge bg="success">Preventive</Badge>}
                      {deleteButton}
                    </span>
                  </div>
                  {/* Bottom-aligned so the note box and the other inputs sit on one line */}
                  <Row className="g-2 align-items-end">
                    <Col xs={12} md>
                      <InputGroup size="sm">
                        <InputGroup.Text>
                          <FontAwesomeIcon icon={faNoteSticky} className="text-muted" />
                        </InputGroup.Text>
                        <Form.Control
                          type="text"
                          aria-label="Notes"
                          placeholder="Add a note"
                          value={estimate.notes || ''}
                          maxLength={100}
                          onChange={e => updateCategoryEstimate(index, 'notes', e.target.value)}
                        />
                      </InputGroup>
                    </Col>
                    <Col xs={4} md={2}>
                      <Form.Label className="d-md-none small text-muted mb-0">
                        In network
                      </Form.Label>
                      <ButtonGroup size="sm" className="w-100" aria-label="In network">
                        {[true, false].map(inNetwork => (
                          <Button
                            key={String(inNetwork)}
                            variant={
                              estimate.estimate.isInNetwork === inNetwork
                                ? 'primary'
                                : 'outline-primary'
                            }
                            aria-pressed={estimate.estimate.isInNetwork === inNetwork}
                            title={inNetwork ? 'In-network' : 'Out-of-network'}
                            onClick={() => update({ isInNetwork: inNetwork })}
                          >
                            {inNetwork ? 'Yes' : 'No'}
                          </Button>
                        ))}
                      </ButtonGroup>
                    </Col>
                    <Col xs={3} md={2}>
                      <Form.Label className="d-md-none small text-muted mb-0">Per year</Form.Label>
                      <FormattedNumberInput
                        size="sm"
                        aria-label="Per year"
                        value={estimate.estimate.quantity}
                        onChange={(value: number) => update({ quantity: Math.round(value) })}
                        min={0}
                        step={1}
                        title={
                          cap !== undefined
                            ? `Some plans cover only ${cap} a year; more than that is full price`
                            : undefined
                        }
                      />
                    </Col>
                    <Col xs={5} md={2}>
                      <Form.Label className="d-md-none small text-muted mb-0">
                        Price each
                      </Form.Label>
                      <InputGroup
                        size="sm"
                        title={free ? 'Every plan pays this in full, so you pay $0' : undefined}
                      >
                        <InputGroup.Text>$</InputGroup.Text>
                        <FormattedNumberInput
                          aria-label="Price each"
                          value={estimate.estimate.costPerVisit}
                          onChange={(value: number) => update({ costPerVisit: value })}
                          min={0}
                          step={10}
                        />
                      </InputGroup>
                    </Col>
                  </Row>
                </ListGroup.Item>
              );
            })}
          </ListGroup>
        </>
      )}

      {/* Add Category Section */}
      <Row className="mb-3">
        <Col>
          <Form.Group>
            <Form.Select
              value={selectedCategoryToAdd}
              onChange={e => {
                const categoryId = e.target.value;
                if (categoryId) {
                  setSelectedCategoryToAdd(categoryId);
                  const newEstimate: CategoryEstimate = {
                    categoryId: categoryId,
                    estimate: {
                      quantity: 1,
                      costPerVisit: 0,
                      isInNetwork: true, // Default to in-network
                    },
                    notes: '',
                  };
                  handleCostChange('categoryEstimates', [
                    ...inputs.costs.categoryEstimates,
                    newEstimate,
                  ]);
                  setSelectedCategoryToAdd('');
                }
              }}
            >
              <option value="">Select a category to add...</option>
              {availableCategories.map(categoryId => (
                <option key={categoryId} value={categoryId}>
                  {categoriesData[categoryId].preventive ? '[Preventive] ' : ''}
                  {categoriesData[categoryId].name}
                  {categoriesData[categoryId]?.notes ? '*' : ''}
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
