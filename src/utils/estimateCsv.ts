import { CategoriesData, CategoryEstimate } from '../types';

export const ESTIMATE_CSV_HEADER = [
  'category',
  'network',
  'visits',
  'cost_per_visit',
  'notes',
  'person',
];

export interface EstimateCsvError {
  line: number;
  message: string;
}

export interface EstimateCsvResult {
  estimates: CategoryEstimate[];
  errors: EstimateCsvError[];
}

/**
 * Split CSV text into rows of fields. Handles quoted fields, escaped quotes ("")
 * and commas or newlines inside quotes.
 */
const splitCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
};

/**
 * AI chat tools often wrap their answer in a markdown code fence or add a sentence
 * before it. Keep only the CSV itself.
 */
const stripWrapping = (text: string): string => {
  const withoutBom = text.replace(/^﻿/, '');
  const fenced = withoutBom.match(/```[a-zA-Z]*\s*\n([\s\S]*?)```/);
  return fenced ? fenced[1] : withoutBom;
};

const normalize = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ');

const parseNetwork = (value: string): boolean | null => {
  const network = normalize(value).replace(/[-_]/g, ' ');
  if (['in', 'in network', 'yes', 'y', 'true'].includes(network)) return true;
  if (['out', 'out of network', 'oon', 'no', 'n', 'false'].includes(network)) return false;
  return null;
};

const parseAmount = (value: string): number | null => {
  const cleaned = value.trim().replace(/[$,\s]/g, '');
  if (cleaned === '') return null;
  const amount = Number(cleaned);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
};

/**
 * Parse an estimates CSV (category, network, visits, cost_per_visit, notes, person) into
 * category estimates. Person is optional: 1, 2, ... for who the care is for. Category may be the id or the exact display name. Bad rows are
 * skipped and reported by line number; good rows are still returned.
 */
export const parseEstimatesCsv = (text: string, categories: CategoriesData): EstimateCsvResult => {
  const estimates: CategoryEstimate[] = [];
  const errors: EstimateCsvError[] = [];

  const categoryIdByKey = new Map<string, string>();
  for (const [id, category] of Object.entries(categories)) {
    categoryIdByKey.set(normalize(id), id);
    categoryIdByKey.set(normalize(category.name), id);
  }

  const rows = splitCsv(stripWrapping(text));
  rows.forEach((fields, index) => {
    const line = index + 1;
    if (fields.every(field => field.trim() === '')) return;
    if (normalize(fields[0]) === 'category') return; // header row

    const [
      categoryField = '',
      networkField = '',
      visitsField = '',
      costField = '',
      notes = '',
      personField = '',
    ] = fields;

    const categoryId = categoryIdByKey.get(normalize(categoryField));
    if (!categoryId) {
      errors.push({ line, message: `Unknown category "${categoryField.trim()}"` });
      return;
    }
    const isInNetwork = networkField.trim() === '' ? true : parseNetwork(networkField);
    if (isInNetwork === null) {
      errors.push({ line, message: `Network must be "in" or "out", not "${networkField.trim()}"` });
      return;
    }
    const visits = parseAmount(visitsField);
    if (visits === null) {
      errors.push({ line, message: `Visits must be a number, not "${visitsField.trim()}"` });
      return;
    }
    // A visit is whole; an averaged count like 1.5 rounds to the nearest visit
    const quantity = Math.round(visits);
    const costPerVisit = parseAmount(costField);
    if (costPerVisit === null) {
      errors.push({ line, message: `Cost per visit must be a number, not "${costField.trim()}"` });
      return;
    }

    // Who the care is for, when given as a whole number from 1; anything else leaves it unset
    const person = Number(personField.trim());
    estimates.push({
      categoryId,
      estimate: { quantity, costPerVisit, isInNetwork },
      notes: notes.trim().slice(0, 100),
      ...(Number.isInteger(person) && person >= 1 ? { person } : {}),
    });
  });

  return { estimates, errors };
};
