import React from 'react';
import { Row, Col, Form, InputGroup } from 'react-bootstrap';
import FormattedNumberInput from './FormattedNumberInput';
import HelpIcon from './HelpIcon';

interface QuantityAndCostInputRowProps {
  quantityValue: number;
  costValue: number;
  onQuantityChange: (value: number) => void;
  onCostChange: (value: number) => void;
  quantityHelpTitle: string;
  costHelpTitle: string;
  quantityHelpContent: React.ReactNode;
  costHelpContent: React.ReactNode;
}

const QuantityAndCostInputRow: React.FC<QuantityAndCostInputRowProps> = ({
  quantityValue,
  costValue,
  onQuantityChange,
  onCostChange,
  quantityHelpTitle,
  costHelpTitle,
  quantityHelpContent,
  costHelpContent,
}) => {
  return (
    <Row>
      <Col md={6} className="mb-3 mb-md-0">
        <Form.Group>
          <Form.Label className="d-flex justify-content-between">
            <span>Expected Visits/Uses</span>
            <HelpIcon
              title={quantityHelpTitle}
              content={quantityHelpContent}
            />
          </Form.Label>
          <FormattedNumberInput
            value={quantityValue}
            onChange={onQuantityChange}
            min={0}
            step={1}
            decimalPlaces={0}
          />
        </Form.Group>
      </Col>
      <Col md={6}>
        <Form.Group>
          <Form.Label className="d-flex justify-content-between">
            <span>Avg Cost Per Visit</span>
            <HelpIcon
              title={costHelpTitle}
              content={costHelpContent}
            />
          </Form.Label>
          <InputGroup>
            <InputGroup.Text>$</InputGroup.Text>
            <FormattedNumberInput
              value={costValue}
              onChange={onCostChange}
              min={0}
              step={10}
            />
          </InputGroup>
        </Form.Group>
      </Col>
    </Row>
  );
};

export default QuantityAndCostInputRow;