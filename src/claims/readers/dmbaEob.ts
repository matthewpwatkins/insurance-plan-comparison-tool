import { ClaimCharge, ClaimsReader, ClaimsReadError } from '../types';

const MONEY = String.raw`(-?\$[\d,]+\.\d{2})`;
/** A charge row: date, label (which may wrap onto the next line), billed, paid, owed, codes */
const CHARGE = new RegExp(
  String.raw`(\d{2})/(\d{2})/(\d{4})\s+(.+?)\s+${MONEY}\s+${MONEY}\s+${MONEY}((?:\s+[A-Z0-9]{2,3})*)(?=\s+\d{2}/\d{2}/\d{4}|\s*$)`,
  'g'
);
const MESSAGE = /^\s*([A-Z0-9]{2,3})\s+([A-Z].*)$/;
const FOOTER = /^\s*(Page \d+|©)/;

const money = (text: string): number => Number(text.replace(/[$,]/g, ''));
const clean = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** Reads one claim's lines: header fields, the charge table, and the message codes below it. */
const readClaim = (claimId: string, lines: string[]): ClaimCharge[] => {
  const text = lines.join('\n');
  const patient = clean(text.match(/Patient\s+(.+?)\s+Health Plan/)?.[1] ?? '');
  const provider = clean(
    lines.map(line => line.match(/^\s*Provider\s+(?!Discount)(.+)$/)?.[1]).find(Boolean) ?? ''
  );

  const tableStart = lines.findIndex(line => /\(see below\)/.test(line));
  const tableEnd = lines.findIndex(line => /^\s*Totals\b/.test(line));
  if (tableStart < 0 || tableEnd < tableStart) return [];
  const table = clean(lines.slice(tableStart + 1, tableEnd).join(' '));

  const messages = new Map<string, string>();
  const codesStart = lines.findIndex(line => /^\s*Code\s+Description/.test(line));
  if (codesStart >= 0) {
    for (const line of lines.slice(codesStart + 1)) {
      const match = line.match(MESSAGE);
      if (match) messages.set(match[1], match[2]);
    }
  }
  const says = (codes: string[], pattern: RegExp) =>
    codes.some(code => pattern.test(messages.get(code) ?? ''));

  const charges: ClaimCharge[] = [];
  CHARGE.lastIndex = 0;
  for (let match = CHARGE.exec(table); match; match = CHARGE.exec(table)) {
    const [, month, day, year, label, , paid, owed, codeText] = match;
    const codes = codeText.trim().split(/\s+/).filter(Boolean);
    charges.push({
      claimId,
      date: `${year}-${month}-${day}`,
      patient,
      provider,
      service: clean(label),
      allowed: Math.round((money(paid) + money(owed)) * 100) / 100,
      preventive: says(codes, /PREVENTIVE/),
      inNetwork: !says(codes, /OUT[- ]OF[- ]NETWORK/),
    });
  }
  return charges;
};

/** DMBA's "Detail" claims history report: one Explanation of Benefits per claim. */
export const dmbaEobReader: ClaimsReader = {
  format: 'dmba-eob',
  description: 'the DMBA claims history report with the "Detail" report type',
  read(pages) {
    const lines = ([] as string[]).concat(...pages).filter(line => !FOOTER.test(line));
    const charges: ClaimCharge[] = [];
    let claimId: string | null = null;
    let claimLines: string[] = [];
    const flush = () => {
      if (claimId) charges.push(...readClaim(claimId, claimLines));
    };
    for (const line of lines) {
      const start = line.match(/Claim:\s*(\S+)/);
      if (start) {
        flush();
        claimId = start[1];
        claimLines = [];
      } else {
        claimLines.push(line);
      }
    }
    flush();
    if (!claimId) {
      throw new ClaimsReadError(`This doesn't look like ${dmbaEobReader.description}.`);
    }
    return charges;
  },
};
