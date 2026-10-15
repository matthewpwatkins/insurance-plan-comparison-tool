import { UserInputs, PartialUserInputs, CoverageType } from '../types';

interface URLParamsResult extends PartialUserInputs {}

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

  return params;
};

/**
 * Parse URL search parameters into UserInputs
 */
export const urlParamsToUserInputs = (
  searchParams: URLSearchParams,
  availableYears: number[]
): URLParamsResult => {
  const updates: URLParamsResult = {};

  // Parse year
  const year = parseInt(searchParams.get('year') ?? '');
  if (availableYears.includes(year)) {
    updates.year = year;
  }

  // Parse coverage
  const coverage = searchParams.get('coverage');
  if (coverage) {
    if (coverage === 'single') updates.coverage = CoverageType.Single;
    else if (coverage === 'two_party') updates.coverage = CoverageType.TwoParty;
    else if (coverage === 'family') updates.coverage = CoverageType.Family;
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

  if (categoryEstimatesParam) {
    updates.costs = {};

    try {
      const categoryEstimates = JSON.parse(categoryEstimatesParam);
      if (Array.isArray(categoryEstimates)) {
        updates.costs.categoryEstimates = categoryEstimates.filter(
          estimate =>
            estimate &&
            typeof estimate.categoryId === 'string' &&
            estimate.estimate &&
            typeof estimate.estimate.quantity === 'number' &&
            typeof estimate.estimate.costPerVisit === 'number' &&
            typeof estimate.estimate.isInNetwork === 'boolean'
        );
      }
    } catch (error) {
      console.error('Failed to parse categoryEstimates from URL:', error);
    }
  }

  return updates;
};

/**
 * Update browser URL with current user inputs
 */
export const updateURL = (inputs: UserInputs): void => {
  window.history.replaceState({}, '', resultsURL(inputs));
};

/** The results page for these inputs, e.g. /dmba/results?coverage=family... */
const resultsURL = (inputs: UserInputs): string =>
  `/${readCompanySlugFromPath()}/results?${userInputsToURLParams(inputs).toString()}`;

/** Whether the URL is a results page, which opens with the comparison already run. */
export const isResultsPath = (pathname: string = window.location.pathname): boolean =>
  pathname.split('/').filter(Boolean)[1] === 'results';

/**
 * Get current URL with parameters for sharing
 */
export const getShareableURL = (inputs: UserInputs): string => {
  return `${window.location.origin}${resultsURL(inputs)}`;
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
export const readURLParamsOnLoad = (availableYears: number[]): URLParamsResult => {
  const searchParams = new URLSearchParams(window.location.search);
  return urlParamsToUserInputs(searchParams, availableYears);
};

/**
 * Company slug is the first path segment, e.g. /dmba. Empty string when on the root.
 */
export const readCompanySlugFromPath = (pathname: string = window.location.pathname): string => {
  const [segment] = pathname.split('/').filter(Boolean);
  return (segment ?? '').toLowerCase();
};
