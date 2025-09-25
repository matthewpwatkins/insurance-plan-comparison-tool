import React, { useState } from 'react';
import { Button, Toast, ToastContainer } from 'react-bootstrap';
import { copyURLToClipboard } from '../utils/urlParams';
import { UserInputs } from '../types';

interface ShareButtonProps {
  userInputs: UserInputs;
  className?: string;
  variant?: string;
  size?: 'sm' | 'lg';
}

const ShareButton: React.FC<ShareButtonProps> = ({
  userInputs,
  className = '',
  variant = 'primary',
  size
}) => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVariant, setToastVariant] = useState<'success' | 'danger'>('success');

  const handleShare = async () => {
    const success = await copyURLToClipboard(userInputs);

    if (success) {
      setToastMessage('✅ URL copied to clipboard! Share this link with others.');
      setToastVariant('success');
    } else {
      setToastMessage('❌ Failed to copy URL. Please try again.');
      setToastVariant('danger');
    }

    setShowToast(true);
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleShare}
      >
        🔗 Share
      </Button>

      <ToastContainer
        position="top-end"
        className="p-3"
        style={{ zIndex: 1050 }}
      >
        <Toast
          show={showToast}
          onClose={() => setShowToast(false)}
          delay={4000}
          autohide
          bg={toastVariant}
        >
          <Toast.Header>
            <strong className="me-auto">
              {toastVariant === 'success' ? 'Success!' : 'Error'}
            </strong>
          </Toast.Header>
          <Toast.Body className="text-white">
            {toastMessage}
          </Toast.Body>
        </Toast>
      </ToastContainer>
    </>
  );
};

export default ShareButton;