import React from 'react';
import { Card, Form, Row, Col, InputGroup } from 'react-bootstrap';
import FormattedNumberInput from './FormattedNumberInput';
import HelpIcon from './HelpIcon';
import { UserInputs } from '../types';

interface OtherCostsSectionProps {
  inputs: UserInputs;
  onChange: (updates: Partial<UserInputs>) => void;
}

const OtherCostsSection: React.FC<OtherCostsSectionProps> = ({ inputs, onChange }) => {
  const updateOtherCosts = (field: 'inNetworkCost' | 'outOfNetworkCost', value: number) => {
    onChange({
      costs: {
        ...inputs.costs,
        otherCosts: {
          inNetworkCost: field === 'inNetworkCost' ? value : (inputs.costs.otherCosts?.inNetworkCost || 0),
          outOfNetworkCost: field === 'outOfNetworkCost' ? value : (inputs.costs.otherCosts?.outOfNetworkCost || 0)
        }
      }
    });
  };

  return (
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
              <Form.Label className="position-relative">
                In-Network Annual Cost
                <HelpIcon
                  title="In-Network Costs"
                  content={
                    <div>
                      <p>Estimate your annual healthcare costs when using <strong>in-network</strong> providers.</p>
                      <p><strong>In-network providers:</strong></p>
                      <ul>
                        <li>Have contracts with your insurance plan</li>
                        <li>Offer lower costs and better coverage</li>
                        <li>Apply toward your deductible and out-of-pocket maximum</li>
                      </ul>
                      <p><strong>Include costs like:</strong></p>
                      <ul>
                        <li>Medical services not covered by specific categories</li>
                        <li>Additional visits beyond what you've specified</li>
                        <li>Unexpected medical needs</li>
                      </ul>
                      <p>This uses your plan's default coinsurance rates after deductible.</p>
                    </div>
                  }
                />
              </Form.Label>
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
              <Form.Label className="position-relative">
                Out-of-Network Annual Cost
                <HelpIcon
                  title="Out-of-Network Costs"
                  content={
                    <div>
                      <p>Estimate your annual healthcare costs when using <strong>out-of-network</strong> providers.</p>
                      <p><strong>Out-of-network providers:</strong></p>
                      <ul>
                        <li>Don't have contracts with your insurance plan</li>
                        <li>Result in higher costs and less coverage</li>
                        <li>May have separate deductibles and out-of-pocket maximums</li>
                      </ul>
                      <p><strong>Important considerations:</strong></p>
                      <ul>
                        <li>You may pay significantly more</li>
                        <li>You might need to pay upfront and get reimbursed</li>
                        <li>Some plans don't cover out-of-network care at all</li>
                      </ul>
                      <p>Leave at $0 if you plan to stay in-network. This uses your plan's out-of-network coinsurance rates.</p>
                    </div>
                  }
                />
              </Form.Label>
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
  );
};

export default OtherCostsSection;