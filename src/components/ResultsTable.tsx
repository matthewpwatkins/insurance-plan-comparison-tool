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
    <div className={isLowestCost ? 'mx-n2 mx-md-n3' : ''}>
      <Card
        className={`mb-3 ${isLowestCost ? 'border-success border-3 shadow-lg bg-success-subtle' : ''}`}
        style={isLowestCost ? { transform: 'scale(1.02)' } : {}}
      >
        <Card.Header className={`d-flex justify-content-between align-items-center py-3 ${isLowestCost ? 'bg-success text-white' : ''}`}>
        <div className="d-flex align-items-center">
          <strong className="fs-5">{result.planName}</strong>
          {isLowestCost && (
            <Badge bg="warning" className="ms-2 text-dark">
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
    </div>
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

    </>
  );
};

export default ResultsTable;