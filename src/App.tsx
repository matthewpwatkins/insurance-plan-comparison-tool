import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Alert } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

import CostInputForm from './components/CostInputForm';
import ResultsTable from './components/ResultsTable';
import ShareButton from './components/ShareButton';
import { loadPlanData, getDefaultYear } from './services/planDataService';
import { calculateAllPlans } from './utils/costCalculator';
import { readURLParamsOnLoad, updateURL } from './utils/urlParams';
import { PlanData, UserInputs, PartialUserInputs, PlanResult } from './types';

function App() {
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [userInputs, setUserInputs] = useState<UserInputs>({
    year: getDefaultYear(),
    coverage: 'family',
    ageGroup: 'under_55',
    taxRate: 24,
    costInputMode: 'simple',
    costs: {
      totalAnnualCosts: 2000,
      networkMix: 'in_network',
      categoryEstimates: [],
      otherCosts: {
        inNetworkCost: 2000,
        outOfNetworkCost: 0
      }
    },
    hsaContribution: 0,
    fsaContribution: 0
  });
  const [results, setResults] = useState<PlanResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Read URL parameters on component mount
  useEffect(() => {
    const urlParams = readURLParamsOnLoad();
    if (Object.keys(urlParams).length > 0) {
      setUserInputs(prev => {
        const merged: UserInputs = { ...prev };

        // Update non-costs fields
        if (urlParams.year !== undefined) merged.year = urlParams.year;
        if (urlParams.coverage !== undefined) merged.coverage = urlParams.coverage;
        if (urlParams.ageGroup !== undefined) merged.ageGroup = urlParams.ageGroup;
        if (urlParams.taxRate !== undefined) merged.taxRate = urlParams.taxRate;
        if (urlParams.hsaContribution !== undefined) merged.hsaContribution = urlParams.hsaContribution;
        if (urlParams.fsaContribution !== undefined) merged.fsaContribution = urlParams.fsaContribution;

        // Handle nested costs object properly
        if (urlParams.costs) {
          merged.costs = { ...prev.costs, ...urlParams.costs };
        }

        return merged;
      });
    }
    setIsInitialized(true);
  }, []);

  // Update URL whenever user inputs change (after initialization)
  useEffect(() => {
    if (isInitialized) {
      updateURL(userInputs);
    }
  }, [userInputs, isInitialized]);

  // Load plan data on component mount and when year changes
  useEffect(() => {
    try {
      setError(null);
      const data = loadPlanData(userInputs.year);
      setPlanData(data);
    } catch (err) {
      setError(`Failed to load plan data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [userInputs.year]);

  // Recalculate results when inputs or plan data change
  useEffect(() => {
    if (planData && userInputs) {
      try {
        const calculatedResults = calculateAllPlans(planData, userInputs);
        setResults(calculatedResults);
      } catch (err) {
        setError(`Calculation error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  }, [planData, userInputs]);

  const handleInputChange = (newInputs: Partial<UserInputs>) => {
    setUserInputs(prev => ({ ...prev, ...newInputs }));
  };

  return (
    <Container className="mt-4">
      <Row>
        <Col>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h1 className="mb-0">Health Insurance Plan Comparison Tool</h1>
            <ShareButton userInputs={userInputs} />
          </div>

          {error && (
            <Alert variant="danger" className="mb-4">
              {error}
            </Alert>
          )}

          <CostInputForm
            inputs={userInputs}
            onChange={handleInputChange}
            planData={planData}
          />

          {results.length > 0 && (
            <div className="mt-4">
              <h2>Plan Comparison Results</h2>
              <ResultsTable results={results} />
            </div>
          )}
        </Col>
      </Row>
    </Container>
  );
}

export default App;