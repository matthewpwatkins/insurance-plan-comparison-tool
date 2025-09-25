import React, { useState, useRef } from 'react';
import { Navbar, Nav, Container } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';
import ShareButton from './ShareButton';
import FAQButton, { FAQButtonRef } from './FAQButton';
import { UserInputs } from '../types';

interface NavigationHeaderProps {
  userInputs: UserInputs;
  onFAQRef?: (ref: FAQButtonRef | null) => void;
}

const NavigationHeader: React.FC<NavigationHeaderProps> = ({ userInputs, onFAQRef }) => {
  const [expanded, setExpanded] = useState(false);
  const faqRef = useRef<FAQButtonRef>(null);

  // Expose the ref to parent component
  React.useEffect(() => {
    if (onFAQRef) {
      onFAQRef(faqRef.current);
    }
  }, [onFAQRef]);

  return (
    <div className="d-flex justify-content-between align-items-center mb-3">
      <h1 className="mb-0">DMBA Health Plan Comparison Tool</h1>

      {/* Desktop Navigation */}
      <div className="d-none d-md-flex">
        <FAQButton ref={faqRef} />
        <ShareButton userInputs={userInputs} />
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
            <Nav.Item className="p-1">
              <FAQButton ref={faqRef} />
            </Nav.Item>
            <Nav.Item className="p-1">
              <ShareButton userInputs={userInputs} />
            </Nav.Item>
          </Nav>
        </Navbar.Collapse>
      </Navbar>
    </div>
  );
};

export default NavigationHeader;