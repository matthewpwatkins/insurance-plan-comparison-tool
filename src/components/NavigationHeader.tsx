import React, { useState, useRef } from 'react';
import { Navbar, Nav, Container, Toast, ToastContainer } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';
import FAQButton, { FAQButtonRef } from './FAQButton';
import { copyURLToClipboard } from '../utils/urlParams';
import { UserInputs } from '../types';

interface NavigationHeaderProps {
  userInputs: UserInputs;
  onFAQRef?: (ref: FAQButtonRef | null) => void;
}

const NavigationHeader: React.FC<NavigationHeaderProps> = ({ userInputs, onFAQRef }) => {
  const [expanded, setExpanded] = useState(false);
  const faqRef = useRef<FAQButtonRef>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Expose the ref to parent component
  React.useEffect(() => {
    if (onFAQRef) {
      onFAQRef(faqRef.current);
    }
  }, [onFAQRef]);

  const handleShare = async () => {
    const success = await copyURLToClipboard(userInputs);
    if (success) {
      setToastMessage('URL copied to clipboard! Share this link with others.');
    } else {
      setToastMessage('Failed to copy URL. Please try again.');
    }
    setShowToast(true);
  };

  return (
    <div className="d-flex justify-content-between align-items-center mb-3">
      <h1 className="mb-0">DMBA Health Plan Comparison Tool</h1>

      {/* Desktop Navigation */}
      <div className="d-none d-md-flex align-items-center gap-3">
        <a
          href="#"
          className="nav-link text-primary text-decoration-none"
          onClick={(e) => {
            e.preventDefault();
            faqRef.current?.openFAQ();
          }}
        >
          FAQ
        </a>
        <a
          href="#"
          className="nav-link text-primary text-decoration-none"
          onClick={(e) => {
            e.preventDefault();
            handleShare();
          }}
        >
          Share
        </a>
      </div>

      {/* Mobile Hamburger Menu */}
      <Navbar expand="md" className="d-md-none p-0">
        <Navbar.Toggle
          aria-controls="mobile-nav"
          onClick={() => setExpanded(!expanded)}
          className="border-0 p-1"
          style={{
            background: 'transparent',
            boxShadow: 'none'
          }}
        >
          <FontAwesomeIcon icon={faBars} />
        </Navbar.Toggle>
        <Navbar.Collapse id="mobile-nav" in={expanded}>
          <Nav className="ms-auto">
            <Nav.Item>
              <Nav.Link
                href="#"
                className="text-primary"
                onClick={(e) => {
                  e.preventDefault();
                  faqRef.current?.openFAQ();
                  setExpanded(false);
                }}
              >
                FAQ
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link
                href="#"
                className="text-primary"
                onClick={(e) => {
                  e.preventDefault();
                  handleShare();
                  setExpanded(false);
                }}
              >
                Share
              </Nav.Link>
            </Nav.Item>
          </Nav>
        </Navbar.Collapse>
      </Navbar>

      {/* Toast for Share Feedback */}
      <ToastContainer position="top-end" className="position-fixed" style={{ top: '20px', right: '20px', zIndex: 9999 }}>
        <Toast
          show={showToast}
          onClose={() => setShowToast(false)}
          delay={3000}
          autohide
          bg="success"
        >
          <Toast.Body className="text-white">
            {toastMessage}
          </Toast.Body>
        </Toast>
      </ToastContainer>
    </div>
  );
};

export default NavigationHeader;