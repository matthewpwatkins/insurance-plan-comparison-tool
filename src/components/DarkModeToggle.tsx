import React from 'react';
import { Button } from 'react-bootstrap';
import { useDarkMode } from '../contexts/DarkModeContext';

const DarkModeToggle: React.FC = () => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  return (
    <Button
      variant="outline-secondary"
      size="sm"
      onClick={toggleDarkMode}
      className="ms-2 border-0"
      title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.2em',
        transition: 'all 0.3s ease'
      }}
    >
      {isDarkMode ? '☀️' : '🌙'}
    </Button>
  );
};

export default DarkModeToggle;