/**
 * Format a number as currency with commas
 */
export const formatCurrency = (amount: number | null | undefined, showCents: boolean = false): string => {
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
 */
export const formatNumber = (num: number | null | undefined): string => {
  if (num === null || num === undefined || isNaN(num)) {
    return '0';
  }

  return new Intl.NumberFormat('en-US').format(num);
};

/**
 * Parse a formatted number string back to a number
 * Removes commas and currency symbols
 */
export const parseFormattedNumber = (str: string | number): number => {
  if (!str) return 0;

  // Remove commas, dollar signs, and other non-digit characters except decimal points
  const cleaned = str.toString().replace(/[,$]/g, '');
  const parsed = parseFloat(cleaned);

  return isNaN(parsed) ? 0 : parsed;
};