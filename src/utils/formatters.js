/**
 * Format a number as currency with commas
 * @param {number} amount - The amount to format
 * @param {boolean} showCents - Whether to show cents (default: false)
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, showCents = false) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '$0';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(amount);
};

/**
 * Format a number with commas (no currency symbol)
 * @param {number} num - The number to format
 * @returns {string} Formatted number string
 */
export const formatNumber = (num) => {
  if (num === null || num === undefined || isNaN(num)) {
    return '0';
  }

  return new Intl.NumberFormat('en-US').format(num);
};

/**
 * Parse a formatted number string back to a number
 * Removes commas and currency symbols
 * @param {string} str - The formatted string
 * @returns {number} Parsed number
 */
export const parseFormattedNumber = (str) => {
  if (!str) return 0;

  // Remove commas, dollar signs, and other non-digit characters except decimal points
  const cleaned = str.toString().replace(/[,$]/g, '');
  const parsed = parseFloat(cleaned);

  return isNaN(parsed) ? 0 : parsed;
};