import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock } from '@fortawesome/free-solid-svg-icons';

interface PrivacyNoteProps {
  children?: React.ReactNode;
  className?: string;
}

/** Reminds people that what they enter never leaves their browser. */
const PrivacyNote: React.FC<PrivacyNoteProps> = ({ children, className = '' }) => (
  <div className={`small text-muted d-flex align-items-baseline gap-2 ${className}`}>
    <FontAwesomeIcon icon={faLock} />
    <span>
      {children ?? 'Everything you enter stays in your browser. Nothing is sent anywhere.'}
    </span>
  </div>
);

export default PrivacyNote;
