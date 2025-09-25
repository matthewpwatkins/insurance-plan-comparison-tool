import React, { useState } from 'react';
import { Modal, Button } from 'react-bootstrap';

interface HelpIconProps {
  title: string;
  content: React.ReactNode;
  className?: string;
}

const HelpIcon: React.FC<HelpIconProps> = ({ title, content, className = '' }) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <span
        className={`text-info ms-2 ${className}`}
        style={{ cursor: 'pointer', fontSize: '1.1em' }}
        onClick={() => setShowModal(true)}
        title="Click for help"
      >
        ❓
      </span>

      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {content}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={() => setShowModal(false)}>
            Got it!
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default HelpIcon;