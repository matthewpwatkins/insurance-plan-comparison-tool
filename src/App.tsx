import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Alert, Button } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

import CostInputForm from './components/CostInputForm';
import ResultsTable from './components/ResultsTable';
import ShareButton from './components/ShareButton';
import FAQButton from './components/FAQButton';
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
    costs: {
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
  const [resultsOutOfDate, setResultsOutOfDate] = useState(false);
  const [hasCalculatedOnce, setHasCalculatedOnce] = useState(false);

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

  // Mark results as out of date when inputs change (after first calculation)
  useEffect(() => {
    if (hasCalculatedOnce && isInitialized) {
      setResultsOutOfDate(true);
    }
  }, [userInputs, hasCalculatedOnce, isInitialized]);

  const handleInputChange = (newInputs: Partial<UserInputs>) => {
    setUserInputs(prev => ({ ...prev, ...newInputs }));
  };

  const handleComparePlans = () => {
    if (planData && userInputs) {
      try {
        setError(null);
        const calculatedResults = calculateAllPlans(planData, userInputs);
        setResults(calculatedResults);
        setResultsOutOfDate(false);
        setHasCalculatedOnce(true);
      } catch (err) {
        setError(`Calculation error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  };

  return (
    <Container className="mt-4 mb-5">
      <Row>
        <Col>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h1 className="mb-0">DMBA Health Plan Comparison Tool</h1>
            <div>
              <FAQButton />
              <ShareButton userInputs={userInputs} />
            </div>
          </div>

          <div className="mb-4 p-3 bg-light rounded">
            <p className="mb-0 text-muted">
              🎉 <strong>Welcome to open enrollment!</strong> Finding the perfect health plan doesn't have to be overwhelming.
              This tool makes it easy to compare all your DMBA health plan options and see which one could save you the most money.
              Just enter your expected healthcare costs, and we'll crunch the numbers for you - including premiums, deductibles,
              tax savings, and employer contributions. Let's find your perfect plan! 💪
            </p>
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

          <div className="mt-4 d-flex align-items-center gap-3">
            <Button
              variant="success"
              size="lg"
              onClick={handleComparePlans}
              disabled={!planData}
            >
              📊 Compare Plans
            </Button>
            {resultsOutOfDate && hasCalculatedOnce && (
              <span className="text-warning">
                ⚠️ Results out of date
              </span>
            )}
          </div>

          {results.length > 0 && (
            <div className="mt-4" style={{ opacity: resultsOutOfDate ? 0.5 : 1 }}>
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