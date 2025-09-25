import React from 'react';
import { Card, Form, Row, Col, InputGroup } from 'react-bootstrap';
import FormattedNumberInput from './FormattedNumberInput';
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
              <Form.Label>In-Network Annual Cost</Form.Label>
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
              <Form.Label>Out-of-Network Annual Cost</Form.Label>
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