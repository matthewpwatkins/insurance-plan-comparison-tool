import { UserInputs, PartialUserInputs } from '../types';

/**
 * Convert UserInputs to URL search parameters
 */
export const userInputsToURLParams = (inputs: UserInputs): URLSearchParams => {
  const params = new URLSearchParams();

  params.set('year', inputs.year.toString());
  params.set('coverage', inputs.coverage);
  params.set('ageGroup', inputs.ageGroup);
  params.set('taxRate', inputs.taxRate.toString());
  params.set('hsaContribution', inputs.hsaContribution.toString());
  params.set('fsaContribution', inputs.fsaContribution.toString());

  // Serialize costs object
  if (inputs.costs.categoryEstimates && inputs.costs.categoryEstimates.length > 0) {
    params.set('categoryEstimates', JSON.stringify(inputs.costs.categoryEstimates));
  }

  if (inputs.costs.otherCosts) {
    params.set('otherCosts', JSON.stringify(inputs.costs.otherCosts));
  }

  return params;
};

/**
 * Parse URL search parameters into UserInputs
 */
export const urlParamsToUserInputs = (searchParams: URLSearchParams): PartialUserInputs => {
  const updates: PartialUserInputs = {};

  // Parse year
  const year = searchParams.get('year');
  if (year && (year === '2025' || year === '2026')) {
    updates.year = parseInt(year);
  }

  // Parse coverage
  const coverage = searchParams.get('coverage');
  if (coverage && ['single', 'two_party', 'family'].includes(coverage)) {
    updates.coverage = coverage as 'single' | 'two_party' | 'family';
  }

  // Parse age group
  const ageGroup = searchParams.get('ageGroup');
  if (ageGroup && ['under_55', '55_plus'].includes(ageGroup)) {
    updates.ageGroup = ageGroup as 'under_55' | '55_plus';
  }

  // Parse tax rate
  const taxRate = searchParams.get('taxRate');
  if (taxRate) {
    const parsed = parseFloat(taxRate);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      updates.taxRate = parsed;
    }
  }


  // Parse HSA contribution
  const hsaContribution = searchParams.get('hsaContribution');
  if (hsaContribution) {
    const parsed = parseFloat(hsaContribution);
    if (!isNaN(parsed) && parsed >= 0) {
      updates.hsaContribution = parsed;
    }
  }

  // Parse FSA contribution
  const fsaContribution = searchParams.get('fsaContribution');
  if (fsaContribution) {
    const parsed = parseFloat(fsaContribution);
    if (!isNaN(parsed) && parsed >= 0) {
      updates.fsaContribution = parsed;
    }
  }

  // Parse costs object
  const categoryEstimatesParam = searchParams.get('categoryEstimates');
  const otherCostsParam = searchParams.get('otherCosts');

  if (categoryEstimatesParam || otherCostsParam) {
    updates.costs = {};

    if (categoryEstimatesParam) {
      try {
        const categoryEstimates = JSON.parse(categoryEstimatesParam);
        if (Array.isArray(categoryEstimates)) {
          updates.costs.categoryEstimates = categoryEstimates.filter(estimate =>
            estimate &&
            typeof estimate.categoryId === 'string' &&
            typeof estimate.inNetworkCost === 'number' &&
            typeof estimate.outOfNetworkCost === 'number'
          );
        }
      } catch (error) {
        console.error('Failed to parse categoryEstimates from URL:', error);
      }
    }

    if (otherCostsParam) {
      try {
        const otherCosts = JSON.parse(otherCostsParam);
        if (otherCosts &&
            typeof otherCosts.inNetworkCost === 'number' &&
            typeof otherCosts.outOfNetworkCost === 'number') {
          updates.costs.otherCosts = otherCosts;
        }
      } catch (error) {
        console.error('Failed to parse otherCosts from URL:', error);
      }
    }
  }

  return updates;
};

/**
 * Update browser URL with current user inputs
 */
export const updateURL = (inputs: UserInputs): void => {
  const params = userInputsToURLParams(inputs);
  const newURL = `${window.location.pathname}?${params.toString()}`;

  // Use pushState to update URL without reloading page
  window.history.replaceState({}, '', newURL);
};

/**
 * Get current URL with parameters for sharing
 */
export const getShareableURL = (inputs: UserInputs): string => {
  const params = userInputsToURLParams(inputs);
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
};

/**
 * Copy URL to clipboard
 */
export const copyURLToClipboard = async (inputs: UserInputs): Promise<boolean> => {
  try {
    const url = getShareableURL(inputs);
    await navigator.clipboard.writeText(url);
    return true;
  } catch (error) {
    console.error('Failed to copy URL to clipboard:', error);
    return false;
  }
};

/**
 * Read URL parameters on page load
 */
export const readURLParamsOnLoad = (): PartialUserInputs => {
  const searchParams = new URLSearchParams(window.location.search);
  return urlParamsToUserInputs(searchParams);
};