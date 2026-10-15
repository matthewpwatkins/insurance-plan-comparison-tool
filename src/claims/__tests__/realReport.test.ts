/**
 * Checks a reader against a real claims report, which is never committed. Run it with:
 *   CLAIMS_PDF=/path/to/report.pdf CLAIMS_FORMAT=dmba-eob CLAIMS_TOTAL=23001.15 \
 *     npm test -- --watchAll=false realReport
 * CLAIMS_TOTAL is the report's "paid" plus "your responsibility" totals, from the
 * insurer's summary report for the same dates.
 *
 * @jest-environment jsdom
 */
import fs from 'fs';
import { ReadableStream } from 'stream/web';
import { readPdfLines } from '../pdfText';
import { CLAIMS_READERS } from '../readers';
import {
  groupPastExpenses,
  prepareClaims,
  suggestCarryOver,
  yearsCovered,
} from '../estimateFromClaims';
import { getCompany } from '../../generated/dataHelpers';

// Browsers have this; the test environment doesn't.
Object.assign(globalThis, { ReadableStream });

const file = process.env.CLAIMS_PDF;
const runIf = file ? it : it.skip;

describe('real claims report', () => {
  runIf(
    'reads every charge and matches the report total',
    async () => {
      const data = fs.readFileSync(file as string);
      const pages = await readPdfLines(new Uint8Array(data).buffer);
      const reader = CLAIMS_READERS[process.env.CLAIMS_FORMAT ?? 'dmba-eob'];
      const charges = reader.read(pages);
      const total = charges.reduce((sum, charge) => sum + charge.allowed, 0);
      const claims = new Set(charges.map(charge => charge.claimId));

      // eslint-disable-next-line no-console
      console.log(`${claims.size} claims, ${charges.length} charges, total ${total.toFixed(2)}`);
      expect(charges.length).toBeGreaterThan(0);
      if (process.env.CLAIMS_TOTAL) {
        expect(total.toFixed(2)).toBe(Number(process.env.CLAIMS_TOTAL).toFixed(2));
      }

      // Show what the company's settings make of it, with no names, so the output can be shared.
      const company = getCompany(process.env.CLAIMS_COMPANY ?? 'dmba');
      if (company?.claims_report) {
        const prepared = prepareClaims(charges, company.claims_report);
        const expenses = groupPastExpenses(prepared.visits, company.claims_report);
        const options = { planYear: 2027, years: yearsCovered(prepared), inflationRate: 5 };
        const byCategory: Record<string, number> = {};
        for (const expense of expenses) {
          const { categoryId } = suggestCarryOver(expense, options);
          const label = categoryId ?? `(no category for "${expense.service}")`;
          byCategory[label] = (byCategory[label] ?? 0) + 1;
        }
        // eslint-disable-next-line no-console
        console.log(
          [
            `${prepared.visits.length} visits, ` +
              `${prepared.visits.filter(v => v.preventive).length} preventive, ` +
              `${expenses.length} rows to review`,
            `Labels: ${Array.from(new Set(charges.map(c => c.service)))
              .sort()
              .join(', ')}`,
            ...Object.entries(byCategory).map(([label, rows]) => `${label}: ${rows} rows`),
          ].join('\n')
        );
      }
    },
    60000
  );
});
