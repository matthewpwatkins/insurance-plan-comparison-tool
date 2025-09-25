import React, { useState, useEffect } from 'react';
import { Form } from 'react-bootstrap';
import { formatNumber, parseFormattedNumber } from '../utils/formatters';

interface FormattedNumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  placeholder?: string;
  [key: string]: any; // For additional props
}

const FormattedNumberInput: React.FC<FormattedNumberInputProps> = ({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  required = false,
  placeholder = '',
  ...props
}) => {
  const [displayValue, setDisplayValue] = useState('');

  // Update display value when prop value changes
  useEffect(() => {
    if (value !== null && value !== undefined) {
      setDisplayValue(formatNumber(value));
    } else {
      setDisplayValue('');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    // Allow user to type freely, but parse on blur
    setDisplayValue(inputValue);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const numericValue = parseFormattedNumber(inputValue);

    // Constrain to min/max
    let constrainedValue = numericValue;
    if (min !== undefined && constrainedValue < min) {
      constrainedValue = min;
    }
    if (max !== undefined && constrainedValue > max) {
      constrainedValue = max;
    }

    // Update parent component
    onChange(constrainedValue);

    // Update display with properly formatted value
    setDisplayValue(formatNumber(constrainedValue));
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Remove formatting on focus for easier editing
    const numericValue = parseFormattedNumber(displayValue);
    setDisplayValue(numericValue.toString());
    e.target.select(); // Select all text for easy replacement
  };

  return (
    <Form.Control
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      placeholder={placeholder}
      required={required}
      {...props}
    />
  );
};

export default FormattedNumberInput;