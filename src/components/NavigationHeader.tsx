import React, { useState, useRef } from 'react';
import { Navbar, Nav } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';
import FAQButton, { FAQButtonRef } from './FAQButton';

interface NavigationHeaderProps {
  onFAQRef?: (ref: FAQButtonRef | null) => void;
}

const NavigationHeader: React.FC<NavigationHeaderProps> = ({ onFAQRef }) => {
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
      <div className="d-none d-md-flex align-items-center gap-3">
        <button
          type="button"
          className="btn btn-link nav-link text-primary text-decoration-none p-0"
          onClick={e => {
            e.preventDefault();
            faqRef.current?.openFAQ();
          }}
        >
          FAQ
        </button>
      </div>

      {/* Mobile Hamburger Menu */}
      <Navbar expand="md" className="d-md-none p-0">
        <Navbar.Toggle
          aria-controls="mobile-nav"
          onClick={() => setExpanded(!expanded)}
          className="border-0 p-1"
          style={{
            background: 'transparent',
            boxShadow: 'none',
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
                onClick={e => {
                  e.preventDefault();
                  faqRef.current?.openFAQ();
                  setExpanded(false);
                }}
              >
                FAQ
              </Nav.Link>
            </Nav.Item>
          </Nav>
        </Navbar.Collapse>
      </Navbar>

      {/* FAQ Component - only modal, no button */}
      <FAQButton ref={faqRef} showButton={false} />
    </div>
  );
};

export default NavigationHeader;
