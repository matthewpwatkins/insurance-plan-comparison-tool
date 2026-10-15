import { ClaimsReader } from '../types';
import { dmbaEobReader } from './dmbaEob';

/** Every claims report layout the app can read, by the format id used in company.yml. */
export const CLAIMS_READERS: Record<string, ClaimsReader> = {
  [dmbaEobReader.format]: dmbaEobReader,
};
