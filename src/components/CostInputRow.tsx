import React from 'react';
import { Row, Col, Form, InputGroup } from 'react-bootstrap';
import FormattedNumberInput from './FormattedNumberInput';
import HelpIcon from './HelpIcon';

interface CostInputRowProps {
  inNetworkValue: number;
  outOfNetworkValue: number;
  onInNetworkChange: (value: number) => void;
  onOutOfNetworkChange: (value: number) => void;
  inNetworkHelpTitle: string;
  outOfNetworkHelpTitle: string;
  inNetworkHelpContent: React.ReactNode;
  outOfNetworkHelpContent: React.ReactNode;
}

const CostInputRow: React.FC<CostInputRowProps> = ({
  inNetworkValue,
  outOfNetworkValue,
  onInNetworkChange,
  onOutOfNetworkChange,
  inNetworkHelpTitle,
  outOfNetworkHelpTitle,
  inNetworkHelpContent,
  outOfNetworkHelpContent,
}) => {
  return (
    <Row>
      <Col md={6} className="mb-3 mb-md-0">
        <Form.Group>
          <Form.Label className="d-flex justify-content-between">
            <span>In-Network</span>
            <HelpIcon
              title={inNetworkHelpTitle}
              content={inNetworkHelpContent}
            />
          </Form.Label>
          <InputGroup>
            <InputGroup.Text>$</InputGroup.Text>
            <FormattedNumberInput
              value={inNetworkValue}
              onChange={onInNetworkChange}
              min={0}
              step={50}
            />
          </InputGroup>
        </Form.Group>
      </Col>
      <Col md={6}>
        <Form.Group>
          <Form.Label className="d-flex justify-content-between">
            <span>Out-of-Network</span>
            <HelpIcon
              title={outOfNetworkHelpTitle}
              content={outOfNetworkHelpContent}
            />
          </Form.Label>
          <InputGroup>
            <InputGroup.Text>$</InputGroup.Text>
            <FormattedNumberInput
              value={outOfNetworkValue}
              onChange={onOutOfNetworkChange}
              min={0}
              step={50}
            />
          </InputGroup>
        </Form.Group>
      </Col>
    </Row>
  );
};

export default CostInputRow;