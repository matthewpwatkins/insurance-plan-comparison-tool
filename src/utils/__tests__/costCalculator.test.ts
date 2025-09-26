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
    payroll_tax_rates: {
      social_security: 6.2,
      medicare: 1.45,
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
          inNetwork: {
            quantity: 2,
            costPerVisit: 150,
          },
          outOfNetwork: {
            quantity: 0,
            costPerVisit: 0,
          },
        },
      ],
      otherCosts: {
        inNetwork: {
          quantity: 1,
          costPerVisit: 500,
        },
        outOfNetwork: {
          quantity: 0,
          costPerVisit: 0,
        },
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

    it('should calculate PPO plan costs correctly with copays', () => {
      const result = calculatePlanCost(mockPPOPlan, mockPlanData, mockUserInputs);

      expect(result.planName).toBe('Test PPO Plan');
      expect(result.planType).toBe('PPO');
      expect(result.annualPremiums).toBe(2400); // 200 * 12
      expect(result.userContribution).toBe(1500); // FSA contribution
      expect(result.employerContribution).toBe(0); // No employer contribution for PPO
      expect(result.taxSavings).toBe(444.75); // 1500 * (0.22 + 0.0765)

      // Out of pocket calculation:
      // 2 copays: $25 * 2 = $50 (copays do NOT count toward deductible)
      // Other costs: $500 total, full $500 goes to deductible (since deductible is $500)
      // No coinsurance needed since deductible covers full cost
      // Total OOP = $50 (copays) + $500 (deductible) = $550
      expect(result.outOfPocketCosts).toBe(550);
    });

    it('should calculate HSA plan costs correctly with deductibles', () => {
      const result = calculatePlanCost(mockHSAPlan, mockPlanData, mockUserInputs);

      expect(result.planName).toBe('Test HSA Plan');
      expect(result.planType).toBe('HSA');
      expect(result.annualPremiums).toBe(1800); // 150 * 12
      expect(result.userContribution).toBe(2000); // Employee HSA contribution from input
      expect(result.employerContribution).toBe(500); // Employer HSA contribution
      expect(result.taxSavings).toBe(593); // Employee contribution only: 2000 * (0.22 + 0.0765)

      // Out of pocket for HSA: all costs go against deductible first (no copays in default HSA)
      // 2 visits * $150 + 1 other * $500 = $800 total cost
      // All $800 goes to deductible (since deductible is $1500)
      expect(result.outOfPocketCosts).toBe(800);
    });

    it('should handle both in-network and out-of-network visits', () => {
      const userInputs = {
        ...mockUserInputs,
        costs: {
          categoryEstimates: [
            {
              categoryId: 'office_visit_pcp',
              inNetwork: {
                quantity: 2,
                costPerVisit: 200,
              },
              outOfNetwork: {
                quantity: 1,
                costPerVisit: 300,
              },
            },
          ],
          otherCosts: {
            inNetwork: {
              quantity: 0,
              costPerVisit: 0,
            },
            outOfNetwork: {
              quantity: 0,
              costPerVisit: 0,
            },
          },
        },
      };

      const result = calculatePlanCost(mockPPOPlan, mockPlanData, userInputs);

      // Should use copay amounts: $25 * 2 (in-network) + $50 * 1 (out-of-network) = $100
      expect(result.outOfPocketCosts).toBe(100);
    });

    it('should handle coinsurance after deductible is met', () => {
      const planWithLowDeductible = {
        ...mockPPOPlan,
        annual_deductible: {
          in_network: { single: 100, family: 200 }, // Low deductible
          out_of_network: { single: 1000, family: 2000 },
        },
        categories: {
          test_category: {
            in_network_coverage: { coinsurance: 0.3 },
          },
        },
      };

      const userInputs = {
        ...mockUserInputs,
        costs: {
          categoryEstimates: [
            {
              categoryId: 'test_category',
              inNetwork: {
                quantity: 1,
                costPerVisit: 1000,
              },
              outOfNetwork: {
                quantity: 0,
                costPerVisit: 0,
              },
            },
          ],
          otherCosts: {
            inNetwork: {
              quantity: 0,
              costPerVisit: 0,
            },
            outOfNetwork: {
              quantity: 0,
              costPerVisit: 0,
            },
          },
        },
      };

      const result = calculatePlanCost(planWithLowDeductible, mockPlanData, userInputs);

      // First $100 goes to deductible, remaining $900 * 0.3 coinsurance = $270
      // Total OOP = $100 (deductible) + $270 (coinsurance) = $370
      expect(result.outOfPocketCosts).toBe(370);
    });

    it('should handle max coinsurance caps', () => {
      const planWithMaxCoinsurance = {
        ...mockPPOPlan,
        annual_deductible: {
          in_network: { single: 0, family: 0 }, // No deductible
          out_of_network: { single: 1000, family: 2000 },
        },
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
              inNetwork: {
                quantity: 1,
                costPerVisit: 1000,
              },
              outOfNetwork: {
                quantity: 0,
                costPerVisit: 0,
              },
            },
          ],
          otherCosts: {
            inNetwork: {
              quantity: 0,
              costPerVisit: 0,
            },
            outOfNetwork: {
              quantity: 0,
              costPerVisit: 0,
            },
          },
        },
      };

      const result = calculatePlanCost(planWithMaxCoinsurance, mockPlanData, userInputs);

      // Should cap at max_coinsurance: min(1000 * 0.5, 100) = 100
      expect(result.outOfPocketCosts).toBe(100);
    });

    it('should cap at out-of-pocket maximum', () => {
      const planWithLowOOP = {
        ...mockHSAPlan,
        out_of_pocket_maximum: {
          in_network: { individual: 200, family: 400 }, // Very low OOP max
          out_of_network: { individual: 10000, family: 20000 },
        },
      };

      const userInputs = {
        ...mockUserInputs,
        costs: {
          categoryEstimates: [
            {
              categoryId: 'office_visit_pcp',
              inNetwork: {
                quantity: 10,
                costPerVisit: 1000, // Very high costs
              },
              outOfNetwork: {
                quantity: 0,
                costPerVisit: 0,
              },
            },
          ],
          otherCosts: {
            inNetwork: {
              quantity: 0,
              costPerVisit: 0,
            },
            outOfNetwork: {
              quantity: 0,
              costPerVisit: 0,
            },
          },
        },
      };

      const result = calculatePlanCost(planWithLowOOP, mockPlanData, userInputs);

      // Should be capped at out-of-pocket maximum
      expect(result.outOfPocketCosts).toBe(200);
    });

    it('should handle zero costs', () => {
      const userInputs = {
        ...mockUserInputs,
        costs: {
          categoryEstimates: [],
          otherCosts: {
            inNetwork: {
              quantity: 0,
              costPerVisit: 0,
            },
            outOfNetwork: {
              quantity: 0,
              costPerVisit: 0,
            },
          },
        },
        hsaContribution: 0,
        fsaContribution: 0,
      };

      const result = calculatePlanCost(mockPPOPlan, mockPlanData, userInputs);

      expect(result.outOfPocketCosts).toBe(0);
      expect(result.userContribution).toBe(0);
      expect(result.taxSavings).toBe(0);
    });

    it('should process multiple visits correctly accumulating against deductible', () => {
      const userInputs = {
        ...mockUserInputs,
        costs: {
          categoryEstimates: [
            {
              categoryId: 'test_category', // Not defined, uses default coinsurance
              inNetwork: {
                quantity: 3,
                costPerVisit: 300,
              },
              outOfNetwork: {
                quantity: 0,
                costPerVisit: 0,
              },
            },
          ],
          otherCosts: {
            inNetwork: {
              quantity: 0,
              costPerVisit: 0,
            },
            outOfNetwork: {
              quantity: 0,
              costPerVisit: 0,
            },
          },
        },
      };

      const result = calculatePlanCost(mockPPOPlan, mockPlanData, userInputs);

      // 3 visits * $300 = $900 total
      // First $500 goes to deductible (single deductible)
      // Remaining $400 * 0.2 coinsurance = $80
      // Total OOP = $500 (deductible) + $80 (coinsurance) = $580
      expect(result.outOfPocketCosts).toBe(580);
    });

    it('should handle mix of copays and coinsurance correctly', () => {
      const userInputs = {
        ...mockUserInputs,
        costs: {
          categoryEstimates: [
            {
              categoryId: 'office_visit_pcp', // Has copay
              inNetwork: {
                quantity: 2,
                costPerVisit: 200,
              },
              outOfNetwork: {
                quantity: 0,
                costPerVisit: 0,
              },
            },
          ],
          otherCosts: {
            inNetwork: {
              quantity: 1, // Uses default coinsurance
              costPerVisit: 400,
            },
            outOfNetwork: {
              quantity: 0,
              costPerVisit: 0,
            },
          },
        },
      };

      const result = calculatePlanCost(mockPPOPlan, mockPlanData, userInputs);

      // 2 copays at $25 each = $50
      // Other cost: $400 goes to deductible (since deductible is $500), no coinsurance
      // Total OOP = $50 (copays) + $400 (deductible) = $450
      expect(result.outOfPocketCosts).toBe(450);
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

  describe('Edge cases and scenarios', () => {
    it('should handle plan with no category-specific benefits', () => {
      const planWithoutCategories = {
        ...mockPPOPlan,
        categories: {},
      };

      const userInputs = {
        ...mockUserInputs,
        costs: {
          categoryEstimates: [
            {
              categoryId: 'unknown_category',
              inNetwork: {
                quantity: 1,
                costPerVisit: 300,
              },
              outOfNetwork: {
                quantity: 0,
                costPerVisit: 0,
              },
            },
          ],
          otherCosts: {
            inNetwork: {
              quantity: 0,
              costPerVisit: 0,
            },
            outOfNetwork: {
              quantity: 0,
              costPerVisit: 0,
            },
          },
        },
      };

      expect(() => {
        calculatePlanCost(planWithoutCategories, mockPlanData, userInputs);
      }).not.toThrow();

      const result = calculatePlanCost(planWithoutCategories, mockPlanData, userInputs);

      // Should use default coinsurance: $300 goes to deductible
      expect(result.outOfPocketCosts).toBe(300);
    });

    it('should handle very large numbers without overflow', () => {
      mockGetMaxFSAContribution.mockReturnValue(3300);

      const userInputs = {
        ...mockUserInputs,
        costs: {
          categoryEstimates: [
            {
              categoryId: 'office_visit_pcp',
              inNetwork: {
                quantity: 1,
                costPerVisit: 999999999,
              },
              outOfNetwork: {
                quantity: 0,
                costPerVisit: 0,
              },
            },
          ],
          otherCosts: {
            inNetwork: {
              quantity: 0,
              costPerVisit: 0,
            },
            outOfNetwork: {
              quantity: 0,
              costPerVisit: 0,
            },
          },
        },
      };

      const result = calculatePlanCost(mockPPOPlan, mockPlanData, userInputs);

      // Should use copay amount since there's a specific copay for office_visit_pcp
      expect(result.outOfPocketCosts).toBe(25);
      expect(Number.isFinite(result.totalCost)).toBe(true);
    });

    it('should handle negative total cost when tax savings exceed costs', () => {
      const userInputs = {
        ...mockUserInputs,
        hsaContribution: 3800,
        taxRate: 40, // High tax rate
        costs: {
          categoryEstimates: [],
          otherCosts: {
            inNetwork: {
              quantity: 0,
              costPerVisit: 0,
            },
            outOfNetwork: {
              quantity: 0,
              costPerVisit: 0,
            },
          },
        },
      };

      mockGetMaxHSAContribution.mockReturnValue(4300);
      mockGetEmployerHSAContribution.mockReturnValue(500);

      const result = calculatePlanCost(mockHSAPlan, mockPlanData, userInputs);

      // Should allow negative total cost when tax savings exceed other costs
      expect(result.totalCost).toBeLessThan(0);
    });
  });
});