import { calculateAllPlans, calculatePlanCost } from '../costCalculator';
import { PlanData, HealthPlan, UserInputs, ContributionType } from '../../types';

import {
  getMaxHSAContribution,
  getMaxFSAContribution,
  getEmployerHSAContribution,
  isHSAQualified,
} from '../../services/planDataService';

// Mock the planDataService
jest.mock('../../services/planDataService', () => ({
  getMaxHSAContribution: jest.fn(),
  getMaxFSAContribution: jest.fn(),
  getEmployerHSAContribution: jest.fn(),
  isHSAQualified: jest.fn(),
}));

const mockGetMaxHSAContribution = getMaxHSAContribution as jest.MockedFunction<
  typeof getMaxHSAContribution
>;
const mockGetMaxFSAContribution = getMaxFSAContribution as jest.MockedFunction<
  typeof getMaxFSAContribution
>;
const mockGetEmployerHSAContribution = getEmployerHSAContribution as jest.MockedFunction<
  typeof getEmployerHSAContribution
>;
const mockIsHSAQualified = isHSAQualified as jest.MockedFunction<typeof isHSAQualified>;

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
    hsa_qualification_limits: {
      minimum_deductible: {
        single: 1650,
        family: 3300,
      },
      maximum_out_of_pocket: {
        single: 8300,
        family: 16600,
      },
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
    prescriptions_subject_to_deductible: true,
    monthly_premiums: {
      single: 150,
      two_party: 300,
      family: 450,
    },
    annual_deductible: {
      in_network: { single: 1650, family: 3300 },
      out_of_network: { single: 3300, family: 6600 },
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
          estimate: {
            quantity: 2,
            costPerVisit: 150,
            isInNetwork: true,
          },
        },
        {
          categoryId: 'other',
          estimate: {
            quantity: 1,
            costPerVisit: 500,
            isInNetwork: true,
          },
        },
      ],
    },
    hsaContribution: 2000,
    fsaContribution: 1500,
  };

  describe('calculatePlanCost', () => {
    beforeEach(() => {
      mockGetMaxHSAContribution.mockReturnValue(4300);
      mockGetMaxFSAContribution.mockReturnValue(3300);
      mockGetEmployerHSAContribution.mockReturnValue(500);
      // Mock isHSAQualified based on the plan being tested
      mockIsHSAQualified.mockImplementation((plan, _planData, _coverage) => {
        // PPO plan has $500 deductible, doesn't qualify
        // HSA plan has $1650 deductible, qualifies
        return plan.annual_deductible.in_network.single >= 1650;
      });
    });

    it('should calculate PPO plan costs correctly with copays', () => {
      const result = calculatePlanCost(mockPPOPlan, mockPlanData, mockUserInputs);

      expect(result.planName).toBe('Test PPO Plan');
      expect(result.contributionType).toBe(ContributionType.FSA);
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
      expect(result.contributionType).toBe(ContributionType.HSA);
      expect(result.annualPremiums).toBe(1800); // 150 * 12
      expect(result.userContribution).toBe(2000); // Employee HSA contribution from input
      expect(result.employerContribution).toBe(500); // Employer HSA contribution
      expect(result.taxSavings).toBe(593); // Employee contribution only: 2000 * (0.22 + 0.0765)

      // Out of pocket for HSA: all costs go against deductible first (no copays in default HSA)
      // 2 visits * $150 + 1 other * $500 = $800 total cost
      // All $800 goes to deductible (since deductible is $1650)
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
            {
              categoryId: 'other', // Uses default coinsurance
              inNetwork: {
                quantity: 1,
                costPerVisit: 400,
              },
              outOfNetwork: {
                quantity: 0,
                costPerVisit: 0,
              },
            },
          ],
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
        },
      };

      mockGetMaxHSAContribution.mockReturnValue(4300);
      mockGetEmployerHSAContribution.mockReturnValue(500);

      const result = calculatePlanCost(mockHSAPlan, mockPlanData, userInputs);

      // Should allow negative total cost when tax savings exceed other costs
      expect(result.totalCost).toBeLessThan(0);
    });
  });

  describe('Ledger functionality', () => {
    beforeEach(() => {
      mockGetMaxFSAContribution.mockReturnValue(3300);
      mockGetMaxHSAContribution.mockReturnValue(4300);
      mockGetEmployerHSAContribution.mockReturnValue(500);
    });

    it('should include ledger in PlanResult', () => {
      const result = calculatePlanCost(mockPPOPlan, mockPlanData, mockUserInputs);

      expect(result.ledger).toBeDefined();
      expect(Array.isArray(result.ledger)).toBe(true);
      expect(result.ledger.length).toBeGreaterThan(0);
    });

    it('should start ledger with initial state entry', () => {
      const result = calculatePlanCost(mockPPOPlan, mockPlanData, mockUserInputs);

      const firstEntry = result.ledger[0];
      expect(firstEntry.description).toBe('Initial state');
      expect(firstEntry.amount).toBe(0);
      expect(firstEntry.deductibleRemaining).toBe(500); // Single deductible
      expect(firstEntry.outOfPocketRemaining).toBe(5000); // Single OOP
    });

    it('should track monthly premiums correctly', () => {
      const result = calculatePlanCost(mockPPOPlan, mockPlanData, mockUserInputs);

      // Should have 12 monthly premium entries
      const premiumEntries = result.ledger.filter(entry =>
        entry.description.startsWith('Monthly premium - Month')
      );
      expect(premiumEntries).toHaveLength(12);

      // Each premium should be negative (cost)
      premiumEntries.forEach((entry, index) => {
        expect(entry.description).toBe(`Monthly premium - Month ${index + 1}`);
        expect(entry.amount).toBe(-200); // Single coverage premium
      });
    });

    it('should track employer HSA contribution for HSA plans', () => {
      const result = calculatePlanCost(mockHSAPlan, mockPlanData, mockUserInputs);

      const employerContribEntry = result.ledger.find(
        entry => entry.description === 'Employer HSA contribution'
      );
      expect(employerContribEntry).toBeDefined();
      expect(employerContribEntry!.amount).toBe(500);
    });

    it('should not track employer contribution for PPO plans', () => {
      const result = calculatePlanCost(mockPPOPlan, mockPlanData, mockUserInputs);

      const employerContribEntry = result.ledger.find(entry =>
        entry.description.includes('Employer HSA contribution')
      );
      expect(employerContribEntry).toBeUndefined();
    });

    it('should track tax savings for FSA plans', () => {
      const result = calculatePlanCost(mockPPOPlan, mockPlanData, mockUserInputs);

      const taxSavingsEntry = result.ledger.find(
        entry => entry.description === 'Tax savings from FSA contributions'
      );
      expect(taxSavingsEntry).toBeDefined();
      expect(taxSavingsEntry!.amount).toBeGreaterThan(0);
    });

    it('should track tax savings for HSA plans', () => {
      const result = calculatePlanCost(mockHSAPlan, mockPlanData, mockUserInputs);

      const taxSavingsEntry = result.ledger.find(
        entry => entry.description === 'Tax savings from HSA contributions'
      );
      expect(taxSavingsEntry).toBeDefined();
      expect(taxSavingsEntry!.amount).toBeGreaterThan(0);
    });

    it('should track service visits with copays correctly', () => {
      const result = calculatePlanCost(mockPPOPlan, mockPlanData, mockUserInputs);

      // Should have entries for office visits (copay)
      const visitEntries = result.ledger.filter(entry =>
        entry.description.includes('service visit (office_visit_pcp)')
      );
      expect(visitEntries.length).toBe(2); // 2 visits in mockUserInputs

      visitEntries.forEach(entry => {
        expect(entry.description).toContain('copay');
        expect(entry.amount).toBe(-25); // Copay amount
      });
    });

    it('should track deductible remaining correctly through visits', () => {
      const userInputsForDeductible = {
        ...mockUserInputs,
        costs: {
          categoryEstimates: [
            {
              categoryId: 'test_category', // Uses default coinsurance, not copay
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
        },
      };

      const result = calculatePlanCost(mockPPOPlan, mockPlanData, userInputsForDeductible);

      // Find the service visit entry
      const visitEntry = result.ledger.find(entry =>
        entry.description.includes('service visit (test_category)')
      );
      expect(visitEntry).toBeDefined();

      // Deductible should be reduced by the visit cost
      expect(visitEntry!.deductibleRemaining).toBe(200); // 500 - 300
    });

    it('should track out-of-pocket remaining correctly', () => {
      const result = calculatePlanCost(mockPPOPlan, mockPlanData, mockUserInputs);

      // Find visit entries and check OOP remaining decreases
      const visitEntries = result.ledger.filter(entry =>
        entry.description.includes('service visit')
      );

      // Verify that visit entries exist and OOP decreases
      expect(visitEntries.length).toBeGreaterThan(0);
      const firstVisit = visitEntries[0];
      expect(firstVisit.outOfPocketRemaining).toBeLessThan(5000);
    });

    it('should track mixed copay and deductible scenarios', () => {
      const mixedUserInputs = {
        ...mockUserInputs,
        costs: {
          categoryEstimates: [
            {
              categoryId: 'office_visit_pcp', // Has copay
              inNetwork: {
                quantity: 1,
                costPerVisit: 200,
              },
              outOfNetwork: {
                quantity: 0,
                costPerVisit: 0,
              },
            },
          ],
        },
      };

      const result = calculatePlanCost(mockPPOPlan, mockPlanData, mixedUserInputs);

      // Should have copay entry
      const copayEntry = result.ledger.find(entry => entry.description.includes('copay'));
      expect(copayEntry).toBeDefined();
      expect(copayEntry!.amount).toBe(-25);

      // Deductible should remain unchanged for copay visits
      expect(copayEntry!.deductibleRemaining).toBe(500);
    });

    it('should track coinsurance visits correctly', () => {
      const coinsuranceUserInputs = {
        ...mockUserInputs,
        costs: {
          categoryEstimates: [
            {
              categoryId: 'test_category', // Uses default coinsurance
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
        },
      };

      const result = calculatePlanCost(mockPPOPlan, mockPlanData, coinsuranceUserInputs);

      const visitEntry = result.ledger.find(entry =>
        entry.description.includes('service visit (test_category)')
      );
      expect(visitEntry).toBeDefined();

      // Should show deductible and coinsurance
      expect(visitEntry!.description).toContain('deductible and coinsurance');

      // Cost should be deductible + coinsurance: $500 + ($500 * 0.2) = $600
      expect(visitEntry!.amount).toBe(-600);
    });

    it('should maintain ledger order correctly', () => {
      const result = calculatePlanCost(mockHSAPlan, mockPlanData, mockUserInputs);

      // Check that entries appear in expected order
      expect(result.ledger[0].description).toBe('Initial state');

      // Monthly premiums should come next
      expect(result.ledger[1].description).toBe('Monthly premium - Month 1');
      expect(result.ledger[12].description).toBe('Monthly premium - Month 12');

      // Employer contribution should come after premiums
      const employerEntry = result.ledger.find(
        entry => entry.description === 'Employer HSA contribution'
      );
      const employerIndex = result.ledger.indexOf(employerEntry!);
      expect(employerIndex).toBeGreaterThan(12);
    });

    it('should handle telemedicine with requires_deductible_to_be_met=false and contributes_to_deductible=false', () => {
      const hsaPlanWithTelemedicine = {
        ...mockHSAPlan,
        categories: {
          telemedicine_pcp: {
            in_network_coverage: {
              coinsurance: 0.2,
              requires_deductible_to_be_met: false,
              contributes_to_deductible: false,
            },
            out_of_network_coverage: { coinsurance: 0.4 },
          },
        },
      };

      const userInputs = {
        ...mockUserInputs,
        costs: {
          categoryEstimates: [
            {
              categoryId: 'telemedicine_pcp',
              estimate: {
                quantity: 1,
                costPerVisit: 100,
                isInNetwork: true,
              },
            },
          ],
        },
      };

      const result = calculatePlanCost(hsaPlanWithTelemedicine, mockPlanData, userInputs);

      // Should apply only coinsurance: $100 * 0.2 = $20
      expect(result.outOfPocketCosts).toBe(20);

      // Deductible should remain at full amount (not reduced)
      const visitEntry = result.ledger.inNetworkExpenses.find(entry =>
        entry.category === 'telemedicine_pcp'
      );
      expect(visitEntry).toBeDefined();
      expect(visitEntry!.deductibleRemaining).toBe(1650); // Full deductible unchanged

      // OOP max should be reduced by the $20 coinsurance
      expect(visitEntry!.outOfPocketRemaining).toBe(5980); // 6000 - 20
    });

    it('should apply deductible for out-of-network telemedicine with default behavior', () => {
      const hsaPlanWithTelemedicine = {
        ...mockHSAPlan,
        categories: {
          telemedicine_pcp: {
            in_network_coverage: {
              coinsurance: 0.2,
              requires_deductible_to_be_met: false,
              contributes_to_deductible: false,
            },
            out_of_network_coverage: { coinsurance: 0.4 }, // Uses defaults
          },
        },
      };

      const userInputs = {
        ...mockUserInputs,
        costs: {
          categoryEstimates: [
            {
              categoryId: 'telemedicine_pcp',
              estimate: {
                quantity: 1,
                costPerVisit: 100,
                isInNetwork: false, // Out of network
              },
            },
          ],
        },
      };

      const result = calculatePlanCost(hsaPlanWithTelemedicine, mockPlanData, userInputs);

      // Should apply deductible first: full $100 goes to deductible
      expect(result.outOfPocketCosts).toBe(100);

      // Deductible should be reduced (out-of-network single deductible is 3300)
      const visitEntry = result.ledger.outOfNetworkExpenses.find(entry =>
        entry.category === 'telemedicine_pcp'
      );
      expect(visitEntry).toBeDefined();
      expect(visitEntry!.deductibleRemaining).toBe(1550); // In-network deductible: 1650 - 100
    });

    it('should handle multiple telemedicine visits that dont contribute to deductible', () => {
      const hsaPlanWithTelemedicine = {
        ...mockHSAPlan,
        categories: {
          telemedicine_pcp: {
            in_network_coverage: {
              coinsurance: 0.4,
              requires_deductible_to_be_met: false,
              contributes_to_deductible: false,
            },
          },
        },
      };

      const userInputs = {
        ...mockUserInputs,
        costs: {
          categoryEstimates: [
            {
              categoryId: 'telemedicine_pcp',
              estimate: {
                quantity: 3,
                costPerVisit: 150,
                isInNetwork: true,
              },
            },
          ],
        },
      };

      const result = calculatePlanCost(hsaPlanWithTelemedicine, mockPlanData, userInputs);

      // Each visit: $150 * 0.4 = $60, total: $60 * 3 = $180
      expect(result.outOfPocketCosts).toBe(180);

      // Deductible should remain unchanged across all visits
      const allTeleVisits = result.ledger.inNetworkExpenses.filter(entry =>
        entry.category === 'telemedicine_pcp'
      );
      expect(allTeleVisits).toHaveLength(3);
      allTeleVisits.forEach((entry, index) => {
        expect(entry.deductibleRemaining).toBe(1650); // Deductible never touched
        // OOP should decrease with each visit
        expect(entry.outOfPocketRemaining).toBe(6000 - (60 * (index + 1)));
      });
    });

    it('should handle mixed regular and no-deductible-contribution visits correctly', () => {
      const hsaPlanWithMixedServices = {
        ...mockHSAPlan,
        categories: {
          telemedicine_pcp: {
            in_network_coverage: {
              coinsurance: 0.2,
              requires_deductible_to_be_met: false,
              contributes_to_deductible: false,
            },
          },
          office_visit_pcp: {
            in_network_coverage: { coinsurance: 0.2 }, // Uses defaults (requires & contributes to deductible)
          },
        },
      };

      const userInputs = {
        ...mockUserInputs,
        costs: {
          categoryEstimates: [
            {
              categoryId: 'telemedicine_pcp',
              estimate: {
                quantity: 1,
                costPerVisit: 100,
                isInNetwork: true,
              },
            },
            {
              categoryId: 'office_visit_pcp',
              estimate: {
                quantity: 1,
                costPerVisit: 200,
                isInNetwork: true,
              },
            },
          ],
        },
      };

      const result = calculatePlanCost(hsaPlanWithMixedServices, mockPlanData, userInputs);

      // Telemedicine: $100 * 0.2 = $20 (doesn't require/contribute to deductible)
      // Office visit: $200 goes to deductible
      // Total OOP: $20 + $200 = $220
      expect(result.outOfPocketCosts).toBe(220);

      // Check telemedicine visit didn't touch deductible
      const teleVisit = result.ledger.inNetworkExpenses.find(
        entry => entry.category === 'telemedicine_pcp'
      );
      expect(teleVisit!.deductibleRemaining).toBe(1650);
      expect(teleVisit!.outOfPocketRemaining).toBe(5980); // 6000 - 20

      // Check office visit reduced deductible
      const officeVisit = result.ledger.inNetworkExpenses.find(
        entry => entry.category === 'office_visit_pcp'
      );
      expect(officeVisit!.deductibleRemaining).toBe(1450); // 1650 - 200
      expect(officeVisit!.outOfPocketRemaining).toBe(5780); // 5980 - 200
    });

    it('should handle zero-cost scenarios in ledger', () => {
      const zeroCostInputs = {
        ...mockUserInputs,
        costs: {
          categoryEstimates: [],
        },
        hsaContribution: 0,
        fsaContribution: 0,
      };

      const result = calculatePlanCost(mockPPOPlan, mockPlanData, zeroCostInputs);

      // Should still have initial state + premiums
      expect(result.ledger.length).toBeGreaterThanOrEqual(13); // Initial + 12 premiums

      // Should not have service visit entries
      const visitEntries = result.ledger.filter(entry =>
        entry.description.includes('service visit')
      );
      expect(visitEntries).toHaveLength(0);
    });
  });
});
