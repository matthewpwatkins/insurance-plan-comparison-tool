import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Alert, Button } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';

import CostInputForm from './components/CostInputForm';
import ResultsTable from './components/ResultsTable';
import NavigationHeader from './components/NavigationHeader';
import { FAQButtonRef } from './components/FAQButton';
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
  const [faqRef, setFaqRef] = useState<FAQButtonRef | null>(null);
  const [isHelpTextDismissed, setIsHelpTextDismissed] = useState(false);

  // Load help text dismissed state from localStorage
  useEffect(() => {
    const dismissed = localStorage.getItem('helpTextDismissed');
    if (dismissed === 'true') {
      setIsHelpTextDismissed(true);
    }
  }, []);

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
  }, [userInputs, isInitialized]);

  const handleInputChange = (newInputs: Partial<UserInputs>) => {
    setUserInputs(prev => ({ ...prev, ...newInputs }));
  };

  const handleDismissHelpText = () => {
    setIsHelpTextDismissed(true);
    localStorage.setItem('helpTextDismissed', 'true');
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
    <div className="d-flex flex-column min-vh-100">
      <Container className="mt-4 flex-grow-1">
      <Row>
        <Col>
          <NavigationHeader userInputs={userInputs} onFAQRef={setFaqRef} />

          {!isHelpTextDismissed && (
            <div className="mb-4 p-3 bg-light rounded position-relative">
              <Button
                variant="outline-secondary"
                size="sm"
                className="position-absolute top-0 end-0 mt-2 me-2"
                onClick={handleDismissHelpText}
                style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
              >
                ×
              </Button>
              <p className="mb-0 text-muted pe-5">
                <strong>Welcome to open enrollment!</strong> Finding the perfect health plan doesn't have to be overwhelming.
                This tool makes it easy to compare all your DMBA health plan options and see which one could save you the most money.
                Just enter your expected healthcare costs, and we'll crunch the numbers for you - including premiums, deductibles,
                tax savings, and employer contributions. Let's find your perfect plan!
              </p>
            </div>
          )}

          {error && (
            <Alert variant="danger" className="mb-4">
              {error}
            </Alert>
          )}

          <CostInputForm
            inputs={userInputs}
            onChange={handleInputChange}
            planData={planData}
            faqRef={faqRef}
          />

          <div className="mt-4">
            <Button
              variant="success"
              size="lg"
              onClick={handleComparePlans}
              disabled={!planData}
              className="w-100 mb-3"
            >
              Compare Plans <FontAwesomeIcon icon={faArrowRight} />
            </Button>
            {resultsOutOfDate && hasCalculatedOnce && (
              <div className="text-center">
                <span className="text-warning">
                  ⚠️ Results out of date
                </span>
              </div>
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

      <footer className="mt-auto py-4 border-top text-center text-muted bg-light">
        <Container>
          <p className="mb-0">
            Made with ❤️ by{' '}
            <a
              href="https://watkins.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-decoration-none"
            >
              Matthew Watkins
            </a>
            , 2025.
          </p>
        </Container>
      </footer>
    </div>
  );
}

export default App;