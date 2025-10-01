import { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Alert, Button, Toast, ToastContainer } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowDown, faShare } from '@fortawesome/free-solid-svg-icons';
import { faGithub } from '@fortawesome/free-brands-svg-icons';

import CostInputForm from './components/CostInputForm';
import ResultsTable from './components/ResultsTable';
import CostComparisonChart from './components/CostComparisonChart';
import NavigationHeader from './components/NavigationHeader';
import { FAQButtonRef } from './components/FAQButton';
import { loadPlanData, getDefaultYear } from './services/planDataService';
import { calculateAllPlans } from './utils/costCalculator';
import { readURLParamsOnLoad, updateURL, copyURLToClipboard } from './utils/urlParams';
import { PlanData, UserInputs, PlanResult, CoverageType } from './types';

function App() {
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [userInputs, setUserInputs] = useState<UserInputs>({
    year: getDefaultYear(),
    coverage: CoverageType.Family,
    ageGroup: 'under_55',
    taxRate: 21.7,
    costs: {
      categoryEstimates: [],
    },
    hsaContribution: 0,
    fsaContribution: 0,
  });
  const [results, setResults] = useState<PlanResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [resultsOutOfDate, setResultsOutOfDate] = useState(false);
  const [hasCalculatedOnce, setHasCalculatedOnce] = useState(false);
  const [isHelpTextDismissed, setIsHelpTextDismissed] = useState(() => {
    // Initialize from localStorage to prevent flicker
    const dismissed = localStorage.getItem('helpTextDismissed');
    return dismissed === 'true';
  });
  const [showShareToast, setShowShareToast] = useState(false);
  const [shareToastMessage, setShareToastMessage] = useState('');
  const [shouldAutoShowResults, setShouldAutoShowResults] = useState(false);
  const faqButtonRef = useRef<FAQButtonRef | null>(null);

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
        if (urlParams.hsaContribution !== undefined)
          merged.hsaContribution = urlParams.hsaContribution;
        if (urlParams.fsaContribution !== undefined)
          merged.fsaContribution = urlParams.fsaContribution;

        // Handle nested costs object properly
        if (urlParams.costs) {
          merged.costs = { ...prev.costs, ...urlParams.costs };
        }

        return merged;
      });
    }

    // Check if we should auto-show results
    if (urlParams.showResults) {
      setShouldAutoShowResults(true);
    }

    setIsInitialized(true);
  }, []);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInputs, isInitialized]); // Don't include hasCalculatedOnce to avoid marking as out-of-date immediately after calculation

  const handleInputChange = (newInputs: Partial<UserInputs>) => {
    setUserInputs(prev => ({ ...prev, ...newInputs }));
  };

  const handleDismissHelpText = () => {
    setIsHelpTextDismissed(true);
    localStorage.setItem('helpTextDismissed', 'true');
  };

  const handleShare = async () => {
    const success = await copyURLToClipboard(userInputs);
    if (success) {
      setShareToastMessage('URL copied to clipboard! Share this link with others.');
    } else {
      setShareToastMessage('Failed to copy URL. Please try again.');
    }
    setShowShareToast(true);
  };

  const handleShowWork = (result: PlanResult) => {
    if (faqButtonRef.current) {
      faqButtonRef.current.openLedger(result.planName, result.ledger);
    }
  };

  const handleComparePlans = () => {
    if (planData && userInputs) {
      try {
        setError(null);
        // Update URL with current inputs
        updateURL(userInputs);
        const calculatedResults = calculateAllPlans(planData, userInputs);
        setResults(calculatedResults);
        setResultsOutOfDate(false);
        setHasCalculatedOnce(true);
      } catch (err) {
        setError(`Calculation error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  };

  // Auto-show results when URL contains showResults=true
  useEffect(() => {
    if (shouldAutoShowResults && planData && isInitialized && !hasCalculatedOnce) {
      handleComparePlans();
      setShouldAutoShowResults(false); // Reset flag after triggering
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoShowResults, planData, isInitialized, hasCalculatedOnce]);

  return (
    <div className="d-flex flex-column min-vh-100">
      <Container className="mt-4 flex-grow-1">
        <Row>
          <Col>
            <NavigationHeader onFAQRef={ref => (faqButtonRef.current = ref)} />

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
                  <strong>Welcome to open enrollment!</strong> Finding the perfect health plan
                  doesn't have to be overwhelming. This tool makes it easy to compare all your DMBA
                  health plan options and see which one could save you the most money. Just enter
                  your expected healthcare costs, and we'll crunch the numbers for you - including
                  premiums, deductibles, tax savings, and employer contributions. Let's find your
                  perfect plan!
                </p>
              </div>
            )}

            {error && (
              <Alert variant="danger" className="mb-4">
                {error}
              </Alert>
            )}

            <CostInputForm inputs={userInputs} onChange={handleInputChange} planData={planData} />

            <div className="mt-4">
              <Button
                variant="success"
                size="lg"
                onClick={handleComparePlans}
                disabled={!planData}
                className="w-100 mb-3"
              >
                Compare <FontAwesomeIcon icon={faArrowDown} />
              </Button>
              {resultsOutOfDate && hasCalculatedOnce && (
                <div className="text-center">
                  <span className="text-warning">
                    ⚠️ Results are out of date. Click the Compare button to recalculate
                  </span>
                </div>
              )}
            </div>

            {results.length > 0 && (
              <div className="mt-4" style={{ opacity: resultsOutOfDate ? 0.5 : 1 }}>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h2 className="mb-0">Plan Comparison Results</h2>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={handleShare}
                    className="d-flex align-items-center gap-2"
                  >
                    <FontAwesomeIcon icon={faShare} />
                    Share Results
                  </Button>
                </div>
                {results.length > 1 && (
                  <Alert variant="success" className="mb-3">
                    <strong>💰 Great news!</strong> You could save at least{' '}
                    <strong>
                      ${Math.round(results[1].totalCost - results[0].totalCost).toLocaleString()}
                    </strong>{' '}
                    this year by choosing {results[0].planName}.
                  </Alert>
                )}
                <ResultsTable results={results} onShowWork={handleShowWork} />
                {planData && <CostComparisonChart planData={planData} userInputs={userInputs} />}
              </div>
            )}
          </Col>
        </Row>
      </Container>

      <footer className="mt-auto py-4 border-top text-center text-muted bg-light">
        <Container>
          <p className="mb-1">
            Made with ❤️ by{' '}
            <a
              href="https://watkins.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-decoration-none"
            >
              Matthew Watkins
            </a>
            , 2025 •{' '}
            <a
              href="https://github.com/matthewpwatkins/insurance-plan-comparison-tool"
              target="_blank"
              rel="noopener noreferrer"
              className="text-decoration-none"
            >
              <FontAwesomeIcon icon={faGithub} className="me-1" />
              Source
            </a>
          </p>
        </Container>
      </footer>

      {/* Toast for Share Feedback */}
      <ToastContainer
        position="top-end"
        className="position-fixed"
        style={{ top: '20px', right: '20px', zIndex: 9999 }}
      >
        <Toast
          show={showShareToast}
          onClose={() => setShowShareToast(false)}
          delay={3000}
          autohide
          bg="success"
        >
          <Toast.Body className="text-white">{shareToastMessage}</Toast.Body>
        </Toast>
      </ToastContainer>
    </div>
  );
}

export default App;
