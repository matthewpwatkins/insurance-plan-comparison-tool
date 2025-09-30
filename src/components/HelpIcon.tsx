import React, { useState } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';

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
        className={`text-info ${className}`}
        style={{
          cursor: 'pointer',
          fontSize: '1em',
        }}
        onClick={() => setShowModal(true)}
        title="Click for help"
      >
        <FontAwesomeIcon icon={faCircleInfo} />
      </span>

      <Modal show={showModal} onHide={() => setShowModal(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>{content}</Modal.Body>
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
