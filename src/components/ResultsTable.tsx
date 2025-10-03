import React from 'react';
import { Badge, Card, Row, Col } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faList } from '@fortawesome/free-solid-svg-icons';
import { formatCurrency } from '../utils/formatters';
import { PlanResult, ContributionType } from '../types';
import HelpIcon from './HelpIcon';

interface ResultsTableProps {
  results: PlanResult[];
  onShowWork: (result: PlanResult) => void;
}

const ResultsTable: React.FC<ResultsTableProps> = ({ results, onShowWork }) => {
  if (!results || results.length === 0) {
    return null;
  }

  const lowestCostAmount = results[0]?.totalCost;

  // Card View Component for All Screen Sizes
  const PlanCard: React.FC<{ result: PlanResult; isLowestCost: boolean }> = ({
    result,
    isLowestCost,
  }) => (
    <div className={isLowestCost ? 'mx-n3 mx-md-n4' : ''}>
      <Card
        className={`mb-4 ${isLowestCost ? 'border-success border-4 shadow-lg' : 'mb-3'}`}
        style={
          isLowestCost
            ? {
                transform: 'scale(1.05)',
                transformOrigin: 'center',
                position: 'relative',
                zIndex: 10,
                backgroundColor: '#d1e7dd',
              }
            : {}
        }
      >
        <Card.Header
          className={`d-flex justify-content-between align-items-center ${isLowestCost ? 'py-4 bg-success text-white' : 'py-3'}`}
        >
          <div className="d-flex align-items-center">
            <strong className={isLowestCost ? 'fs-4' : 'fs-5'}>{result.planName}</strong>
            {isLowestCost && (
              <Badge bg="warning" className="ms-3 text-dark fs-6 px-3 py-2">
                🏆 Best Value
              </Badge>
            )}
          </div>
          <div className="d-flex align-items-center gap-2">
            <Badge
              bg="info"
              className="fs-6"
              style={{ cursor: 'pointer' }}
              onClick={() => onShowWork(result)}
            >
              <FontAwesomeIcon icon={faList} /> Details
            </Badge>
          </div>
        </Card.Header>
        <Card.Body>
          <Row className="g-3">
            <Col xs={6} md={4} lg={3}>
              <small className="text-muted d-block">Your Premiums</small>
              <div className="fw-semibold fs-6">{formatCurrency(result.netAnnualPremiums)}</div>
            </Col>
            <Col xs={6} md={4} lg={3}>
              <small className="text-muted d-block">Your Out-of-Pocket Costs</small>
              <div className="fw-semibold fs-6">{formatCurrency(result.outOfPocketCosts)}</div>
            </Col>
            <Col xs={6} md={4} lg={3}>
              <small className="text-muted d-block">
                Your {result.contributionType === ContributionType.HSA ? 'HSA' : 'FSA'} Contribution
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
                {result.employerContribution > 0
                  ? 'Employer HSA Contribution'
                  : 'Employer Contribution'}
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
              <small className="text-muted d-block">Your Tax Savings</small>
              <div className="fw-semibold text-success fs-6">
                {result.taxSavings > 0 ? (
                  formatCurrency(result.taxSavings)
                ) : (
                  <span className="text-muted">$0</span>
                )}
              </div>
            </Col>
            <Col xs={6} md={4} lg={3}>
              <small className="text-muted d-block">Your Total Cost</small>
              <div className={`fs-4 fw-bold ${isLowestCost ? 'text-success' : 'text-primary'}`}>
                {formatCurrency(result.totalCost)}
              </div>
            </Col>
            <Col xs={6} md={4} lg={3}>
              <small className="text-muted d-block">
                Worst Case Cost{' '}
                <HelpIcon
                  title="Worst Case Cost"
                  content={
                    <div>
                      <p>
                        This is the <strong>absolute maximum</strong> you would ever pay in a year
                        with this plan, assuming you hit your out-of-pocket maximum.
                      </p>
                      <p>
                        It includes:
                        <ul>
                          <li>Net annual premiums (after pre-tax discount)</li>
                          <li>Out-of-pocket maximum</li>
                          <li>Minus employer contributions</li>
                          <li>Minus tax savings from HSA/FSA contributions</li>
                        </ul>
                      </p>
                      <p>
                        This represents your worst-case financial exposure for the year. No matter
                        how much healthcare you use, you won't pay more than this amount.
                      </p>
                      <p>
                        <strong>Note:</strong> This is the flatline value you'll see for this plan
                        on the Cost Comparison Chart at the bottom of the page.
                      </p>
                    </div>
                  }
                />
              </small>
              <div className="fw-semibold text-danger fs-6">
                {formatCurrency(result.maxAnnualCost)}
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
        {results.map(result => {
          const isLowestCost = result.totalCost === lowestCostAmount;
          return <PlanCard key={result.planName} result={result} isLowestCost={isLowestCost} />;
        })}
      </div>
    </>
  );
};

export default ResultsTable;
