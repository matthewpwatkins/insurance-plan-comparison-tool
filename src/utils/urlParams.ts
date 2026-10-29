import { deflateSync, inflateSync } from 'fflate';
import { UserInputs, PartialUserInputs, CategoryEstimate, CoverageType } from '../types';
import { SHARE_DICTIONARY } from './shareDictionary';

/**
 * Results links carry the inputs in the hash, so they never reach a server:
 *
 *   /<slug>/results#v1.<base64url(raw deflate(JSON.stringify(inputs), dictionary))>
 *
 * The version tag names the dictionary. Bump it whenever shareDictionary.ts changes.
 */
export const SHARE_FORMAT_VERSION = 'v1';

/** What a link's hash held: nothing, readable inputs, or something we couldn't read. */
export type SharedInputs =
  | { status: 'none' }
  | { status: 'ok'; inputs: PartialUserInputs }
  | { status: 'invalid' };

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  bytes.forEach(byte => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string): Uint8Array => {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error('Not base64url');
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
};

/** A full link carries everything; a summary link leaves out the notes on each category. */
export type ShareMode = 'full' | 'summary';

const withoutNotes = ({ categoryId, estimate }: CategoryEstimate): CategoryEstimate => ({
  categoryId,
  estimate,
});

/** Inputs in the order defaultInputs builds them, so equal inputs always make the same link. */
const serialize = (inputs: UserInputs, mode: ShareMode): string =>
  JSON.stringify({
    year: inputs.year,
    coverage: inputs.coverage,
    ageGroup: inputs.ageGroup,
    taxRate: inputs.taxRate,
    costs: {
      categoryEstimates:
        mode === 'summary'
          ? inputs.costs.categoryEstimates.map(withoutNotes)
          : inputs.costs.categoryEstimates,
    },
    hsaContribution: inputs.hsaContribution,
    fsaContribution: inputs.fsaContribution,
  });

/** The hash payload for these inputs, without the leading '#'. */
export const encodeUserInputs = (inputs: UserInputs, mode: ShareMode = 'full'): string => {
  const compressed = deflateSync(new TextEncoder().encode(serialize(inputs, mode)), {
    level: 9,
    dictionary: SHARE_DICTIONARY,
  });
  return `${SHARE_FORMAT_VERSION}.${toBase64Url(compressed)}`;
};

const isNonNegativeNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const isCategoryEstimate = (value: any): value is CategoryEstimate =>
  !!value &&
  typeof value.categoryId === 'string' &&
  !!value.estimate &&
  isNonNegativeNumber(value.estimate.quantity) &&
  isNonNegativeNumber(value.estimate.costPerVisit) &&
  typeof value.estimate.isInNetwork === 'boolean' &&
  (value.notes === undefined || typeof value.notes === 'string');

/** Keeps the fields that are valid for this company; drops the rest so defaults fill in. */
const validate = (raw: any, availableYears: number[]): PartialUserInputs => {
  const inputs: PartialUserInputs = {};
  if (availableYears.includes(raw.year)) inputs.year = raw.year;
  if (Object.values(CoverageType).includes(raw.coverage)) inputs.coverage = raw.coverage;
  if (raw.ageGroup === 'under_55' || raw.ageGroup === '55_plus') inputs.ageGroup = raw.ageGroup;
  if (isNonNegativeNumber(raw.taxRate) && raw.taxRate <= 100) inputs.taxRate = raw.taxRate;
  if (isNonNegativeNumber(raw.hsaContribution)) inputs.hsaContribution = raw.hsaContribution;
  if (isNonNegativeNumber(raw.fsaContribution)) inputs.fsaContribution = raw.fsaContribution;
  const estimates = raw.costs?.categoryEstimates;
  if (Array.isArray(estimates)) {
    inputs.costs = { categoryEstimates: estimates.filter(isCategoryEstimate) };
  }
  return inputs;
};

/** Reads a hash payload (with or without the leading '#'). Never throws. */
export const decodeUserInputs = (hash: string, availableYears: number[]): SharedInputs => {
  const payload = hash.replace(/^#/, '');
  if (payload === '') return { status: 'none' };

  const prefix = `${SHARE_FORMAT_VERSION}.`;
  if (!payload.startsWith(prefix)) return { status: 'invalid' };

  try {
    const json = new TextDecoder('utf-8', { fatal: true }).decode(
      inflateSync(fromBase64Url(payload.slice(prefix.length)), { dictionary: SHARE_DICTIONARY })
    );
    const raw = JSON.parse(json);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { status: 'invalid' };
    return { status: 'ok', inputs: validate(raw, availableYears) };
  } catch {
    return { status: 'invalid' };
  }
};

/** The results page for these inputs, e.g. /dmba/results#v1.... */
const resultsURL = (inputs: UserInputs, mode: ShareMode = 'full'): string =>
  `/${readCompanySlugFromPath()}/results#${encodeUserInputs(inputs, mode)}`;

/**
 * Update browser URL with current user inputs
 */
export const updateURL = (inputs: UserInputs): void => {
  window.history.replaceState({}, '', resultsURL(inputs));
};

/** Whether the URL is a results page, which opens with the comparison already run. */
export const isResultsPath = (pathname: string = window.location.pathname): boolean =>
  pathname.split('/').filter(Boolean)[1] === 'results';

/**
 * Get current URL with parameters for sharing
 */
export const getShareableURL = (inputs: UserInputs, mode: ShareMode = 'full'): string => {
  return `${window.location.origin}${resultsURL(inputs, mode)}`;
};

/**
 * Copy URL to clipboard
 */
export const copyURLToClipboard = async (
  inputs: UserInputs,
  mode: ShareMode = 'full'
): Promise<boolean> => {
  try {
    const url = getShareableURL(inputs, mode);
    await navigator.clipboard.writeText(url);
    return true;
  } catch (error) {
    console.error('Failed to copy URL to clipboard:', error);
    return false;
  }
};

/** Inputs from the current results link. Only results pages carry them. */
export const readSharedInputs = (availableYears: number[]): SharedInputs =>
  isResultsPath() ? decodeUserInputs(window.location.hash, availableYears) : { status: 'none' };

/**
 * Company slug is the first path segment, e.g. /dmba. Empty string when on the root.
 */
export const readCompanySlugFromPath = (pathname: string = window.location.pathname): string => {
  const [segment] = pathname.split('/').filter(Boolean);
  return (segment ?? '').toLowerCase();
};
