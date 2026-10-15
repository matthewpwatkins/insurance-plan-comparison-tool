import { dmbaEobReader } from '../readers/dmbaEob';
import { ClaimsReadError } from '../types';

/** A made-up claim in the same text layout the PDF produces. */
const claimPage = (claimId: string, provider: string, chargeLines: string[], codes: string[]) => [
  'Explanation of Benefits',
  ' generated on October 14, 2026',
  `Claim: ${claimId}`,
  'Patient   JANE DOE   Health Plan   DMBA HSA 80 Plan',
  ' Participant   JOHN DOE   Date Entered   01/03/2026',
  ' Participant Id   000000000   Date Paid   01/08/2026',
  ` Provider   ${provider}`,
  ' Service',
  'Date  ',
  'Services Provided   Provider Billed   DMBA Paid   Your',
  'Responsibility',
  'To Provider',
  'Messages',
  '(see below)',
  ...chargeLines,
  ' Totals   $0.00   $0.00   $0.00',
  'Not Your Responsibility   Details of Your Responsibility',
  'Provider Discount   $10.00   Deductible   $0.00   Copayment   $20.00',
  ' Code   Description',
  ...codes,
  'Page 1  ',
  '© 2000 - 2026 Deseret Mutual Benefit Administrators. All rights reserved.',
];

describe('DMBA claims reader', () => {
  it('reads charges, including labels that wrap onto the next line', () => {
    const charges = dmbaEobReader.read([
      claimPage(
        'T001',
        'CITY CLINIC',
        [
          ' 03/14/2026 OFFICE VISIT   $165.00   $88.34   $22.09   UH',
          '03/14/2026 RADIOLOGY',
          'DIAGNOSTIC  ',
          '$307.00   $0.00   $260.95   LT UH B6',
        ],
        [' UH   SERVICES WERE PROVIDED FROM THE UNITEDHEALTHCARE OPTIONS PPO NETWORK.']
      ),
    ]);
    expect(charges).toEqual([
      expect.objectContaining({
        claimId: 'T001',
        date: '2026-03-14',
        patient: 'JANE DOE',
        provider: 'CITY CLINIC',
        service: 'OFFICE VISIT',
        allowed: 110.43,
        preventive: false,
        inNetwork: true,
      }),
      expect.objectContaining({ service: 'RADIOLOGY DIAGNOSTIC', allowed: 260.95 }),
    ]);
  });

  it('flags preventive and out-of-network charges from their message codes', () => {
    const charges = dmbaEobReader.read([
      claimPage(
        'T002',
        'KIDS PEDIATRICS',
        [
          ' 09/24/2025 IMMUNIZATION & ADMIN   $45.00   $25.44   $0.00   UH WS',
          '09/24/2025 OFFICE VISIT   $160.00   $0.00   $160.00   ON',
        ],
        [
          ' WS   THIS SERVICE APPLIED TO YOUR PREVENTIVE BENEFIT.',
          'ON   SERVICES WERE PAID AT THE OUT-OF-NETWORK BENEFIT.',
        ]
      ),
    ]);
    expect(charges.map(c => [c.service, c.preventive, c.inNetwork])).toEqual([
      ['IMMUNIZATION & ADMIN', true, true],
      ['OFFICE VISIT', false, false],
    ]);
  });

  it('keeps reversed and denied lines at zero so they can be dropped', () => {
    const charges = dmbaEobReader.read([
      claimPage(
        'T003',
        'CITY CLINIC',
        [
          ' 01/09/2026 OFFICE VISIT   $165.00   $0.00   $0.00   J5',
          '01/09/2026 OFFICE VISIT   -$165.00   $0.00   $0.00   J5',
          '01/09/2026 OFFICE VISIT   $165.00   $88.34   $22.09   UH',
        ],
        []
      ),
    ]);
    expect(charges.map(c => c.allowed)).toEqual([0, 0, 110.43]);
  });

  it('reads claims across pages', () => {
    const charges = dmbaEobReader.read([
      claimPage('T004', 'A', [' 01/01/2026 SURGERY   $10.00   $5.00   $1.00'], []),
      claimPage('T005', 'B', [' 02/01/2026 ANESTHESIA   $10.00   $4.00   $1.00'], []),
    ]);
    expect(charges.map(c => [c.claimId, c.provider, c.allowed])).toEqual([
      ['T004', 'A', 6],
      ['T005', 'B', 5],
    ]);
  });

  it('rejects a file that is not a DMBA detail report', () => {
    expect(() => dmbaEobReader.read([['Claim Summary', 'T001 12/04/2024 JANE DOE']])).toThrow(
      ClaimsReadError
    );
  });
});
