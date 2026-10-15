import { UserInputs } from '../types';

/** Where the guided setup was and what the person chose, so they can pick up later. */
export interface GuidedProgress {
  step: string;
  estimateChoice: string | null;
  claimsPeriod?: string;
  hsaTouched: boolean;
  fsaTouched: boolean;
}

const inputsKey = (slug: string) => `guided:${slug}:inputs`;
const progressKey = (slug: string) => `guided:${slug}:progress`;

// Storage can be blocked (private windows, site data off), so every access may throw
const read = <T>(key: string): T | null => {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
};

const write = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not saving only costs the person their place
  }
};

export const loadGuidedInputs = (slug: string): UserInputs | null => read(inputsKey(slug));
export const saveGuidedInputs = (slug: string, inputs: UserInputs): void =>
  write(inputsKey(slug), inputs);

export const loadGuidedProgress = (slug: string): GuidedProgress | null => read(progressKey(slug));
export const saveGuidedProgress = (slug: string, progress: GuidedProgress): void =>
  write(progressKey(slug), progress);

export const clearGuided = (slug: string): void => {
  try {
    localStorage.removeItem(inputsKey(slug));
    localStorage.removeItem(progressKey(slug));
  } catch {
    // Nothing saved to clear
  }
};

/** The guided step named in the URL, e.g. /dmba/setup/tax gives "tax". */
export const readGuidedStepFromPath = (
  pathname: string = window.location.pathname
): string | null => {
  const [, section, step] = pathname.split('/').filter(Boolean);
  return section === 'setup' ? (step ?? null) : null;
};

export const guidedStepPath = (slug: string, step: string): string =>
  step === 'welcome' ? `/${slug}` : `/${slug}/setup/${step}`;
