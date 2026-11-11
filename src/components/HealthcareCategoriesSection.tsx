import React, { useEffect, useRef, useState } from 'react';
import { Form, Row, Col, Button, ButtonGroup, Badge, InputGroup, ListGroup } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faNoteSticky, faTrash } from '@fortawesome/free-solid-svg-icons';
import FormattedNumberInput from './FormattedNumberInput';
import HelpIcon from './HelpIcon';
import { UserInputs, CategoryEstimate, PlanData } from '../types';
import { categoryVisitLimit, isCoveredByInsurance } from '../utils/costCalculator';
import { peopleCount, personName, tracksPeople } from '../utils/people';

/** Where to put care insurance won't pay for but an HSA or FSA will */
export const ELIGIBLE_OTHER_ID = 'other_hsa_fsa_eligible';
const ELIGIBLE_OTHER_NAME = 'Other medical costs (HSA/FSA eligible)';

const SORT_OPTIONS = [
  { key: 'entered', label: 'Order entered' },
  { key: 'category', label: 'Category' },
  { key: 'who', label: 'Who' },
  { key: 'total', label: 'Total (highest first)' },
  { key: 'price', label: 'Price each (highest first)' },
  { key: 'quantity', label: 'Per year (most first)' },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]['key'];

interface HealthcareCategoriesSectionProps {
  inputs: UserInputs;
  onChange: (updates: Partial<UserInputs>) => void;
  planData: PlanData | null;
  /** A row to point out, like one just added for the person, scrolled to and highlighted */
  highlightIndex?: number;
}

const HealthcareCategoriesSection: React.FC<HealthcareCategoriesSectionProps> = ({
  inputs,
  onChange,
  planData,
  highlightIndex,
}) => {
  // Bring the highlighted row into view and put the cursor on its price
  const highlightedRow = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const row = highlightedRow.current;
    if (highlightIndex === undefined || !row) return;
    row.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    row.querySelector<HTMLInputElement>('input[aria-label="Price each"]')?.focus();
  }, [highlightIndex]);
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

  /**
   * The strictest yearly visit limit among the plans that limit this care, and whether every
   * limiting plan covers more visits once preauthorized
   */
  const visitLimitFor = (
    categoryId: string,
    network: 'in_network' | 'out_of_network'
  ): { visits: number; allPlans: boolean; extraWithPreauthorization: boolean } | undefined => {
    if (!planData) return undefined;
    const limits = planData.plans
      .map(plan => categoryVisitLimit(plan, categoryId, network))
      .filter((limit): limit is NonNullable<typeof limit> => limit !== undefined);
    if (limits.length === 0) return undefined;
    const visits = Math.min(...limits.map(limit => limit.visits));
    return {
      visits,
      allPlans:
        limits.length === planData.plans.length && limits.every(limit => limit.visits === visits),
      extraWithPreauthorization: limits.every(limit => limit.extraWithPreauthorization),
    };
  };

  /** Visits one person has in a category and network, across all their rows */
  const visitsFor = (estimate: CategoryEstimate): number =>
    inputs.costs.categoryEstimates
      .filter(
        other =>
          other.categoryId === estimate.categoryId &&
          other.estimate.isInNetwork === estimate.estimate.isInNetwork &&
          other.person === estimate.person
      )
      .reduce((sum, other) => sum + Math.round(other.estimate.quantity), 0);

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

  const updateCategoryEstimate = (
    index: number,
    field: 'categoryId' | 'estimate' | 'notes' | 'person',
    value: any
  ) => {
    const updatedEstimates = inputs.costs.categoryEstimates.map((est, i) =>
      i === index ? { ...est, [field]: value } : est
    );
    handleCostChange('categoryEstimates', updatedEstimates);
  };

  // Get all available categories, sorted alphabetically by display name (allows multiple instances)
  // Costs insurance doesn't cover go last, after every kind of care a plan pays toward
  const availableCategories = Object.keys(categoriesData).sort((a, b) => {
    const uncovered = (id: string) => (isCoveredByInsurance(categoriesData, id) ? 0 : 1);
    const displayNameA = `${categoriesData[a].preventive ? '[Preventive] ' : ''}${categoriesData[a].name}`;
    const displayNameB = `${categoriesData[b].preventive ? '[Preventive] ' : ''}${categoriesData[b].name}`;
    return uncovered(a) - uncovered(b) || displayNameA.localeCompare(displayNameB);
  });

  // Entry order unless the person picks another; ties keep entry order
  const [sortBy, setSortBy] = useState<SortKey>('entered');
  const sortValue = (estimate: CategoryEstimate): string | number => {
    switch (sortBy) {
      case 'category':
        return categoriesData[estimate.categoryId]?.name ?? estimate.categoryId;
      case 'who':
        // Shared care after everyone named
        return estimate.person ?? Number.MAX_SAFE_INTEGER;
      case 'quantity':
        return -estimate.estimate.quantity;
      case 'price':
        return -estimate.estimate.costPerVisit;
      case 'total':
        return -estimate.estimate.quantity * estimate.estimate.costPerVisit;
      default:
        return 0;
    }
  };
  const displayOrder = inputs.costs.categoryEstimates
    .map((_, index) => index)
    .sort((a, b) => {
      const [valueA, valueB] = [
        sortValue(inputs.costs.categoryEstimates[a]),
        sortValue(inputs.costs.categoryEstimates[b]),
      ];
      const byValue =
        typeof valueA === 'string'
          ? valueA.localeCompare(valueB as string)
          : valueA - (valueB as number);
      return byValue || a - b;
    });

  const networkOf = (estimate: CategoryEstimate) =>
    estimate.estimate.isInNetwork ? 'in_network' : 'out_of_network';

  // Who each row is for, with two-party and family coverage
  const withPeople = tracksPeople(inputs.coverage);
  const people = Array.from({ length: peopleCount(inputs) }, (_, i) => i + 1);
  return (
    <>
      {inputs.costs.categoryEstimates.length > 0 && (
        <>
          {inputs.costs.categoryEstimates.length > 1 && (
            <div className="d-flex justify-content-end align-items-center gap-2 mb-2 small">
              <Form.Label htmlFor="expense-sort" className="text-muted mb-0">
                Sort by
              </Form.Label>
              <Form.Select
                id="expense-sort"
                size="sm"
                aria-label="Sort by"
                className="w-auto"
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortKey)}
              >
                {SORT_OPTIONS.filter(option => withPeople || option.key !== 'who').map(option => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </Form.Select>
            </div>
          )}
          {/* Column labels for wider screens; phones label each field instead */}
          {/* Stays in view while scrolling a long list */}
          <Row
            className="g-2 d-none d-md-flex small text-muted px-3 mb-1 py-1 bg-body"
            style={{ position: 'sticky', top: 0, zIndex: 2 }}
          >
            {withPeople && <Col md={2}>Who</Col>}
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
              const covered = isCoveredByInsurance(categoriesData, estimate.categoryId);
              const limit = visitLimitFor(estimate.categoryId, network);
              const overLimit = limit !== undefined && visitsFor(estimate) > limit.visits;
              const plansCover = limit?.allPlans ? 'Plans cover' : 'Some plans cover only';
              const perPerson = withPeople ? ' per person' : '';
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
                <ListGroup.Item
                  key={index}
                  ref={(el: HTMLElement | null) => {
                    if (index === highlightIndex) highlightedRow.current = el;
                  }}
                  className={`py-2 ${index === highlightIndex ? 'border-warning border-2 bg-warning-subtle' : ''}`}
                >
                  {/* Name across the whole row, with the badge and delete button at its right */}
                  <div className="d-flex align-items-start gap-2 mb-1">
                    <span className="flex-grow-1" style={{ minWidth: 0 }}>
                      {/* The name doubles as the category picker: the name shows, wrapping on
                          narrow screens, with an invisible picker laid over it to catch taps */}
                      <span
                        className="d-inline-grid align-items-center me-1 align-middle"
                        style={{ maxWidth: 'calc(100% - 1.75rem)' }}
                      >
                        <span aria-hidden className="fw-semibold" style={{ gridArea: '1 / 1' }}>
                          {category?.name ?? estimate.categoryId}
                          <FontAwesomeIcon
                            icon={faChevronDown}
                            size="xs"
                            className="ms-2 text-muted"
                          />
                        </span>
                        <Form.Select
                          size="sm"
                          aria-label="Category"
                          value={estimate.categoryId}
                          onChange={e =>
                            updateCategoryEstimate(index, 'categoryId', e.target.value)
                          }
                          className="border-0 shadow-none p-0"
                          style={{
                            gridArea: '1 / 1',
                            width: '100%',
                            height: '100%',
                            opacity: 0,
                            cursor: 'pointer',
                          }}
                        >
                          {!category && (
                            <option value={estimate.categoryId}>{estimate.categoryId}</option>
                          )}
                          {availableCategories.map(categoryId => (
                            <option key={categoryId} value={categoryId}>
                              {categoriesData[categoryId].name}
                            </option>
                          ))}
                        </Form.Select>
                      </span>
                      {category?.notes && <span className="text-primary me-1">*</span>}
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
                    {/* Who and network don't matter for costs no plan pays toward, so those
                        rows skip both and the note takes the room */}
                    {withPeople && covered && (
                      <Col xs={12} md={2}>
                        <Form.Label className="d-md-none small text-muted mb-0">Who</Form.Label>
                        <Form.Select
                          size="sm"
                          aria-label="Who"
                          // A cost for no one in particular can't count toward a person's own max
                          className={estimate.person === undefined ? 'border-warning' : undefined}
                          value={estimate.person ?? ''}
                          onChange={e =>
                            updateCategoryEstimate(
                              index,
                              'person',
                              e.target.value ? Number(e.target.value) : undefined
                            )
                          }
                        >
                          <option value="">Not sure</option>
                          {people.map(person => (
                            <option key={person} value={person}>
                              {personName(inputs, person)}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    )}
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
                    {covered && (
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
                    )}
                    <Col xs={covered ? 3 : 4} md={2}>
                      <Form.Label className="d-md-none small text-muted mb-0">Per year</Form.Label>
                      <FormattedNumberInput
                        size="sm"
                        aria-label="Per year"
                        value={estimate.estimate.quantity}
                        onChange={(value: number) => update({ quantity: Math.round(value) })}
                        min={0}
                        step={1}
                        title={
                          limit !== undefined
                            ? `${plansCover} ${limit.visits} a year${perPerson}`
                            : undefined
                        }
                      />
                    </Col>
                    <Col xs={covered ? 5 : 8} md={2}>
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
                  {overLimit && limit && (
                    <div className="small text-muted mt-2">
                      <strong>
                        {plansCover} {limit.visits} {limit.visits === 1 ? 'visit' : 'visits'} a year
                        {perPerson}.
                      </strong>{' '}
                      {limit.extraWithPreauthorization ? (
                        <>
                          Your doctor can ask the plan to approve more. Count the extra visits here
                          only if you expect them to be approved. Put visits you'll pay for yourself
                          under <strong>{ELIGIBLE_OTHER_NAME}</strong>.
                        </>
                      ) : (
                        'Visits past that cost full price on those plans, and still count toward the out-of-pocket max.'
                      )}
                    </div>
                  )}
                </ListGroup.Item>
              );
            })}
          </ListGroup>
        </>
      )}

      <NewExpenseForm
        categoryIds={availableCategories}
        categoriesData={categoriesData}
        people={
          withPeople ? people.map(person => ({ person, name: personName(inputs, person) })) : []
        }
        onAdd={newEstimate =>
          handleCostChange('categoryEstimates', [...inputs.costs.categoryEstimates, newEstimate])
        }
      />
    </>
  );
};

/** "Not sure" in the Who picker, kept apart from "not picked yet" */
const SHARED = 'shared';

/**
 * A separate form for a new expense: it joins the list only once it has what it needs, so the
 * list never gains a half-filled row with a guessed person
 */
const NewExpenseForm: React.FC<{
  categoryIds: string[];
  categoriesData: PlanData['categories'];
  /** Who care can be for, empty when coverage doesn't track people */
  people: { person: number; name: string }[];
  onAdd: (estimate: CategoryEstimate) => void;
}> = ({ categoryIds, categoriesData, people, onAdd }) => {
  const [categoryId, setCategoryId] = useState('');
  const [who, setWho] = useState('');
  const [isInNetwork, setIsInNetwork] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [costPerVisit, setCostPerVisit] = useState(0);
  const [notes, setNotes] = useState('');

  const covered = !categoryId || isCoveredByInsurance(categoriesData, categoryId);
  const asksWho = people.length > 0 && covered;
  const missing = [
    !categoryId && 'a category',
    asksWho && !who && 'who it is for',
    quantity <= 0 && 'how many per year',
    costPerVisit <= 0 && 'the price',
  ].filter(Boolean) as string[];

  const add = () => {
    if (missing.length > 0) return;
    onAdd({
      categoryId,
      estimate: { quantity, costPerVisit, isInNetwork: covered ? isInNetwork : true },
      notes,
      ...(asksWho && who !== SHARED ? { person: Number(who) } : {}),
    });
    setCategoryId('');
    setWho('');
    setIsInNetwork(true);
    setQuantity(1);
    setCostPerVisit(0);
    setNotes('');
  };

  return (
    <div className="border rounded p-3 mb-3 bg-body-tertiary" aria-label="New expense" role="group">
      <div className="fw-semibold mb-2">Add an expense</div>
      <Row className="g-2 align-items-end">
        <Col xs={12}>
          <Form.Select
            size="sm"
            aria-label="New category"
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
          >
            <option value="">Select a category...</option>
            {categoryIds.map(id => (
              <option key={id} value={id}>
                {categoriesData[id].preventive ? '[Preventive] ' : ''}
                {categoriesData[id].name}
                {categoriesData[id]?.notes ? '*' : ''}
              </option>
            ))}
          </Form.Select>
        </Col>
        {categoryId && (
          <>
            {asksWho && (
              <Col xs={12} md={2}>
                <Form.Label className="small text-muted mb-0">Who</Form.Label>
                <Form.Select
                  size="sm"
                  aria-label="Who"
                  value={who}
                  onChange={e => setWho(e.target.value)}
                >
                  <option value="">Choose...</option>
                  {people.map(({ person, name }) => (
                    <option key={person} value={person}>
                      {name}
                    </option>
                  ))}
                  <option value={SHARED}>Not sure</option>
                </Form.Select>
              </Col>
            )}
            <Col xs={12} md>
              <Form.Label className="small text-muted mb-0">Note</Form.Label>
              <Form.Control
                size="sm"
                type="text"
                aria-label="Notes"
                placeholder="Add a note"
                value={notes}
                maxLength={100}
                onChange={e => setNotes(e.target.value)}
              />
            </Col>
            {covered && (
              <Col xs={4} md={2}>
                <Form.Label className="small text-muted mb-0">In network</Form.Label>
                <ButtonGroup size="sm" className="w-100" aria-label="In network">
                  {[true, false].map(inNetwork => (
                    <Button
                      key={String(inNetwork)}
                      variant={isInNetwork === inNetwork ? 'primary' : 'outline-primary'}
                      aria-pressed={isInNetwork === inNetwork}
                      title={inNetwork ? 'In-network' : 'Out-of-network'}
                      onClick={() => setIsInNetwork(inNetwork)}
                    >
                      {inNetwork ? 'Yes' : 'No'}
                    </Button>
                  ))}
                </ButtonGroup>
              </Col>
            )}
            <Col xs={covered ? 3 : 4} md={2}>
              <Form.Label className="small text-muted mb-0">Per year</Form.Label>
              <FormattedNumberInput
                size="sm"
                aria-label="Per year"
                value={quantity}
                onChange={(value: number) => setQuantity(Math.round(value))}
                min={0}
                step={1}
              />
            </Col>
            <Col xs={covered ? 5 : 8} md={2}>
              <Form.Label className="small text-muted mb-0">Price each</Form.Label>
              <InputGroup size="sm">
                <InputGroup.Text>$</InputGroup.Text>
                <FormattedNumberInput
                  aria-label="Price each"
                  value={costPerVisit}
                  onChange={(value: number) => setCostPerVisit(value)}
                  min={0}
                  step={10}
                />
              </InputGroup>
            </Col>
          </>
        )}
      </Row>
      {categoryId && (
        <div className="d-flex align-items-center justify-content-end gap-2 mt-2">
          {missing.length > 0 && (
            <span className="small text-muted me-auto">Still needs {missing.join(', ')}</span>
          )}
          <Button variant="link" size="sm" onClick={() => setCategoryId('')}>
            Cancel
          </Button>
          {/* Never disabled: number boxes save on blur, which lands as this click starts */}
          <Button size="sm" aria-disabled={missing.length > 0} onClick={add}>
            Add
          </Button>
        </div>
      )}
    </div>
  );
};

export default HealthcareCategoriesSection;
