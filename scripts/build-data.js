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

// eslint-disable-next-line no-console
console.log('Building data from YAML files...');

// Find all year files in plan_years directory
const yearFiles = fs
  .readdirSync(PLAN_YEARS_DIR)
  .filter(file => file.endsWith('.yml'))
  .map(file => {
    const year = parseInt(file.replace('.yml', ''));
    return { year, file };
  })
  .filter(item => !isNaN(item.year))
  .sort((a, b) => a.year - b.year);

// eslint-disable-next-line no-console
console.log(
  'Found year files:',
  yearFiles.map(item => item.file)
);

// Load all plan data by year
const planDataByYear = {};

for (const { year, file } of yearFiles) {
  const yamlPath = path.join(PLAN_YEARS_DIR, file);
  const yamlContent = fs.readFileSync(yamlPath, 'utf8');
  const parsedData = yaml.load(yamlContent);

  planDataByYear[year] = parsedData;
  // eslint-disable-next-line no-console
  console.log(`Loaded ${file} for year ${year}`);
}

// Load categories if it exists
let categoriesData = {};
const categoriesPath = path.join(DATA_DIR, 'categories.yml');
if (fs.existsSync(categoriesPath)) {
  const categoriesContent = fs.readFileSync(categoriesPath, 'utf8');
  categoriesData = yaml.load(categoriesContent);
  // eslint-disable-next-line no-console
  console.log('Loaded categories.yml');
}

// Generate JSON files
const planDataFile = path.join(OUTPUT_DIR, 'planDataByYear.json');
const categoriesFile = path.join(OUTPUT_DIR, 'categoriesData.json');
const helpersFile = path.join(OUTPUT_DIR, 'dataHelpers.ts');

// Write JSON files
fs.writeFileSync(planDataFile, JSON.stringify(planDataByYear, null, 2));
// eslint-disable-next-line no-console
console.log(`Generated ${planDataFile}`);

fs.writeFileSync(categoriesFile, JSON.stringify(categoriesData, null, 2));
// eslint-disable-next-line no-console
console.log(`Generated ${categoriesFile}`);

// Generate TypeScript helper functions
const helpersContent = `// Auto-generated from YAML files - DO NOT EDIT MANUALLY
// Run 'npm run build-data' to regenerate

import { PlanData, CategoriesData } from '../types';
import planDataByYear from './planDataByYear.json';
import categoriesData from './categoriesData.json';

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

// Re-export the data
export { planDataByYear, categoriesData };
`;

fs.writeFileSync(helpersFile, helpersContent);
// eslint-disable-next-line no-console
console.log(`Generated ${helpersFile}`);
// eslint-disable-next-line no-console
console.log(
  'Build complete! Available years:',
  yearFiles.map(item => item.year)
);
