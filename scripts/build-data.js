#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const DATA_DIR = path.join(__dirname, '../src/data');
const OUTPUT_DIR = path.join(DATA_DIR, 'generated');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Find all year directories
const yearDirs = fs.readdirSync(DATA_DIR)
  .filter(item => {
    const fullPath = path.join(DATA_DIR, item);
    return fs.statSync(fullPath).isDirectory() && /^\d{4}$/.test(item);
  })
  .sort();

console.log('Found year directories:', yearDirs);

// Convert each year's YAML to TypeScript
const yearImports = [];
const yearData = [];

for (const year of yearDirs) {
  const yamlPath = path.join(DATA_DIR, year, 'plan-data.yml');

  if (fs.existsSync(yamlPath)) {
    const yamlContent = fs.readFileSync(yamlPath, 'utf8');
    const parsedData = yaml.load(yamlContent);

    // Generate TypeScript file for this year
    const tsContent = `import { PlanData } from '../../types';

export const planData${year}: PlanData = ${JSON.stringify(parsedData, null, 2)};
`;

    const outputFile = path.join(OUTPUT_DIR, `plan-data-${year}.ts`);
    fs.writeFileSync(outputFile, tsContent);

    yearImports.push(`import { planData${year} } from './generated/plan-data-${year}';`);
    yearData.push(`  ${year}: planData${year},`);

    console.log(`Generated ${outputFile}`);
  } else {
    console.warn(`Warning: ${yamlPath} not found`);
  }
}

// Convert categories YAML to TypeScript
const categoriesPath = path.join(DATA_DIR, 'categories.yml');
let categoriesImport = '';
let categoriesData = 'const parsedCategories: CategoriesData = {};';

if (fs.existsSync(categoriesPath)) {
  const categoriesContent = fs.readFileSync(categoriesPath, 'utf8');
  const parsedCategories = yaml.load(categoriesContent);

  const categoriesTsContent = `import { CategoriesData } from '../../types';

export const categoriesData: CategoriesData = ${JSON.stringify(parsedCategories, null, 2)};
`;

  const categoriesOutputFile = path.join(OUTPUT_DIR, 'categories.ts');
  fs.writeFileSync(categoriesOutputFile, categoriesTsContent);

  categoriesImport = "import { categoriesData } from './generated/categories';";
  categoriesData = 'const parsedCategories: CategoriesData = categoriesData;';

  console.log(`Generated ${categoriesOutputFile}`);
}

// Generate the main index.ts file
const indexContent = `import { PlanData, CategoriesData } from '../types';

// Auto-generated imports from YAML files
${yearImports.join('\n')}
${categoriesImport}

// Data lookup at compile time
const parsedPlanData: Record<number, PlanData> = {
${yearData.join('\n')}
};

${categoriesData}

/**
 * Get all available years (dynamically discovered from imported data)
 */
export const getAvailableYears = (): number[] => {
  return Object.keys(parsedPlanData).map(year => parseInt(year)).sort((a, b) => b - a);
};

/**
 * Get plan data for a specific year (synchronous, compile-time loaded)
 */
export const getPlanData = (year: number): PlanData => {
  const data = parsedPlanData[year];
  if (!data) {
    throw new Error(\`Plan data not available for year \${year}. Available years: \${getAvailableYears().join(', ')}\`);
  }
  return data;
};

/**
 * Get categories data (synchronous, compile-time loaded)
 */
export const getCategoriesData = (): CategoriesData => {
  return parsedCategories;
};

/**
 * Get the latest/most recent year available
 */
export const getLatestYear = (): number => {
  const years = getAvailableYears();
  return years[0]; // Already sorted descending
};
`;

const indexPath = path.join(DATA_DIR, 'index.ts');
fs.writeFileSync(indexPath, indexContent);

console.log(`Generated ${indexPath}`);
console.log('Build complete! Available years:', yearDirs);