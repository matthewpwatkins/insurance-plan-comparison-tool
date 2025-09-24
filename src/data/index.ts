import { PlanData, CategoriesData } from '../types';

// Auto-generated imports from YAML files
import { planData2025 } from './generated/plan-data-2025';
import { planData2026 } from './generated/plan-data-2026';
import { categoriesData } from './generated/categories';

// Data lookup at compile time
const parsedPlanData: Record<number, PlanData> = {
  2025: planData2025,
  2026: planData2026,
};

const parsedCategories: CategoriesData = categoriesData;

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
    throw new Error(`Plan data not available for year ${year}. Available years: ${getAvailableYears().join(', ')}`);
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
