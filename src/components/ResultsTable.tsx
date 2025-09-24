import React from 'react';
import { Badge, Card, Row, Col } from 'react-bootstrap';
import { formatCurrency } from '../utils/formatters';
import { PlanResult } from '../types';

interface ResultsTableProps {
  results: PlanResult[];
}

const ResultsTable: React.FC<ResultsTableProps> = ({ results }) => {
  if (!results || results.length === 0) {
    return null;
  }

  const lowestCostAmount = results[0]?.totalCost;

  // Card View Component for All Screen Sizes
  const PlanCard: React.FC<{ result: PlanResult; isLowestCost: boolean }> = ({ result, isLowestCost }) => (
    <Card className={`mb-3 ${isLowestCost ? 'border-success border-2' : ''}`}>
      <Card.Header className={`d-flex justify-content-between align-items-center ${isLowestCost ? 'bg-success-subtle' : ''}`}>
        <div className="d-flex align-items-center">
          <strong className="fs-5">{result.planName}</strong>
          {isLowestCost && (
            <Badge bg="success" className="ms-2">
              🏆 Best Value
            </Badge>
          )}
        </div>
        <Badge bg={result.planType === 'HSA' ? 'primary' : 'secondary'} className="fs-6">
          {result.planType}
        </Badge>
      </Card.Header>
      <Card.Body>
        <Row className="g-3">
          <Col xs={6} md={4} lg={3}>
            <small className="text-muted d-block">Annual Premiums</small>
            <div className="fw-semibold fs-6">{formatCurrency(result.annualPremiums)}</div>
          </Col>
          <Col xs={6} md={4} lg={3}>
            <small className="text-muted d-block">Out-of-Pocket Costs</small>
            <div className="fw-semibold fs-6">{formatCurrency(result.outOfPocketCosts)}</div>
          </Col>
          <Col xs={6} md={4} lg={3}>
            <small className="text-muted d-block">
              Your {result.planType === 'HSA' ? 'HSA' : 'FSA'} Contribution
            </small>
            <div className="fw-semibold text-success fs-6">
              {result.userContribution > 0 ? (
                formatCurrency(result.userContribution)
              ) : (
                <span className="text-muted">$0</span>
              )}
            </div>
          </Col>
          <Col xs={6} md={4} lg={3}>
            <small className="text-muted d-block">
              {result.employerContribution > 0 ? 'Employer HSA Contribution' : 'Employer Contribution'}
            </small>
            <div className="fw-semibold text-success fs-6">
              {result.employerContribution > 0 ? (
                formatCurrency(result.employerContribution)
              ) : (
                <span className="text-muted">$0</span>
              )}
            </div>
          </Col>
          <Col xs={6} md={4} lg={3}>
            <small className="text-muted d-block">Tax Savings</small>
            <div className="fw-semibold text-success fs-6">
              -{formatCurrency(result.taxSavings)}
            </div>
          </Col>
          <Col xs={6} md={4} lg={3}>
            <small className="text-muted d-block">Your Total Cost</small>
            <div className={`fs-4 fw-bold ${isLowestCost ? 'text-success' : 'text-primary'}`}>
              {formatCurrency(result.totalCost)}
            </div>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );

  return (
    <>
      {/* Card View for All Screen Sizes */}
      <div>
        {results.map((result, index) => {
          const isLowestCost = result.totalCost === lowestCostAmount;
          return (
            <PlanCard
              key={result.planName}
              result={result}
              isLowestCost={isLowestCost}
            />
          );
        })}
      </div>

      {/* Calculation Notes */}
      <Card className="mt-3">
        <Card.Body>
          <h6>💡 How We Calculate These Numbers:</h6>
          <ul className="small text-muted mb-0">
            <li><strong>Total Annual Cost</strong> = Premiums + Out-of-Pocket Costs - Tax Savings</li>
            <li><strong>Tax Savings</strong> calculated on HSA/FSA contributions using your marginal tax rate</li>
            <li><strong>HSA Plans</strong> include employer contributions which also provide tax benefits</li>
            <li><strong>Out-of-Pocket Costs</strong> assume in-network usage, capped at plan's maximum</li>
            <li><strong>💰 Bonus:</strong> HSA funds roll over year-to-year and can be invested for long-term growth!</li>
          </ul>
        </Card.Body>
      </Card>
    </>
  );
};

export default ResultsTable;