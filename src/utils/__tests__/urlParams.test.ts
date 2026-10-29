import { deflateSync } from 'fflate';
import {
  encodeUserInputs,
  decodeUserInputs,
  updateURL,
  getShareableURL,
  copyURLToClipboard,
  readSharedInputs,
  readCompanySlugFromPath,
  isResultsPath,
} from '../urlParams';
import { SHARE_DICTIONARY } from '../shareDictionary';
import { UserInputs, CoverageType, CategoryEstimate } from '../../types';

const YEARS = [2026, 2025];

const inputs = (overrides: Partial<UserInputs> = {}): UserInputs => ({
  year: 2025,
  coverage: CoverageType.Single,
  ageGroup: 'under_55',
  taxRate: 22,
  costs: { categoryEstimates: [] },
  hsaContribution: 2000,
  fsaContribution: 1500,
  ...overrides,
});

// Made-up people and providers, shaped like the notes the claims import writes
const PEOPLE = ['Avery', 'Jordan', 'Rowan', 'Sky', 'Quinn', 'Harper'];
const PROVIDERS = [
  'Riverbend Family Medicine',
  'Cedar Ridge Pediatrics',
  'Northgate Imaging Center',
  'Quest Diagnostics',
  'Lakeside Physical Therapy',
  'Summit Orthopedic Specialists',
  'Walgreens Pharmacy',
  'Maple Valley Dermatology',
  'Brightview Behavioral Health',
  "St. Aldric Children's Hospital",
];
const CATEGORY_IDS = [
  'office_visit_pcp',
  'office_visit_specialist',
  'wellness_exam',
  'laboratory_outpatient',
  'pharmacy_tier_1_retail_30',
  'pharmacy_tier_2_mail_90',
  'imaging_diagnostic_facility',
  'physical_therapy_outpatient',
  'urgent_care',
  'behavioral_mental_health_outpatient',
  'emergency_room',
  'eye_exams',
];

const sampleEstimates = (count: number): CategoryEstimate[] =>
  Array.from({ length: count }, (_, i) => ({
    categoryId: CATEGORY_IDS[i % CATEGORY_IDS.length],
    estimate: {
      quantity: (i % 6) + 1,
      costPerVisit: 35 + ((i * 137) % 900),
      isInNetwork: i % 7 !== 3,
    },
    notes: `${PEOPLE[i % PEOPLE.length]}: ${PROVIDERS[(i * 3) % PROVIDERS.length]}`,
  }));

/** sampleInputs(30), encoded with the dictionary the live site used encoded it before the dictionary was frozen */
const V1_LINK =
  'v1.vZpNbsIwEIWv0hOgxHbihF3bTVW1lQonSJUIIsSPIijqonfvEByIPJAZ21G3LOBp4vc9k3nhM04nKvmvMUv4paEpP4L8n-nD7FRj-Kpg12k1SPBTcL13mxPVex4aPhrS9LptymIzxSUU3yMh0VSifFjCbHs8KbhWJ7oVHZbg9l9c2VKUglM0eDrnK3hA8_0Eyhblqb5zo0yEVbnfyM2RvCpLMpjb0JA-D_UGhvQB5Fwu4Psu6_lzpYUSRV_BW3_1JWlBQOOlaHZVA-M6rNewt-61jnotHCxslHdmWaJZXntq6sVy_11XR9xRujUz97snslwOx47juOeqhLrVrC4X_eoYFsWJOGQ6IWFkDNO9FSt4M1KCAmuvjXWELPeQE2WaDetrjfhe7KDkYTpevfoaFsfcqWDfRTazbSIY4zlAm96jIK-lisB05zUGpv3zS2uC1MZUHFIHJ1ce26y-4yNXWnvGWJwQhDaO4hM6MMxETvD5nGVucB4hypQg0Gwc5YrmwDhLUpvLttM7j3HBPEqQ6YgAtfGcA6hHSbFMEoDu7MdntFeQaeJObVzngOdRc0zEBLhbEzKo7RtgUhHMNm7jMNsjuFRGUPpySXSktH-KpcIGtW10Yyk-qYPDTKcEqy9h5oZrzyzLcgLRxlVuiA7Ms1gSF-fWSlw4jxBkQhNoNtZyQnNgiqmIwHLnt_tYZr9-kTKKfv8A';

const sampleInputs = (count: number) =>
  inputs({
    year: 2026,
    coverage: CoverageType.Family,
    taxRate: 26.45,
    hsaContribution: 0,
    fsaContribution: 3300,
    costs: { categoryEstimates: sampleEstimates(count) },
  });

/** A v1 link around arbitrary JSON, to test what the decoder does with it. */
const encodeRaw = (raw: unknown): string => {
  const payload = deflateSync(new TextEncoder().encode(JSON.stringify(raw)), {
    level: 9,
    dictionary: SHARE_DICTIONARY,
  });
  let binary = '';
  payload.forEach(byte => (binary += String.fromCharCode(byte)));
  return `v1.${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
};

describe('share links', () => {
  describe('encode and decode', () => {
    it('round-trips every field', () => {
      const original = sampleInputs(8);
      const result = decodeUserInputs(encodeUserInputs(original), YEARS);
      expect(result).toEqual({ status: 'ok', inputs: original });
    });

    it('summary links drop the notes and keep every category and cost', () => {
      const original = inputs({
        costs: {
          categoryEstimates: [
            {
              categoryId: 'office_visit_pcp',
              estimate: { quantity: 2, costPerVisit: 150, isInNetwork: true },
              notes: 'Zoë: Dr. Smith',
            },
          ],
        },
      });
      const decoded = decodeUserInputs(encodeUserInputs(original, 'summary'), YEARS);
      expect(decoded).toEqual({
        status: 'ok',
        inputs: {
          ...original,
          costs: {
            categoryEstimates: [
              {
                categoryId: 'office_visit_pcp',
                estimate: { quantity: 2, costPerVisit: 150, isInNetwork: true },
              },
            ],
          },
        },
      });
      expect(encodeUserInputs(original, 'summary')).not.toEqual(encodeUserInputs(original));
    });

    it('full links carry people and names; summary links keep people but drop names', () => {
      const original = inputs({
        peopleNames: ['Zoë', '', 'Sam'],
        costs: {
          categoryEstimates: [
            {
              categoryId: 'office_visit_pcp',
              estimate: { quantity: 2, costPerVisit: 150, isInNetwork: true },
              person: 3,
            },
          ],
        },
      });
      expect(decodeUserInputs(encodeUserInputs(original), YEARS)).toEqual({
        status: 'ok',
        inputs: original,
      });
      const summary = decodeUserInputs(encodeUserInputs(original, 'summary'), YEARS);
      expect(summary.status === 'ok' && summary.inputs.peopleNames).toEqual(['', '', '']);
      expect(summary.status === 'ok' && summary.inputs.costs?.categoryEstimates?.[0].person).toBe(
        3
      );
    });

    it('drops a person that is not a whole number from 1', () => {
      const raw = inputs({
        costs: {
          categoryEstimates: [
            {
              categoryId: 'office_visit_pcp',
              estimate: { quantity: 2, costPerVisit: 150, isInNetwork: true },
              person: 0,
            },
          ],
        },
      });
      const decoded = decodeUserInputs(encodeUserInputs(raw), YEARS);
      expect(decoded.status === 'ok' && decoded.inputs.costs?.categoryEstimates).toEqual([]);
    });

    it('round-trips notes with unicode, quotes and symbols', () => {
      const original = inputs({
        costs: {
          categoryEstimates: [
            {
              categoryId: 'office_visit_pcp',
              estimate: { quantity: 2, costPerVisit: 150, isInNetwork: true },
              notes: 'Zoë\'s "annual" checkup – 東京 clinic 🦷 & co. \\ #1 ?x=y',
            },
            {
              categoryId: 'eye_exams',
              estimate: { quantity: 1, costPerVisit: 80.5, isInNetwork: false },
            },
          ],
        },
      });
      const result = decodeUserInputs(encodeUserInputs(original), YEARS);
      expect(result).toEqual({ status: 'ok', inputs: original });
    });

    it('uses the versioned, url-safe format', () => {
      expect(encodeUserInputs(sampleInputs(40))).toMatch(/^v1\.[A-Za-z0-9_-]+$/);
    });

    it('makes the same link for the same inputs whatever their key order', () => {
      const original = sampleInputs(2);
      const { year, costs, ...rest } = original;
      const reordered: UserInputs = { costs, ...rest, year };
      expect(encodeUserInputs(reordered)).toBe(encodeUserInputs(original));
    });

    it('accepts the hash with its leading #', () => {
      const encoded = encodeUserInputs(sampleInputs(2));
      expect(decodeUserInputs(`#${encoded}`, YEARS).status).toBe('ok');
    });

    it('treats an empty hash as no link', () => {
      expect(decodeUserInputs('', YEARS)).toEqual({ status: 'none' });
      expect(decodeUserInputs('#', YEARS)).toEqual({ status: 'none' });
    });
  });

  describe('unreadable links', () => {
    it('rejects bad base64', () => {
      expect(decodeUserInputs('v1.not*base64!', YEARS)).toEqual({ status: 'invalid' });
    });

    it('rejects valid base64 that is not our compressed data', () => {
      expect(decodeUserInputs('v1.aGVsbG8gd29ybGQ', YEARS)).toEqual({ status: 'invalid' });
    });

    it('rejects a truncated link', () => {
      const encoded = encodeUserInputs(sampleInputs(8));
      expect(decodeUserInputs(encoded.slice(0, 40), YEARS)).toEqual({ status: 'invalid' });
    });

    it('rejects an unknown version', () => {
      const encoded = encodeUserInputs(sampleInputs(2));
      expect(decodeUserInputs(encoded.replace(/^v1\./, 'v2.'), YEARS)).toEqual({
        status: 'invalid',
      });
      expect(decodeUserInputs(encoded.replace(/^v1\./, ''), YEARS)).toEqual({ status: 'invalid' });
    });

    it('rejects compressed JSON that is not an object', () => {
      expect(decodeUserInputs(encodeRaw([1, 2, 3]), YEARS)).toEqual({ status: 'invalid' });
      expect(decodeUserInputs(encodeRaw(null), YEARS)).toEqual({ status: 'invalid' });
    });
  });

  describe('validation', () => {
    const decodeRaw = (raw: unknown) => {
      const result = decodeUserInputs(encodeRaw(raw), YEARS);
      if (result.status !== 'ok') throw new Error(`Expected ok, got ${result.status}`);
      return result.inputs;
    };

    it('drops a year the company has no data for', () => {
      const result = decodeUserInputs(encodeUserInputs(inputs({ year: 2031 })), YEARS);
      expect(result.status).toBe('ok');
      expect(result.status === 'ok' && result.inputs.year).toBeUndefined();
      expect(result.status === 'ok' && result.inputs.coverage).toBe('single');
    });

    it('accepts any year the company has data for', () => {
      const result = decodeUserInputs(encodeUserInputs(inputs({ year: 2031 })), [2031, 2030]);
      expect(result.status === 'ok' && result.inputs.year).toBe(2031);
    });

    it('drops invalid coverage, age group, tax rate and contributions', () => {
      expect(
        decodeRaw({
          year: 2026,
          coverage: 'everyone',
          ageGroup: '40_plus',
          taxRate: 150,
          hsaContribution: -1,
          fsaContribution: 'lots',
        })
      ).toEqual({ year: 2026 });
    });

    it('keeps only well-formed estimates', () => {
      const good = {
        categoryId: 'office_visit_pcp',
        estimate: { quantity: 2, costPerVisit: 150, isInNetwork: true },
      };
      const result = decodeRaw({
        costs: {
          categoryEstimates: [
            good,
            { categoryId: 'x', estimate: { quantity: '2', costPerVisit: 1, isInNetwork: true } },
            { categoryId: 'x', estimate: { quantity: 2, costPerVisit: 1 } },
            { estimate: { quantity: 2, costPerVisit: 1, isInNetwork: true } },
            {
              categoryId: 'x',
              estimate: { quantity: 2, costPerVisit: 1, isInNetwork: true },
              notes: 5,
            },
            null,
          ],
        },
      });
      expect(result.costs?.categoryEstimates).toEqual([good]);
    });
  });

  describe('dictionary', () => {
    it('still reads a link made before the dictionary was frozen', () => {
      // Made on the live site before this change; any edit to the dictionary breaks it
      expect(decodeUserInputs(V1_LINK, YEARS)).toEqual({ status: 'ok', inputs: sampleInputs(30) });
    });

    it('ends with the JSON every link starts with and fits in the deflate window', () => {
      const text = new TextDecoder().decode(SHARE_DICTIONARY);
      expect(text).toContain('{"categoryId":"office_visit_pcp","estimate":{"quantity":1');
      expect(text.endsWith('"hsaContribution":0,"fsaContribution":0}')).toBe(true);
      expect(SHARE_DICTIONARY.length).toBeLessThanOrEqual(32 * 1024);
    });

    it('keeps a 40-expense link with names in the notes under 900 characters', () => {
      window.history.pushState({}, '', '/dmba');
      expect(getShareableURL(sampleInputs(40)).length).toBeLessThan(900);
    });
  });
});

describe('results URL', () => {
  const originalClipboard = navigator.clipboard;

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { value: originalClipboard, configurable: true });
    window.history.pushState({}, '', '/');
  });

  it('updateURL replaces the URL with the results page and the inputs in the hash', () => {
    window.history.pushState({}, '', '/dmba/setup/edit');
    const lengthBefore = window.history.length;
    updateURL(sampleInputs(2));

    expect(window.location.pathname).toBe('/dmba/results');
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe(`#${encodeUserInputs(sampleInputs(2))}`);
    expect(window.history.length).toBe(lengthBefore);
  });

  it('getShareableURL is absolute', () => {
    window.history.pushState({}, '', '/dmba');
    expect(getShareableURL(sampleInputs(2))).toBe(
      `${window.location.origin}/dmba/results#${encodeUserInputs(sampleInputs(2))}`
    );
  });

  it('copyURLToClipboard copies the share link', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    window.history.pushState({}, '', '/dmba');

    await expect(copyURLToClipboard(sampleInputs(2))).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith(getShareableURL(sampleInputs(2)));
  });

  it('copyURLToClipboard reports failure', async () => {
    const writeText = jest.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(copyURLToClipboard(sampleInputs(2))).resolves.toBe(false);
  });

  it('readSharedInputs reads the hash on a results page only', () => {
    const encoded = encodeUserInputs(sampleInputs(2));
    window.history.pushState({}, '', `/dmba/results#${encoded}`);
    expect(readSharedInputs(YEARS)).toEqual({ status: 'ok', inputs: sampleInputs(2) });

    window.history.pushState({}, '', `/dmba#${encoded}`);
    expect(readSharedInputs(YEARS)).toEqual({ status: 'none' });

    window.history.pushState({}, '', '/dmba/results#garbage');
    expect(readSharedInputs(YEARS)).toEqual({ status: 'invalid' });
  });

  it('isResultsPath matches only /<slug>/results', () => {
    expect(isResultsPath('/dmba/results')).toBe(true);
    expect(isResultsPath('/dmba')).toBe(false);
    expect(isResultsPath('/dmba/setup/year')).toBe(false);
  });
});

describe('readCompanySlugFromPath', () => {
  it('reads the first path segment', () => {
    expect(readCompanySlugFromPath('/dmba')).toBe('dmba');
    expect(readCompanySlugFromPath('/dmba/')).toBe('dmba');
    expect(readCompanySlugFromPath('/dmba/extra')).toBe('dmba');
  });

  it('lowercases the slug', () => {
    expect(readCompanySlugFromPath('/DMBA')).toBe('dmba');
  });

  it('returns an empty string on the root', () => {
    expect(readCompanySlugFromPath('/')).toBe('');
  });
});
