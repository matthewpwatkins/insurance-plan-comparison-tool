/** One charge from an insurer's claims report, in a shape every reader produces. */
export interface ClaimCharge {
  claimId: string;
  /** Service date as YYYY-MM-DD */
  date: string;
  patient: string;
  provider: string;
  /** The insurer's own label for the service, e.g. "LAB / PATHOLOGY" */
  service: string;
  /** Negotiated price: what the plan paid plus what the member owed */
  allowed: number;
  preventive: boolean;
  inNetwork: boolean;
}

/**
 * Turns the text of one insurer's claims report layout into charges. Each layout gets
 * its own reader; companies pick one by its format id in company.yml.
 */
export interface ClaimsReader {
  format: string;
  /** What the person should download, for error messages */
  description: string;
  /** Each page's text, one string per line */
  read(pages: string[][]): ClaimCharge[];
}

export class ClaimsReadError extends Error {}
