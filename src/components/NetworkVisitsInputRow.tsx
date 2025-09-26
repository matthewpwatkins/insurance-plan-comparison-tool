import React from 'react';
import { Row, Col, Form, InputGroup, Badge } from 'react-bootstrap';
import FormattedNumberInput from './FormattedNumberInput';
import HelpIcon from './HelpIcon';
import { NetworkVisits } from '../types';

interface NetworkVisitsInputRowProps {
  inNetworkValue: NetworkVisits;
  outOfNetworkValue: NetworkVisits;
  onInNetworkChange: (value: NetworkVisits) => void;
  onOutOfNetworkChange: (value: NetworkVisits) => void;
  inNetworkHelpTitle: string;
  outOfNetworkHelpTitle: string;
  inNetworkHelpContent: React.ReactNode;
  outOfNetworkHelpContent: React.ReactNode;
  inNetworkIsFree?: boolean;
  outOfNetworkIsFree?: boolean;
}

const NetworkVisitsInputRow: React.FC<NetworkVisitsInputRowProps> = ({
  inNetworkValue,
  outOfNetworkValue,
  onInNetworkChange,
  onOutOfNetworkChange,
  inNetworkHelpTitle,
  outOfNetworkHelpTitle,
  inNetworkHelpContent,
  outOfNetworkHelpContent,
  inNetworkIsFree = false,
  outOfNetworkIsFree = false,
}) => {
  return (
    <Row>
      <Col md={6} className="mb-3 mb-md-0">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="d-flex align-items-center">
            <strong>In-Network</strong>
            {inNetworkIsFree && (
              <Badge bg="primary" className="ms-2">Free</Badge>
            )}
          </div>
          <HelpIcon
            title={inNetworkHelpTitle}
            content={inNetworkHelpContent}
          />
        </div>
        <Row>
          <Col xs={6}>
            <Form.Group>
              <Form.Label className="small text-muted">Visits/Uses</Form.Label>
              <FormattedNumberInput
                value={inNetworkValue.quantity}
                onChange={(value) => onInNetworkChange({ ...inNetworkValue, quantity: value })}
                min={0}
                step={1}
                decimalPlaces={0}
                disabled={inNetworkIsFree}
              />
            </Form.Group>
          </Col>
          <Col xs={6}>
            <Form.Group>
              <Form.Label className="small text-muted">Avg Cost Per Visit</Form.Label>
              <InputGroup>
                <InputGroup.Text>$</InputGroup.Text>
                <FormattedNumberInput
                  value={inNetworkValue.costPerVisit}
                  onChange={(value) => onInNetworkChange({ ...inNetworkValue, costPerVisit: value })}
                  min={0}
                  step={10}
                  disabled={inNetworkIsFree}
                />
              </InputGroup>
            </Form.Group>
          </Col>
        </Row>
      </Col>

      <Col md={6}>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="d-flex align-items-center">
            <strong>Out-of-Network</strong>
            {outOfNetworkIsFree && (
              <Badge bg="primary" className="ms-2">Free</Badge>
            )}
          </div>
          <HelpIcon
            title={outOfNetworkHelpTitle}
            content={outOfNetworkHelpContent}
          />
        </div>
        <Row>
          <Col xs={6}>
            <Form.Group>
              <Form.Label className="small text-muted">Visits/Uses</Form.Label>
              <FormattedNumberInput
                value={outOfNetworkValue.quantity}
                onChange={(value) => onOutOfNetworkChange({ ...outOfNetworkValue, quantity: value })}
                min={0}
                step={1}
                decimalPlaces={0}
                disabled={outOfNetworkIsFree}
              />
            </Form.Group>
          </Col>
          <Col xs={6}>
            <Form.Group>
              <Form.Label className="small text-muted">Avg Cost Per Visit</Form.Label>
              <InputGroup>
                <InputGroup.Text>$</InputGroup.Text>
                <FormattedNumberInput
                  value={outOfNetworkValue.costPerVisit}
                  onChange={(value) => onOutOfNetworkChange({ ...outOfNetworkValue, costPerVisit: value })}
                  min={0}
                  step={10}
                  disabled={outOfNetworkIsFree}
                />
              </InputGroup>
            </Form.Group>
          </Col>
        </Row>
      </Col>
    </Row>
  );
};

export default NetworkVisitsInputRow;