#!/usr/bin/env node

// Turns data/**/*.yml into src/generated/. Validates every file against data/schema
// and cross-checks references, so a bad contribution fails here with a readable message.

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const COMPANIES_DIR = path.join(DATA_DIR, 'companies');
const IRS_DIR = path.join(DATA_DIR, 'irs');
const SCHEMA_DIR = path.join(ROOT, 'data/schema');
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(ROOT, 'src/generated');

const SLUG_PATTERN = /^[a-z0-9-]+$/;
const TEMPLATE_SLUG = '_template';

const errors = [];
const relative = file => path.relative(ROOT, file);

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const loadSchema = name =>
  ajv.compile(JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, `${name}.schema.json`), 'utf8')));
const validators = {
  company: loadSchema('company'),
  irs: loadSchema('irs'),
  categories: loadSchema('categories'),
  planYear: loadSchema('plan-year'),
};

// Reads a YAML file and validates it. Returns undefined (after recording errors) if it is invalid.
const loadYaml = (file, validate) => {
  let parsed;
  try {
    parsed = yaml.load(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    errors.push(`${relative(file)}: invalid YAML: ${error.message}`);
    return undefined;
  }
  if (!validate(parsed)) {
    for (const e of validate.errors) {
      const detail =
        e.params && e.params.additionalProperty ? ` "${e.params.additionalProperty}"` : '';
      errors.push(`${relative(file)}: ${e.instancePath || '/'} ${e.message}${detail}`);
    }
    return undefined;
  }
  return parsed;
};

const yearFiles = dir =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter(file => /^\d{4}\.yml$/.test(file))
        .map(file => ({ year: parseInt(file, 10), file: path.join(dir, file) }))
        .sort((a, b) => a.year - b.year)
    : [];

// eslint-disable-next-line no-console
console.log('Building data from YAML files...');

const irsByYear = {};
for (const { year, file } of yearFiles(IRS_DIR)) {
  const irs = loadYaml(file, validators.irs);
  if (irs) irsByYear[year] = irs;
}

const sharedCategories =
  loadYaml(path.join(DATA_DIR, 'categories.yml'), validators.categories) || {};

const companies = {};
const companyDirs = fs
  .readdirSync(COMPANIES_DIR, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort();

for (const slug of companyDirs) {
  const dir = path.join(COMPANIES_DIR, slug);
  if (slug !== TEMPLATE_SLUG && !SLUG_PATTERN.test(slug)) {
    errors.push(`${relative(dir)}: folder name must be lowercase letters, digits, and dashes`);
    continue;
  }

  const company = loadYaml(path.join(dir, 'company.yml'), validators.company);
  const categoriesFile = path.join(dir, 'categories.yml');
  const companyCategories = fs.existsSync(categoriesFile)
    ? loadYaml(categoriesFile, validators.categories) || {}
    : {};
  const categories = { ...sharedCategories, ...companyCategories };

  const serviceMaps = [
    ...Object.entries(company?.claims_report?.service_map ?? {}),
    ...Object.entries(company?.claims_report?.preventive_map ?? {}),
  ];
  for (const [label, categoryIds] of serviceMaps) {
    for (const categoryId of categoryIds) {
      if (!categories[categoryId]) {
        errors.push(
          `${relative(path.join(dir, 'company.yml'))}: claims_report label "${label}" ` +
            `uses unknown category "${categoryId}"`
        );
      }
    }
  }

  const years = {};
  const files = yearFiles(path.join(dir, 'plan_years'));
  if (files.length === 0) {
    errors.push(`${relative(dir)}: needs at least one plan_years/<year>.yml`);
  }
  for (const { year, file } of files) {
    const planYear = loadYaml(file, validators.planYear);
    if (!planYear) continue;

    if (planYear.year !== year) {
      errors.push(`${relative(file)}: year ${planYear.year} does not match the file name`);
    }
    if (!irsByYear[year]) {
      errors.push(`${relative(file)}: no federal limits for ${year}; add data/irs/${year}.yml`);
      continue;
    }

    const planNames = new Set();
    for (const plan of planYear.plans) {
      if (planNames.has(plan.name)) {
        errors.push(`${relative(file)}: duplicate plan name "${plan.name}"`);
      }
      planNames.add(plan.name);
      for (const categoryId of Object.keys(plan.categories)) {
        if (!categories[categoryId]) {
          errors.push(
            `${relative(file)}: plan "${plan.name}" uses unknown category "${categoryId}"; ` +
              `add it to data/categories.yml or this company's categories.yml`
          );
        }
      }
    }

    years[year] = { ...irsByYear[year], year, plans: planYear.plans, categories };
  }

  if (company && slug !== TEMPLATE_SLUG) {
    companies[slug] = { company: { slug, ...company }, years };
  }
}

if (errors.length > 0) {
  // eslint-disable-next-line no-console
  console.error(
    `\nData validation failed (${errors.length}):\n${errors.map(e => `  - ${e}`).join('\n')}\n`
  );
  process.exit(1);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUTPUT_DIR, 'companyData.json'), JSON.stringify(companies, null, 2));

const helpersContent = `// Auto-generated from YAML files - DO NOT EDIT MANUALLY
// Run 'npm run build-data' to regenerate

import { PlanData, Company } from '../types';
import companyData from './companyData.json';

type CompanyEntry = { company: Company; years: Record<number, PlanData> };
const data = companyData as unknown as Record<string, CompanyEntry>;

/**
 * All companies, sorted by display name
 */
export const getCompanies = (): Company[] =>
  Object.values(data)
    .map(entry => entry.company)
    .sort((a, b) => a.name.localeCompare(b.name));

/**
 * Look up a company by its URL slug
 */
export const getCompany = (slug: string): Company | undefined => data[slug]?.company;

/**
 * Get all available years for a company, newest first
 */
export const getAvailableYears = (slug: string): number[] =>
  Object.keys(data[slug]?.years ?? {})
    .map(year => parseInt(year))
    .sort((a, b) => b - a);

/**
 * Get a company's plan data for a specific year
 */
export const getPlanData = (slug: string, year: number): PlanData => {
  const planData = data[slug]?.years[year];
  if (!planData) {
    throw new Error(\`Plan data not available for \${slug} in \${year}. Available years: \${getAvailableYears(slug).join(', ')}\`);
  }
  return planData;
};

/**
 * Get the most recent year a company has data for
 */
export const getLatestYear = (slug: string): number => getAvailableYears(slug)[0];
`;
fs.writeFileSync(path.join(OUTPUT_DIR, 'dataHelpers.ts'), helpersContent);

// eslint-disable-next-line no-console
console.log(
  'Build complete. Companies:',
  Object.entries(companies).map(([slug, { years }]) => `${slug} (${Object.keys(years).join(', ')})`)
);
