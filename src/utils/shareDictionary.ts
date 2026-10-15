import { getAvailableYears, getCompanies, getPlanData } from '../generated/dataHelpers';

/**
 * Preset dictionary for compressing share links (see urlParams.ts).
 *
 * Deflate can copy from the dictionary as if it were text it had already seen, so anything
 * here costs almost nothing in a link. Closer to the end is cheaper to reference, so the order
 * runs from least to most likely: free-text words people put in notes, then category names,
 * then the JSON every link contains.
 *
 * CHANGING ANY OF THIS BREAKS EVERY EXISTING LINK. That includes adding or renaming a category
 * in data/, since ids and names come from there. When the dictionary changes, bump
 * SHARE_FORMAT_VERSION in urlParams.ts (v1 -> v2) so old links get the "couldn't be read"
 * message instead of decoding to garbage.
 */

/** Words common in provider names and expense notes. */
const NOTE_WORDS = [
  'Pharmacy Benefit Manager',
  'Medical Center',
  'Childrens',
  "Children's",
  'Hospital',
  'Surgery Center',
  'Surgical',
  'Clinic',
  'Health',
  'Healthcare',
  'Medical Group',
  'Physicians',
  'Associates',
  'Family Medicine',
  'Pediatrics',
  'Pediatric',
  'Primary Care',
  'Urgent Care',
  'Instacare',
  'Quest Diagnostics',
  'LabCorp',
  'Labs',
  'Laboratory',
  'Pathology',
  'Radiology',
  'Imaging',
  'Diagnostic',
  'Orthopedic',
  'Orthopedics',
  'Dermatology',
  'Cardiology',
  'Cardiovascular',
  'Anesthesia',
  'Emergency',
  'Physical Therapy',
  'Rehabilitation',
  'Behavioral Health',
  'Mental Health',
  'Counseling',
  "Women's",
  'Obstetrics',
  'Gynecology',
  'Dental',
  'Vision',
  'Optometry',
  'Eye',
  'University',
  'Regional',
  'Valley',
  'Mountain',
  'Specialists',
  'Specialty',
  'Services',
  'Center',
  'Institute',
  'Partners',
  'Group',
  'LLC',
  'Inc',
  'PC',
  'MD',
  'DO',
  'NP',
  'PA',
  'Saint',
  'Intermountain',
  'Prescription',
  'Pharmacy',
  'Walgreens',
  'CVS',
  'Costco',
  'office visit',
  'follow-up',
  'checkup',
  'annual',
  'kids',
  'baby',
];

/** Every category id and name across all companies and years, sorted by id. */
const allCategories = (): [string, string][] => {
  const names = new Map<string, string>();
  for (const company of getCompanies()) {
    for (const year of getAvailableYears(company.slug)) {
      const { categories } = getPlanData(company.slug, year);
      for (const [id, category] of Object.entries(categories)) {
        if (!names.has(id)) names.set(id, category.name);
      }
    }
  }
  return Array.from(names).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
};

/** A typical link's JSON, in the key order the app serializes UserInputs. */
const SAMPLE_INPUTS =
  '{"year":2026,"coverage":"family","ageGroup":"under_55","taxRate":22,' +
  '"costs":{"categoryEstimates":[' +
  '{"categoryId":"office_visit_pcp","estimate":{"quantity":1,"costPerVisit":100,"isInNetwork":true},"notes":""},' +
  '{"categoryId":"wellness_exam","estimate":{"quantity":1,"costPerVisit":100,"isInNetwork":false},"notes":""}' +
  ']},"hsaContribution":0,"fsaContribution":0}';

export const buildShareDictionaryText = (): string => {
  const categories = allCategories();
  return [
    NOTE_WORDS.join(' '),
    categories.map(([, name]) => name).join(' '),
    categories
      .map(([id]) => `{"categoryId":"${id}","estimate":{"quantity":1,"costPerVisit":`)
      .join(''),
    SAMPLE_INPUTS,
  ].join('');
};

export const SHARE_DICTIONARY: Uint8Array = new TextEncoder().encode(buildShareDictionaryText());
