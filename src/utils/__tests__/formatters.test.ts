import { formatCurrency, formatNumber, parseFormattedNumber } from '../formatters';

describe('formatters', () => {
  describe('formatCurrency', () => {
    it('should format positive numbers correctly without cents', () => {
      expect(formatCurrency(1234.56)).toBe('$1,235');
      expect(formatCurrency(1000)).toBe('$1,000');
      expect(formatCurrency(999)).toBe('$999');
      expect(formatCurrency(0)).toBe('$0');
    });

    it('should format positive numbers correctly with cents', () => {
      expect(formatCurrency(1234.56, true)).toBe('$1,234.56');
      expect(formatCurrency(1000, true)).toBe('$1,000.00');
      expect(formatCurrency(999.99, true)).toBe('$999.99');
      expect(formatCurrency(0, true)).toBe('$0.00');
    });

    it('should format negative numbers correctly', () => {
      expect(formatCurrency(-1234.56)).toBe('-$1,235');
      expect(formatCurrency(-1000)).toBe('-$1,000');
      expect(formatCurrency(-999.99, true)).toBe('-$999.99');
    });

    it('should handle null and undefined values', () => {
      expect(formatCurrency(null)).toBe('$0');
      expect(formatCurrency(undefined)).toBe('$0');
      expect(formatCurrency(null, true)).toBe('$0');
      expect(formatCurrency(undefined, true)).toBe('$0');
    });

    it('should handle NaN values', () => {
      expect(formatCurrency(NaN)).toBe('$0');
      expect(formatCurrency(NaN, true)).toBe('$0');
    });

    it('should round numbers appropriately when not showing cents', () => {
      expect(formatCurrency(1234.4)).toBe('$1,234');
      expect(formatCurrency(1234.5)).toBe('$1,235');
      expect(formatCurrency(1234.6)).toBe('$1,235');
    });

    it('should handle very large numbers', () => {
      expect(formatCurrency(1234567890)).toBe('$1,234,567,890');
      expect(formatCurrency(1234567890.12, true)).toBe('$1,234,567,890.12');
    });

    it('should handle very small numbers', () => {
      expect(formatCurrency(0.01)).toBe('$0');
      expect(formatCurrency(0.01, true)).toBe('$0.01');
      expect(formatCurrency(0.999, true)).toBe('$1.00');
    });
  });

  describe('formatNumber', () => {
    it('should format positive numbers with commas', () => {
      expect(formatNumber(1234)).toBe('1,234');
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(999)).toBe('999');
      expect(formatNumber(0)).toBe('0');
    });

    it('should format negative numbers with commas', () => {
      expect(formatNumber(-1234)).toBe('-1,234');
      expect(formatNumber(-1000)).toBe('-1,000');
      expect(formatNumber(-999)).toBe('-999');
    });

    it('should handle decimal numbers', () => {
      expect(formatNumber(1234.56)).toBe('1,234.56');
      expect(formatNumber(1000.1)).toBe('1,000.1');
      expect(formatNumber(999.999)).toBe('999.999');
    });

    it('should handle null and undefined values', () => {
      expect(formatNumber(null)).toBe('0');
      expect(formatNumber(undefined)).toBe('0');
    });

    it('should handle NaN values', () => {
      expect(formatNumber(NaN)).toBe('0');
    });

    it('should handle very large numbers', () => {
      expect(formatNumber(1234567890)).toBe('1,234,567,890');
      expect(formatNumber(1234567890.123)).toBe('1,234,567,890.123');
    });
  });

  describe('parseFormattedNumber', () => {
    it('should parse formatted currency strings', () => {
      expect(parseFormattedNumber('$1,234')).toBe(1234);
      expect(parseFormattedNumber('$1,234.56')).toBe(1234.56);
      expect(parseFormattedNumber('$0')).toBe(0);
    });

    it('should parse formatted number strings', () => {
      expect(parseFormattedNumber('1,234')).toBe(1234);
      expect(parseFormattedNumber('1,234.56')).toBe(1234.56);
      expect(parseFormattedNumber('999')).toBe(999);
    });

    it('should parse negative numbers', () => {
      expect(parseFormattedNumber('-$1,234')).toBe(-1234);
      expect(parseFormattedNumber('-1,234.56')).toBe(-1234.56);
    });

    it('should handle already numeric inputs', () => {
      expect(parseFormattedNumber(1234)).toBe(1234);
      expect(parseFormattedNumber(1234.56)).toBe(1234.56);
      expect(parseFormattedNumber(0)).toBe(0);
      expect(parseFormattedNumber(-1234)).toBe(-1234);
    });

    it('should handle empty and null inputs', () => {
      expect(parseFormattedNumber('')).toBe(0);
      expect(parseFormattedNumber('   ')).toBe(0);
      // @ts-ignore - testing runtime behavior
      expect(parseFormattedNumber(null)).toBe(0);
      // @ts-ignore - testing runtime behavior
      expect(parseFormattedNumber(undefined)).toBe(0);
    });

    it('should handle invalid strings', () => {
      expect(parseFormattedNumber('abc')).toBe(0);
      expect(parseFormattedNumber('$abc')).toBe(0);
      expect(parseFormattedNumber('1,2,3,4,a')).toBe(0);
    });

    it('should handle multiple dollar signs and commas', () => {
      expect(parseFormattedNumber('$$1,,234')).toBe(1234);
      expect(parseFormattedNumber('$1,2,3,4')).toBe(1234);
    });

    it('should handle decimal-only inputs', () => {
      expect(parseFormattedNumber('.56')).toBe(0.56);
      expect(parseFormattedNumber('$.56')).toBe(0.56);
      expect(parseFormattedNumber('$,,.56')).toBe(0.56);
    });

    it('should handle very large numbers', () => {
      expect(parseFormattedNumber('$1,234,567,890')).toBe(1234567890);
      expect(parseFormattedNumber('$1,234,567,890.12')).toBe(1234567890.12);
    });

    it('should handle strings with extra spaces', () => {
      expect(parseFormattedNumber(' $1,234 ')).toBe(1234);
      expect(parseFormattedNumber('  1,234.56  ')).toBe(1234.56);
    });

    it('should handle scientific notation', () => {
      expect(parseFormattedNumber('1.23e4')).toBe(12300);
      expect(parseFormattedNumber('$1.23e4')).toBe(12300);
    });
  });

  describe('Integration tests', () => {
    it('should format and parse numbers round-trip correctly', () => {
      const testNumbers = [0, 1, 999, 1000, 1234.56, -1234, 1000000];

      testNumbers.forEach(num => {
        const formatted = formatCurrency(num, true);
        const parsed = parseFormattedNumber(formatted);
        expect(parsed).toBeCloseTo(num, 2);
      });
    });

    it('should format and parse large numbers round-trip correctly', () => {
      const testNumbers = [1234567890, -1234567890.12, 999999999.99];

      testNumbers.forEach(num => {
        const formatted = formatNumber(num);
        const parsed = parseFormattedNumber(formatted);
        expect(parsed).toBeCloseTo(num, 2);
      });
    });
  });
});
