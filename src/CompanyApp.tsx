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
import GuidedSetup from './components/guided/GuidedSetup';
import PrivacyNote from './components/PrivacyNote';
import { loadPlanData, getDefaultYear, getAvailableDataYears } from './services/planDataService';
import { calculateAllPlans } from './utils/costCalculator';
import {
  readURLParamsOnLoad,
  updateURL,
  copyURLToClipboard,
  isResultsPath,
} from './utils/urlParams';
import {
  clearGuided,
  loadGuidedInputs,
  readGuidedStepFromPath,
  saveGuidedInputs,
} from './utils/guidedStorage';
import { PlanData, UserInputs, PlanResult, CoverageType, Company } from './types';

interface CompanyAppProps {
  company: Company;
}

const defaultInputs = (slug: string): UserInputs => ({
  year: getDefaultYear(slug),
  coverage: CoverageType.Family,
  ageGroup: 'under_55',
  taxRate: 26.45, // 22% federal + 4.45% Utah (2026)
  costs: {
    categoryEstimates: [],
  },
  hsaContribution: 0,
  fsaContribution: 0,
});

/** First-time visitors (no inputs in the URL) and guided step links get the guided setup. */
const isGuidedURL = () =>
  !isResultsPath() && (window.location.search === '' || readGuidedStepFromPath() !== null);

function CompanyApp({ company }: CompanyAppProps) {
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [userInputs, setUserInputs] = useState<UserInputs>(() => {
    const defaults = defaultInputs(company.slug);
    const saved = isGuidedURL() ? loadGuidedInputs(company.slug) : null;
    if (!saved || !getAvailableDataYears(company.slug).includes(saved.year)) return defaults;
    return { ...defaults, ...saved };
  });
  const [results, setResults] = useState<PlanResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [resultsOutOfDate, setResultsOutOfDate] = useState(false);
  const [hasCalculatedOnce, setHasCalculatedOnce] = useState(false);
  const [showShareToast, setShowShareToast] = useState(false);
  const [shareToastMessage, setShareToastMessage] = useState('');
  // A results link opens with the comparison already run
  const [shouldAutoShowResults, setShouldAutoShowResults] = useState(isResultsPath);
  // Form sections start closed under results, open for someone who skipped straight to the form
  const [sectionsOpen, setSectionsOpen] = useState(() => !isResultsPath());
  const [isGuided, setIsGuided] = useState(isGuidedURL);
  const [compareRequested, setCompareRequested] = useState(false);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const faqButtonRef = useRef<FAQButtonRef | null>(null);

  // Read URL parameters on component mount
  useEffect(() => {
    const urlParams = readURLParamsOnLoad(getAvailableDataYears(company.slug));
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

    setIsInitialized(true);
  }, [company.slug]);

  // Load plan data on component mount and when year changes
  useEffect(() => {
    try {
      setError(null);
      const data = loadPlanData(company.slug, userInputs.year);
      setPlanData(data);
    } catch (err) {
      setError(`Failed to load plan data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [company.slug, userInputs.year]);

  useEffect(() => {
    document.title = `${company.name} Health Plan Comparison Tool`;
  }, [company.name]);

  // Mark results as out of date when inputs change (after first calculation)
  useEffect(() => {
    if (hasCalculatedOnce && isInitialized) {
      setResultsOutOfDate(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInputs, isInitialized]); // Don't include hasCalculatedOnce to avoid marking as out-of-date immediately after calculation

  // Save guided answers in this browser so the person can pick up where they left off
  useEffect(() => {
    if (isGuided) saveGuidedInputs(company.slug, userInputs);
  }, [isGuided, company.slug, userInputs]);

  // Browser back and forward move between guided steps and the form
  useEffect(() => {
    const onPopState = () => setIsGuided(isGuidedURL());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleInputChange = (newInputs: Partial<UserInputs>) => {
    setUserInputs(prev => ({ ...prev, ...newInputs }));
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

  // Auto-show results on a results link
  useEffect(() => {
    if (shouldAutoShowResults && planData && isInitialized && !hasCalculatedOnce) {
      handleComparePlans();
      setShouldAutoShowResults(false); // Reset flag after triggering
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoShowResults, planData, isInitialized, hasCalculatedOnce]);

  // Finishing the guided setup compares once its last input change has landed in state
  useEffect(() => {
    if (compareRequested && planData) {
      handleComparePlans();
      setCompareRequested(false);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareRequested, planData, userInputs]);

  const leaveGuided = () => {
    window.history.pushState({}, '', `/${company.slug}`);
    setIsGuided(false);
  };

  const handleSkipGuided = () => {
    setSectionsOpen(true);
    leaveGuided();
  };

  const handleFinishGuided = () => {
    setSectionsOpen(false);
    leaveGuided();
    setCompareRequested(true);
  };

  return (
    <div className="d-flex flex-column min-vh-100">
      <Container className="mt-4 flex-grow-1">
        <Row>
          <Col>
            <NavigationHeader company={company} onFAQRef={ref => (faqButtonRef.current = ref)} />

            {isGuided && (
              <GuidedSetup
                company={company}
                planData={planData}
                inputs={userInputs}
                onChange={handleInputChange}
                onFinish={handleFinishGuided}
                onSkip={handleSkipGuided}
                onStartOver={() => {
                  clearGuided(company.slug);
                  setUserInputs(defaultInputs(company.slug));
                }}
              />
            )}

            {error && (
              <Alert variant="danger" className="mb-4">
                {error}
              </Alert>
            )}

            {!isGuided && (
              <CostInputForm
                inputs={userInputs}
                onChange={handleInputChange}
                planData={planData}
                company={company}
                defaultOpen={sectionsOpen}
              />
            )}

            <div className={isGuided ? 'd-none' : 'mt-4'}>
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
              <div
                ref={resultsRef}
                className="mt-4"
                style={{ opacity: resultsOutOfDate ? 0.5 : 1 }}
              >
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
                    <strong>💰 Great news!</strong> You could save{' '}
                    {(() => {
                      const low = Math.round(results[1].totalCost - results[0].totalCost);
                      const high = Math.round(
                        results[results.length - 1].totalCost - results[0].totalCost
                      );
                      return (
                        <strong>
                          {low === high
                            ? `$${low.toLocaleString()}`
                            : `between $${low.toLocaleString()} and $${high.toLocaleString()}`}
                        </strong>
                      );
                    })()}{' '}
                    this year by choosing {results[0].planName} instead of{' '}
                    {results.length === 2 ? results[1].planName : 'another plan'}.
                  </Alert>
                )}
                {planData && (
                  <ResultsTable
                    results={results}
                    onShowWork={handleShowWork}
                    planData={planData}
                    userInputs={userInputs}
                  />
                )}
                {planData && <CostComparisonChart planData={planData} userInputs={userInputs} />}
              </div>
            )}
          </Col>
        </Row>
      </Container>

      <footer className="mt-auto py-4 border-top text-center text-muted bg-light">
        <Container>
          <PrivacyNote className="justify-content-center mb-2" />
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
            , {new Date().getFullYear()} •{' '}
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

export default CompanyApp;
