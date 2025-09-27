#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const DATA_DIR = path.join(__dirname, '../data');
const PLAN_YEARS_DIR = path.join(DATA_DIR, 'plan_years');
const OUTPUT_DIR = path.join(__dirname, '../src/generated');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('Building data from YAML files...');

// Find all year files in plan_years directory
const yearFiles = fs.readdirSync(PLAN_YEARS_DIR)
  .filter(file => file.endsWith('.yml'))
  .map(file => {
    const year = parseInt(file.replace('.yml', ''));
    return { year, file };
  })
  .filter(item => !isNaN(item.year))
  .sort((a, b) => a.year - b.year);

console.log('Found year files:', yearFiles.map(item => item.file));

// Load all plan data by year
const planDataByYear = {};

for (const { year, file } of yearFiles) {
  const yamlPath = path.join(PLAN_YEARS_DIR, file);
  const yamlContent = fs.readFileSync(yamlPath, 'utf8');
  const parsedData = yaml.load(yamlContent);

  planDataByYear[year] = parsedData;
  console.log(`Loaded ${file} for year ${year}`);
}

// Load categories if it exists
let categoriesData = {};
const categoriesPath = path.join(DATA_DIR, 'categories.yml');
if (fs.existsSync(categoriesPath)) {
  const categoriesContent = fs.readFileSync(categoriesPath, 'utf8');
  categoriesData = yaml.load(categoriesContent);
  console.log('Loaded categories.yml');
}

// Load company configuration if it exists
let companyData = {};
const companyPath = path.join(DATA_DIR, 'company.yml');
if (fs.existsSync(companyPath)) {
  const companyContent = fs.readFileSync(companyPath, 'utf8');
  companyData = yaml.load(companyContent);
  console.log('Loaded company.yml');
}

// Generate JSON files
const planDataFile = path.join(OUTPUT_DIR, 'planDataByYear.json');
const categoriesFile = path.join(OUTPUT_DIR, 'categoriesData.json');
const companyFile = path.join(OUTPUT_DIR, 'companyData.json');
const helpersFile = path.join(OUTPUT_DIR, 'dataHelpers.ts');

// Write JSON files
fs.writeFileSync(planDataFile, JSON.stringify(planDataByYear, null, 2));
console.log(`Generated ${planDataFile}`);

fs.writeFileSync(categoriesFile, JSON.stringify(categoriesData, null, 2));
console.log(`Generated ${categoriesFile}`);

fs.writeFileSync(companyFile, JSON.stringify(companyData, null, 2));
console.log(`Generated ${companyFile}`);

// Process company text templates if they exist
let processedCompanyTexts = {};
if (companyData.text && companyData.company) {
  processedCompanyTexts = {};
  for (const [key, template] of Object.entries(companyData.text)) {
    processedCompanyTexts[key] = template
      .replace(/\{company\.name\}/g, companyData.company.fullName || companyData.company.name)
      .replace(/\{company\.shortName\}/g, companyData.company.shortName)
      .replace(/\{company\.fullName\}/g, companyData.company.fullName || companyData.company.name);
  }
}

// Generate TypeScript helper functions
const helpersContent = `// Auto-generated from YAML files - DO NOT EDIT MANUALLY
// Run 'npm run build-data' to regenerate

import { PlanData, CategoriesData, CompanyData } from '../types';
import planDataByYear from './planDataByYear.json';
import categoriesData from './categoriesData.json';
import companyData from './companyData.json';

/**
 * Get all available years (dynamically discovered from data)
 */
export const getAvailableYears = (): number[] => {
  return Object.keys(planDataByYear).map(year => parseInt(year)).sort((a, b) => b - a);
};

/**
 * Get plan data for a specific year
 */
export const getPlanData = (year: number): PlanData => {
  const data = (planDataByYear as Record<number, PlanData>)[year];
  if (!data) {
    throw new Error(\`Plan data not available for year \${year}. Available years: \${getAvailableYears().join(', ')}\`);
  }
  return data;
};

/**
 * Get categories data
 */
export const getCategoriesData = (): CategoriesData => {
  return categoriesData as CategoriesData;
};

/**
 * Get the latest/most recent year available
 */
export const getLatestYear = (): number => {
  const years = getAvailableYears();
  return years[0]; // Already sorted descending
};

/**
 * Get company configuration data
 */
export const getCompanyData = (): CompanyData => {
  return companyData as CompanyData;
};

/**
 * Get processed company text
 */
export const getCompanyTexts = (): Record<string, string> => {
  return ${JSON.stringify(processedCompanyTexts, null, 2)};
};

// Re-export the data
export { planDataByYear, categoriesData, companyData };
`;

fs.writeFileSync(helpersFile, helpersContent);
console.log(`Generated ${helpersFile}`);
console.log('Build complete! Available years:', yearFiles.map(item => item.year));