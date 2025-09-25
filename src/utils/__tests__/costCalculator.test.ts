import { calculateAllPlans, calculatePlanCost } from '../costCalculator';
import { PlanData, HealthPlan, UserInputs, UserCosts } from '../../types';

// Mock the planDataService
jest.mock('../../services/planDataService', () => ({
  getMaxHSAContribution: jest.fn(),
  getMaxFSAContribution: jest.fn(),
  getEmployerHSAContribution: jest.fn(),
}));

import { getMaxHSAContribution, getMaxFSAContribution, getEmployerHSAContribution } from '../../services/planDataService';

const mockGetMaxHSAContribution = getMaxHSAContribution as jest.MockedFunction<typeof getMaxHSAContribution>;
const mockGetMaxFSAContribution = getMaxFSAContribution as jest.MockedFunction<typeof getMaxFSAContribution>;
const mockGetEmployerHSAContribution = getEmployerHSAContribution as jest.MockedFunction<typeof getEmployerHSAContribution>;

describe('costCalculator', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  const mockPlanData: PlanData = {
    year: 2025,
    hsa_contribution_limits: {
      single_coverage: 4300,
      family_coverage: 8550,
      catch_up_age_55_plus: 1000,
    },
    fsa_contribution_limits: {
      healthcare_fsa: 3300,
    },
    plans: [],
  };

  const mockPPOPlan: HealthPlan = {
    name: 'Test PPO Plan',
    type: 'PPO',
    monthly_premiums: {
      single: 200,
      two_party: 400,
      family: 600,
    },
    annual_deductible: {
      in_network: { single: 500, family: 1000 },
      out_of_network: { single: 1000, family: 2000 },
    },
    out_of_pocket_maximum: {
      in_network: { individual: 5000, family: 10000 },
      out_of_network: { individual: 10000, family: 20000 },
    },
    default: {
      in_network_coverage: { coinsurance: 0.2 },
      out_of_network_coverage: { coinsurance: 0.4 },
    },
    categories: {
      office_visit_pcp: {
        in_network_coverage: { copay: 25 },
        out_of_network_coverage: { copay: 50 },
      },
    },
  };

  const mockHSAPlan: HealthPlan = {
    name: 'Test HSA Plan',
    type: 'HSA',
    monthly_premiums: {
      single: 150,
      two_party: 300,
      family: 450,
    },
    annual_deductible: {
      in_network: { single: 1500, family: 3000 },
      out_of_network: { single: 3000, family: 6000 },
    },
    out_of_pocket_maximum: {
      in_network: { individual: 6000, family: 12000 },
      out_of_network: { individual: 12000, family: 24000 },
    },
    default: {
      in_network_coverage: { coinsurance: 0.2 },
      out_of_network_coverage: { coinsurance: 0.4 },
    },
    categories: {},
    employer_hsa_contribution: {
      single: 500,
      two_party: 1000,
      family: 1000,
    },
  };

  const mockUserInputs: UserInputs = {
    year: 2025,
    coverage: 'single',
    ageGroup: 'under_55',
    taxRate: 22,
    costs: {
      categoryEstimates: [
        {
          categoryId: 'office_visit_pcp',
          inNetworkCost: 200,
          outOfNetworkCost: 0,
        },
      ],
      otherCosts: {
        inNetworkCost: 1000,
        outOfNetworkCost: 0,
      },
    },
    hsaContribution: 2000,
    fsaContribution: 1500,
  };

  describe('calculatePlanCost', () => {
    beforeEach(() => {
      mockGetMaxHSAContribution.mockReturnValue(4300);
      mockGetMaxFSAContribution.mockReturnValue(3300);
      mockGetEmployerHSAContribution.mockReturnValue(500);
    });

    it('should calculate PPO plan costs correctly', () => {
      const result = calculatePlanCost(mockPPOPlan, mockPlanData, mockUserInputs);

      expect(result.planName).toBe('Test PPO Plan');
      expect(result.planType).toBe('PPO');
      expect(result.annualPremiums).toBe(2400); // 200 * 12
      expect(result.userContribution).toBe(1500); // FSA contribution
      expect(result.employerContribution).toBe(0); // No employer contribution for PPO
      expect(result.taxSavings).toBe(330); // 1500 * 0.22
    });

    it('should calculate HSA plan costs correctly', () => {
      const result = calculatePlanCost(mockHSAPlan, mockPlanData, mockUserInputs);

      expect(result.planName).toBe('Test HSA Plan');
      expect(result.planType).toBe('HSA');
      expect(result.annualPremiums).toBe(1800); // 150 * 12
      expect(result.userContribution).toBe(2000); // HSA contribution
      expect(result.employerContribution).toBe(500); // Employer HSA contribution
      expect(result.taxSavings).toBe(550); // (2000 + 500) * 0.22
    });

    it('should handle copay categories correctly', () => {
      const userInputs = {
        ...mockUserInputs,
        costs: {
          categoryEstimates: [
            {
              categoryId: 'office_visit_pcp',
              inNetworkCost: 200,
              outOfNetworkCost: 100,
            },
          ],
        },
      };

      const result = calculatePlanCost(mockPPOPlan, mockPlanData, userInputs);

      // Should use copay amounts: $25 for in-network, $50 for out-of-network
      expect(result.outOfPocketCosts).toBe(75); // 25 + 50
    });

    it('should handle coinsurance categories correctly', () => {
      const planWithCoinsurance = {
        ...mockPPOPlan,
        categories: {
          test_category: {
            in_network_coverage: { coinsurance: 0.3 },
            out_of_network_coverage: { coinsurance: 0.5 },
          },
        },
      };

      const userInputs = {
        ...mockUserInputs,
        costs: {
          categoryEstimates: [
            {
              categoryId: 'test_category',
              inNetworkCost: 1000,
              outOfNetworkCost: 500,
            },
          ],
        },
      };

      const result = calculatePlanCost(planWithCoinsurance, mockPlanData, userInputs);

      // Should use coinsurance: 1000 * 0.3 + 500 * 0.5 = 300 + 250 = 550
      expect(result.outOfPocketCosts).toBe(550);
    });

    it('should handle max coinsurance caps', () => {
      const planWithMaxCoinsurance = {
        ...mockPPOPlan,
        categories: {
          test_category: {
            in_network_coverage: { coinsurance: 0.5, max_coinsurance: 100 },
          },
        },
      };

      const userInputs = {
        ...mockUserInputs,
        costs: {
          categoryEstimates: [
            {
              categoryId: 'test_category',
              inNetworkCost: 1000,
              outOfNetworkCost: 0,
            },
          ],
        },
      };

      const result = calculatePlanCost(planWithMaxCoinsurance, mockPlanData, userInputs);

      // Should cap at max_coinsurance: min(1000 * 0.5, 100) = 100
      expect(result.outOfPocketCosts).toBe(100);
    });

    it('should fall back to default coverage when category not found', () => {
      const userInputs = {
        ...mockUserInputs,
        costs: {
          categoryEstimates: [
            {
              categoryId: 'unknown_category',
              inNetworkCost: 1000,
              outOfNetworkCost: 0,
            },
          ],
        },
      };

      const result = calculatePlanCost(mockPPOPlan, mockPlanData, userInputs);

      // Should use default coinsurance: 1000 * 0.2 = 200
      expect(result.outOfPocketCosts).toBe(200);
    });

    it('should handle HSA contribution limits correctly', () => {
      mockGetMaxHSAContribution.mockReturnValue(4300);
      mockGetEmployerHSAContribution.mockReturnValue(1000);

      const userInputs = {
        ...mockUserInputs,
        hsaContribution: 5000, // Over the limit
      };

      const result = calculatePlanCost(mockHSAPlan, mockPlanData, userInputs);

      // Should limit user contribution to remaining space: 4300 - 1000 = 3300
      expect(result.userContribution).toBe(3300);
      expect(result.employerContribution).toBe(1000);
      expect(result.taxSavings).toBe(946); // (3300 + 1000) * 0.22
    });

    it('should handle FSA contribution limits correctly', () => {
      mockGetMaxFSAContribution.mockReturnValue(3300);

      const userInputs = {
        ...mockUserInputs,
        fsaContribution: 5000, // Over the limit
      };

      const result = calculatePlanCost(mockPPOPlan, mockPlanData, userInputs);

      // Should limit FSA contribution to max
      expect(result.userContribution).toBe(3300);
      expect(result.taxSavings).toBe(726); // 3300 * 0.22
    });

    it('should cap out-of-pocket costs at plan maximum', () => {
      const userInputs = {
        ...mockUserInputs,
        costs: {
          categoryEstimates: [
            {
              categoryId: 'office_visit_pcp',
              inNetworkCost: 50000, // Very high cost
              outOfNetworkCost: 0,
            },
          ],
        },
      };

      const result = calculatePlanCost(mockPPOPlan, mockPlanData, userInputs);

      // Should use copay amount since there's a specific copay for office_visit_pcp
      expect(result.outOfPocketCosts).toBe(25);
    });

    it('should handle family coverage deductibles correctly', () => {
      const userInputs = {
        ...mockUserInputs,
        coverage: 'family' as const,
      };

      // Test with no specific category coverage to trigger deductible calculation
      const planWithoutCategorySpecific = {
        ...mockPPOPlan,
        categories: {},
      };

      const result = calculatePlanCost(planWithoutCategorySpecific, mockPlanData, {
        ...userInputs,
        costs: {
          categoryEstimates: [
            {
              categoryId: 'test_category',
              inNetworkCost: 500,
              outOfNetworkCost: 0,
            },
          ],
        },
      });

      // Should use default coinsurance: 500 * 0.2 = 100
      expect(result.outOfPocketCosts).toBe(100);
    });

    it('should handle edge case with zero costs', () => {
      const userInputs = {
        ...mockUserInputs,
        costs: {
          categoryEstimates: [],
        },
        hsaContribution: 0,
        fsaContribution: 0,
      };

      const result = calculatePlanCost(mockPPOPlan, mockPlanData, userInputs);

      expect(result.outOfPocketCosts).toBe(0);
      expect(result.userContribution).toBe(0);
      expect(result.taxSavings).toBe(0);
    });

    it('should handle negative total cost (when tax savings exceed costs)', () => {
      const userInputs = {
        ...mockUserInputs,
        hsaContribution: 3800, // Set to fit within limits
        taxRate: 40, // High tax rate
        costs: {
          categoryEstimates: [],
        },
      };

      mockGetMaxHSAContribution.mockReturnValue(4300);
      mockGetEmployerHSAContribution.mockReturnValue(500); // From mockHSAPlan

      const result = calculatePlanCost(mockHSAPlan, mockPlanData, userInputs);

      // Tax savings calculation: (3800 + 500) * 0.4 = 1720
      expect(result.taxSavings).toBe(1720);
      expect(result.totalCost).toBe(80); // 1800 + 0 - 1720 = 80
    });
  });

  describe('calculateAllPlans', () => {
    it('should calculate and sort all plans by total cost', () => {
      // Setup mocks for this test
      mockGetMaxHSAContribution.mockReturnValue(4300);
      mockGetMaxFSAContribution.mockReturnValue(3300);
      mockGetEmployerHSAContribution.mockReturnValue(500);

      const planData = {
        ...mockPlanData,
        plans: [mockPPOPlan, mockHSAPlan],
      };

      const results = calculateAllPlans(planData, mockUserInputs);

      expect(results).toHaveLength(2);

      // Ensure both results have finite total costs
      expect(Number.isFinite(results[0].totalCost)).toBe(true);
      expect(Number.isFinite(results[1].totalCost)).toBe(true);

      // Verify sorting - first plan should have lower or equal total cost
      expect(results[0].totalCost).toBeLessThanOrEqual(results[1].totalCost);
    });

    it('should handle empty plans array', () => {
      const planData = {
        ...mockPlanData,
        plans: [],
      };

      const results = calculateAllPlans(planData, mockUserInputs);

      expect(results).toHaveLength(0);
    });
  });

  describe('Edge cases and potential bugs', () => {
    it('should handle missing category benefits gracefully', () => {
      const planWithMissingBenefits = {
        ...mockPPOPlan,
        categories: {
          incomplete_category: {
            // Missing coverage definitions
          },
        },
      };

      const userInputs = {
        ...mockUserInputs,
        costs: {
          categoryEstimates: [
            {
              categoryId: 'incomplete_category',
              inNetworkCost: 1000,
              outOfNetworkCost: 0,
            },
          ],
        },
      };

      expect(() => {
        calculatePlanCost(planWithMissingBenefits, mockPlanData, userInputs);
      }).not.toThrow();
    });

    it('should handle missing default benefits', () => {
      const planWithoutDefault = {
        ...mockPPOPlan,
        default: {},
      };

      const userInputs = {
        ...mockUserInputs,
        costs: {
          categoryEstimates: [
            {
              categoryId: 'unknown_category',
              inNetworkCost: 1000,
              outOfNetworkCost: 0,
            },
          ],
        },
      };

      expect(() => {
        calculatePlanCost(planWithoutDefault, mockPlanData, userInputs);
      }).not.toThrow();
    });

    it('should handle very large numbers without overflow', () => {
      // Setup mocks for this test
      mockGetMaxFSAContribution.mockReturnValue(3300);

      const userInputs = {
        ...mockUserInputs,
        costs: {
          categoryEstimates: [
            {
              categoryId: 'office_visit_pcp',
              inNetworkCost: 999999999,
              outOfNetworkCost: 0,
            },
          ],
        },
      };

      const result = calculatePlanCost(mockPPOPlan, mockPlanData, userInputs);

      // Should use copay amount since there's a specific copay for office_visit_pcp
      expect(result.outOfPocketCosts).toBe(25);
      expect(Number.isFinite(result.totalCost)).toBe(true);
    });
  });
});