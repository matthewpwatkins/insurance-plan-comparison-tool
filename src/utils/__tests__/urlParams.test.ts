import {
  userInputsToURLParams,
  urlParamsToUserInputs,
  updateURL,
  getShareableURL,
  copyURLToClipboard,
  readURLParamsOnLoad,
} from '../urlParams';
import { UserInputs } from '../../types';

// Mock window.location and window.history
const mockLocation = {
  pathname: '/test-path',
  origin: 'https://example.com',
  search: '',
};

const mockHistory = {
  replaceState: jest.fn(),
};

const mockNavigator = {
  clipboard: {
    writeText: jest.fn(),
  },
};

// Store original values
const originalLocation = window.location;
const originalHistory = window.history;
const originalNavigator = window.navigator;

describe('urlParams', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // Mock window objects
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true,
    });
    Object.defineProperty(window, 'history', {
      value: mockHistory,
      writable: true,
    });
    Object.defineProperty(window, 'navigator', {
      value: mockNavigator,
      writable: true,
    });
  });

  afterAll(() => {
    // Restore original values
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
    Object.defineProperty(window, 'history', {
      value: originalHistory,
      writable: true,
    });
    Object.defineProperty(window, 'navigator', {
      value: originalNavigator,
      writable: true,
    });
  });

  const mockUserInputs: UserInputs = {
    year: 2025,
    coverage: 'single',
    ageGroup: 'under_55',
    taxRate: 22,
    costs: {
      categoryEstimates: [],
    },
    hsaContribution: 2000,
    fsaContribution: 1500,
  };

  describe('userInputsToURLParams', () => {
    it('should convert user inputs to URL parameters correctly', () => {
      const params = userInputsToURLParams(mockUserInputs);

      expect(params.get('year')).toBe('2025');
      expect(params.get('coverage')).toBe('single');
      expect(params.get('ageGroup')).toBe('under_55');
      expect(params.get('taxRate')).toBe('22');
      expect(params.get('hsaContribution')).toBe('2000');
      expect(params.get('fsaContribution')).toBe('1500');
    });

    it('should handle different coverage types', () => {
      const inputs = { ...mockUserInputs, coverage: 'family' as const };
      const params = userInputsToURLParams(inputs);
      expect(params.get('coverage')).toBe('family');
    });

    it('should handle different age groups', () => {
      const inputs = { ...mockUserInputs, ageGroup: '55_plus' as const };
      const params = userInputsToURLParams(inputs);
      expect(params.get('ageGroup')).toBe('55_plus');
    });

    it('should handle decimal tax rates', () => {
      const inputs = { ...mockUserInputs, taxRate: 22.5 };
      const params = userInputsToURLParams(inputs);
      expect(params.get('taxRate')).toBe('22.5');
    });

    it('should handle zero contributions', () => {
      const inputs = { ...mockUserInputs, hsaContribution: 0, fsaContribution: 0 };
      const params = userInputsToURLParams(inputs);
      expect(params.get('hsaContribution')).toBe('0');
      expect(params.get('fsaContribution')).toBe('0');
    });
  });

  describe('urlParamsToUserInputs', () => {
    it('should parse valid URL parameters correctly', () => {
      const searchParams = new URLSearchParams();
      searchParams.set('year', '2025');
      searchParams.set('coverage', 'single');
      searchParams.set('ageGroup', 'under_55');
      searchParams.set('taxRate', '22');
      searchParams.set('hsaContribution', '2000');
      searchParams.set('fsaContribution', '1500');

      const result = urlParamsToUserInputs(searchParams);

      expect(result.year).toBe(2025);
      expect(result.coverage).toBe('single');
      expect(result.ageGroup).toBe('under_55');
      expect(result.taxRate).toBe(22);
      expect(result.hsaContribution).toBe(2000);
      expect(result.fsaContribution).toBe(1500);
    });

    it('should handle missing parameters gracefully', () => {
      const searchParams = new URLSearchParams();
      const result = urlParamsToUserInputs(searchParams);

      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should ignore invalid year values', () => {
      const searchParams = new URLSearchParams();
      searchParams.set('year', '2024'); // Not in allowed list
      const result = urlParamsToUserInputs(searchParams);

      expect(result.year).toBeUndefined();
    });

    it('should accept valid years', () => {
      const searchParams1 = new URLSearchParams();
      searchParams1.set('year', '2025');
      const result1 = urlParamsToUserInputs(searchParams1);
      expect(result1.year).toBe(2025);

      const searchParams2 = new URLSearchParams();
      searchParams2.set('year', '2026');
      const result2 = urlParamsToUserInputs(searchParams2);
      expect(result2.year).toBe(2026);
    });

    it('should ignore invalid coverage values', () => {
      const searchParams = new URLSearchParams();
      searchParams.set('coverage', 'invalid');
      const result = urlParamsToUserInputs(searchParams);

      expect(result.coverage).toBeUndefined();
    });

    it('should accept valid coverage values', () => {
      const validCoverages = ['single', 'two_party', 'family'];

      validCoverages.forEach(coverage => {
        const searchParams = new URLSearchParams();
        searchParams.set('coverage', coverage);
        const result = urlParamsToUserInputs(searchParams);
        expect(result.coverage).toBe(coverage);
      });
    });

    it('should ignore invalid age group values', () => {
      const searchParams = new URLSearchParams();
      searchParams.set('ageGroup', 'invalid');
      const result = urlParamsToUserInputs(searchParams);

      expect(result.ageGroup).toBeUndefined();
    });

    it('should accept valid age group values', () => {
      const validAgeGroups = ['under_55', '55_plus'];

      validAgeGroups.forEach(ageGroup => {
        const searchParams = new URLSearchParams();
        searchParams.set('ageGroup', ageGroup);
        const result = urlParamsToUserInputs(searchParams);
        expect(result.ageGroup).toBe(ageGroup);
      });
    });

    it('should validate tax rate range', () => {
      const searchParams1 = new URLSearchParams();
      searchParams1.set('taxRate', '-5'); // Below 0
      const result1 = urlParamsToUserInputs(searchParams1);
      expect(result1.taxRate).toBeUndefined();

      const searchParams2 = new URLSearchParams();
      searchParams2.set('taxRate', '105'); // Above 100
      const result2 = urlParamsToUserInputs(searchParams2);
      expect(result2.taxRate).toBeUndefined();

      const searchParams3 = new URLSearchParams();
      searchParams3.set('taxRate', '22'); // Valid
      const result3 = urlParamsToUserInputs(searchParams3);
      expect(result3.taxRate).toBe(22);
    });

    it('should handle invalid tax rate strings', () => {
      const searchParams = new URLSearchParams();
      searchParams.set('taxRate', 'abc');
      const result = urlParamsToUserInputs(searchParams);

      expect(result.taxRate).toBeUndefined();
    });

    it('should validate contribution amounts', () => {
      const searchParams1 = new URLSearchParams();
      searchParams1.set('hsaContribution', '-100'); // Negative
      const result1 = urlParamsToUserInputs(searchParams1);
      expect(result1.hsaContribution).toBeUndefined();

      const searchParams2 = new URLSearchParams();
      searchParams2.set('fsaContribution', 'abc'); // Non-numeric
      const result2 = urlParamsToUserInputs(searchParams2);
      expect(result2.fsaContribution).toBeUndefined();

      const searchParams3 = new URLSearchParams();
      searchParams3.set('hsaContribution', '2000'); // Valid
      searchParams3.set('fsaContribution', '1500'); // Valid
      const result3 = urlParamsToUserInputs(searchParams3);
      expect(result3.hsaContribution).toBe(2000);
      expect(result3.fsaContribution).toBe(1500);
    });

    it('should handle decimal contributions', () => {
      const searchParams = new URLSearchParams();
      searchParams.set('hsaContribution', '2000.50');
      searchParams.set('fsaContribution', '1500.25');
      const result = urlParamsToUserInputs(searchParams);

      expect(result.hsaContribution).toBe(2000.50);
      expect(result.fsaContribution).toBe(1500.25);
    });

    it('should handle zero contributions', () => {
      const searchParams = new URLSearchParams();
      searchParams.set('hsaContribution', '0');
      searchParams.set('fsaContribution', '0');
      const result = urlParamsToUserInputs(searchParams);

      expect(result.hsaContribution).toBe(0);
      expect(result.fsaContribution).toBe(0);
    });
  });

  describe('updateURL', () => {
    it('should call window.history.replaceState with correct URL', () => {
      updateURL(mockUserInputs);

      expect(mockHistory.replaceState).toHaveBeenCalledWith(
        {},
        '',
        '/test-path?year=2025&coverage=single&ageGroup=under_55&taxRate=22&hsaContribution=2000&fsaContribution=1500'
      );
    });
  });

  describe('getShareableURL', () => {
    it('should return full URL with parameters', () => {
      const url = getShareableURL(mockUserInputs);

      expect(url).toBe(
        'https://example.com/test-path?year=2025&coverage=single&ageGroup=under_55&taxRate=22&hsaContribution=2000&fsaContribution=1500'
      );
    });
  });

  describe('copyURLToClipboard', () => {
    it('should copy URL to clipboard and return true on success', async () => {
      mockNavigator.clipboard.writeText.mockResolvedValue(undefined);

      const result = await copyURLToClipboard(mockUserInputs);

      expect(result).toBe(true);
      expect(mockNavigator.clipboard.writeText).toHaveBeenCalledWith(
        'https://example.com/test-path?year=2025&coverage=single&ageGroup=under_55&taxRate=22&hsaContribution=2000&fsaContribution=1500'
      );
    });

    it('should return false on clipboard error', async () => {
      mockNavigator.clipboard.writeText.mockRejectedValue(new Error('Clipboard error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await copyURLToClipboard(mockUserInputs);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to copy URL to clipboard:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('readURLParamsOnLoad', () => {
    it('should read parameters from window.location.search', () => {
      Object.defineProperty(window, 'location', {
        value: {
          ...mockLocation,
          search: '?year=2025&coverage=family&taxRate=25',
        },
        writable: true,
      });

      const result = readURLParamsOnLoad();

      expect(result.year).toBe(2025);
      expect(result.coverage).toBe('family');
      expect(result.taxRate).toBe(25);
    });

    it('should handle empty search string', () => {
      Object.defineProperty(window, 'location', {
        value: {
          ...mockLocation,
          search: '',
        },
        writable: true,
      });

      const result = readURLParamsOnLoad();

      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('Round-trip consistency', () => {
    it('should maintain data integrity through URL conversion cycle', () => {
      const originalInputs = {
        year: 2026,
        coverage: 'family' as const,
        ageGroup: '55_plus' as const,
        taxRate: 32.5,
        hsaContribution: 4000,
        fsaContribution: 0,
      };

      // Convert to URL params and back
      const params = userInputsToURLParams(originalInputs as UserInputs);
      const parsedInputs = urlParamsToUserInputs(params);

      expect(parsedInputs.year).toBe(originalInputs.year);
      expect(parsedInputs.coverage).toBe(originalInputs.coverage);
      expect(parsedInputs.ageGroup).toBe(originalInputs.ageGroup);
      expect(parsedInputs.taxRate).toBe(originalInputs.taxRate);
      expect(parsedInputs.hsaContribution).toBe(originalInputs.hsaContribution);
      expect(parsedInputs.fsaContribution).toBe(originalInputs.fsaContribution);
    });
  });
});