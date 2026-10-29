import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  InputGroup,
  Modal,
  ProgressBar,
  Row,
  Table,
} from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faArrowRight,
  faArrowUpRightFromSquare,
} from '@fortawesome/free-solid-svg-icons';
import { ELIGIBLE_OTHER_ID } from '../HealthcareCategoriesSection';
import PeopleList from '../PeopleList';
import { coverageFor, peopleCount } from '../../utils/people';
import { isCoveredByInsurance } from '../../utils/costCalculator';
import FormattedNumberInput from '../FormattedNumberInput';
import MedicareNote from '../MedicareNote';
import PrivacyNote from '../PrivacyNote';
import TaxRateGuide from '../TaxRateGuide';
import {
  claimsPeriod as describePeriod,
  ClaimsDraft,
  ClaimsReview,
  LoadedClaims,
} from '../ClaimsReportImporter';
import {
  guidedStepPath,
  loadGuidedProgress,
  readGuidedStepFromPath,
  saveGuidedProgress,
} from '../../utils/guidedStorage';
import { isResultsPath } from '../../utils/urlParams';
import { EditStep, EstimateChoice, EstimateChoiceStep, ImportStep, skipLabel } from './CostStep';
import {
  getAvailableDataYears,
  getEmployerHSAContribution,
  getMaxFSAContribution,
  getMaxHSAContribution,
  HSA_VIDEO_URL,
  isHSAQualified,
} from '../../services/planDataService';
import { formatCurrency } from '../../utils/formatters';
import { CategoryEstimate, Company, PlanData, UserInputs } from '../../types';

type StepId =
  | 'welcome'
  | 'year'
  | 'coverage'
  | 'age'
  | 'tax'
  | 'accounts'
  | 'estimate'
  | 'import'
  | 'review'
  | 'edit';

interface GuidedSetupProps {
  company: Company;
  planData: PlanData | null;
  inputs: UserInputs;
  onChange: (updates: Partial<UserInputs>) => void;
  onFinish: () => void;
  onSkip: () => void;
  /** Forgets saved answers and goes back to the defaults */
  onStartOver: () => void;
}

/** Dollar amount with a matching slider, from 0 to the contribution limit. */
const ContributionInput: React.FC<{
  label: string;
  value: number;
  max: number;
  autoFocus?: boolean;
  onChange: (value: number) => void;
}> = ({ label, value, max, autoFocus, onChange }) => (
  <div>
    <InputGroup size="lg" className="mb-3" style={{ maxWidth: '16rem' }}>
      <InputGroup.Text>$</InputGroup.Text>
      <FormattedNumberInput
        aria-label={label}
        value={value}
        onChange={onChange}
        min={0}
        max={max}
        step={100}
        autoFocus={autoFocus}
      />
    </InputGroup>
    <Form.Range
      min={0}
      max={max}
      step={50}
      value={Math.min(value, max)}
      onChange={e => onChange(Number(e.target.value))}
      aria-label={label}
    />
    <div className="d-flex justify-content-between small text-muted">
      <span>$0</span>
      <span>Max {formatCurrency(max)}</span>
    </div>
  </div>
);

/** Starting guess for a year's over-the-counter medicine and supplies, per person */
const OTHER_COSTS_PER_PERSON = 50;

/** A picture of the household for the who's-covered callout, following the number of people */
const householdEmoji = (count: number): string =>
  count <= 1 ? '🧑' : count === 2 ? '👫' : count === 3 ? '👨‍👩‍👧' : '👨‍👩‍👧‍👦';

const GuidedSetup: React.FC<GuidedSetupProps> = ({
  company,
  planData,
  inputs,
  onChange,
  onFinish,
  onSkip,
  onStartOver,
}) => {
  const [saved, setSaved] = useState(() => loadGuidedProgress(company.slug));
  const [step, setStep] = useState<StepId>(
    () => (readGuidedStepFromPath() as StepId | null) ?? 'welcome'
  );
  const [estimateChoice, setEstimateChoice] = useState<EstimateChoice | null>(
    // Starting from claims is the recommended way, so it starts chosen
    (saved?.estimateChoice as EstimateChoice | null) ?? 'estimate'
  );
  const [claimsPeriod, setClaimsPeriod] = useState<string | undefined>(saved?.claimsPeriod);
  const [claims, setClaims] = useState<LoadedClaims | null>(null);
  const [claimsDraft, setClaimsDraft] = useState<ClaimsDraft | null>(null);
  const [showOtherCostsReminder, setShowOtherCostsReminder] = useState(false);
  // Whether the people list was filled in from imported estimates
  const [fromClaims, setFromClaims] = useState(false);
  // The row the reminder added, pointed out on the expense screen
  const [addedRow, setAddedRow] = useState<number | undefined>(undefined);
  const [otherCostsReminded, setOtherCostsReminded] = useState(false);
  const hasOtherCosts = inputs.costs.categoryEstimates.some(
    estimate => planData && !isCoveredByInsurance(planData.categories, estimate.categoryId)
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  // Each step has its own URL, so browser back and forward move between steps
  const goTo = (next: StepId) => {
    window.history.pushState({}, '', guidedStepPath(company.slug, next));
    setStep(next);
  };
  useEffect(() => {
    const onPopState = () => {
      const fromPath = readGuidedStepFromPath() as StepId | null;
      if (fromPath || !isResultsPath()) setStep(fromPath ?? 'welcome');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const years = getAvailableDataYears(company.slug);
  const hsaPlans = planData?.plans.filter(p => isHSAQualified(p, planData, inputs.coverage)) ?? [];
  const fsaPlans = planData?.plans.filter(p => !isHSAQualified(p, planData, inputs.coverage)) ?? [];
  const maxHSA = planData ? getMaxHSAContribution(planData, inputs.coverage, inputs.ageGroup) : 0;
  const employerHSA = hsaPlans.map(plan => getEmployerHSAContribution(plan, inputs.coverage));
  const maxEmployerHSA = Math.max(0, ...employerHSA);
  const maxEmployeeHSA = Math.max(0, ...employerHSA.map(employer => maxHSA - employer));
  const maxFSA = planData ? getMaxFSAContribution(planData) : 0;

  // Contributions start at the max and follow it (coverage and age change it) until edited.
  // Watching the amount too means a reset to $0, like starting over, snaps back to the max.
  const hsaTouched = useRef(saved?.hsaTouched ?? false);
  const fsaTouched = useRef(saved?.fsaTouched ?? false);
  useEffect(() => {
    if (!hsaTouched.current && inputs.hsaContribution !== maxEmployeeHSA) {
      onChange({ hsaContribution: maxEmployeeHSA });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxEmployeeHSA, inputs.hsaContribution]);
  useEffect(() => {
    if (!fsaTouched.current && inputs.fsaContribution !== maxFSA) {
      onChange({ fsaContribution: maxFSA });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxFSA, inputs.fsaContribution]);

  const steps: StepId[] = [
    'welcome',
    ...(years.length > 1 ? (['year'] as StepId[]) : []),
    'estimate',
    // Claims come before who's covered, so the people in them fill in the list. Before a
    // choice, count the longest path, through the claims import.
    ...(estimateChoice === 'estimate' || estimateChoice === null
      ? (['import', ...(claims ? ['review'] : [])] as StepId[])
      : []),
    // Who's covered sets the HSA and FSA limits, so it comes before them
    'coverage',
    ...(hsaPlans.length > 0 ? (['age'] as StepId[]) : []),
    'tax',
    'accounts',
    ...(estimateChoice !== 'preventive' ? (['edit'] as StepId[]) : []),
  ];
  const index = Math.max(0, steps.indexOf(step));
  const applies = steps.includes(step);

  // A step that no longer applies, like reviewing a report that wasn't kept, falls back a step
  useEffect(() => {
    if (planData && !applies) {
      const fallback = step === 'review' ? 'import' : 'welcome';
      window.history.replaceState({}, '', guidedStepPath(company.slug, fallback));
      setStep(fallback);
    }
  }, [planData, applies, step, company.slug]);

  // Save progress so the person can pick up where they left off
  useEffect(() => {
    if (step === 'welcome') return;
    saveGuidedProgress(company.slug, {
      step,
      estimateChoice,
      claimsPeriod,
      hsaTouched: hsaTouched.current,
      fsaTouched: fsaTouched.current,
    });
  });
  const isLast = index === steps.length - 1;

  const next = () => {
    if (isLast) {
      if (estimateChoice === 'preventive') {
        onChange({ costs: { ...inputs.costs, categoryEstimates: [] } });
      } else if (step === 'edit' && !hasOtherCosts && !otherCostsReminded) {
        // Once, before results: costs insurance won't pay for are easy to forget
        setOtherCostsReminded(true);
        setShowOtherCostsReminder(true);
        return;
      }
      onFinish();
    } else {
      goTo(steps[index + 1]);
    }
  };
  const back = () => goTo(steps[Math.max(0, index - 1)]);

  const loadClaims = (loaded: LoadedClaims) => {
    setClaims(loaded);
    goTo('review');
  };

  /**
   * Takes imported estimates, and the people in them, and moves on to who's covered. Claims
   * suggest names; an AI estimates file only numbers people.
   */
  const applyImported = (estimates: CategoryEstimate[], period?: string, people?: string[]) => {
    const used = Math.max(0, ...estimates.map(estimate => estimate.person ?? 0));
    const names = people ?? Array.from({ length: used }, () => '');
    onChange({
      costs: { ...inputs.costs, categoryEstimates: estimates },
      ...(names.length > 0 ? { peopleNames: names, coverage: coverageFor(names.length) } : {}),
    });
    setClaimsPeriod(period);
    setFromClaims(names.length > 0);
    goTo('coverage');
  };

  const startOver = () => {
    onStartOver();
    setSaved(null);
    setEstimateChoice('estimate');
    setClaimsPeriod(undefined);
    setClaims(null);
    hsaTouched.current = false;
    fsaTouched.current = false;
  };

  // A report isn't saved, so picking up at its review means loading it again
  const resumeStep = saved && (saved.step === 'review' ? 'import' : (saved.step as StepId));

  if (step === 'welcome') {
    return (
      <Card className="mb-4 border-0 shadow-sm">
        <Card.Body className="p-3 p-sm-4 p-md-5">
          <h2 className="mb-3">Let's find your best {company.name} health plan</h2>
          <p className="lead">
            {company.welcome ??
              "Open enrollment can feel overwhelming. We'll ask a few simple questions, one at a time, then show what each plan would really cost you this year."}
          </p>
          <Table borderless className="my-4" style={{ maxWidth: '36rem' }}>
            <tbody>
              <tr>
                <td className="fs-4 pe-3">👋</td>
                <td>
                  <strong>About you</strong>
                  <div className="text-muted small">Who's covered and your tax rate</div>
                </td>
              </tr>
              <tr>
                <td className="fs-4 pe-3">🏦</td>
                <td>
                  <strong>Savings accounts</strong>
                  <div className="text-muted small">What you'd put in an HSA or FSA</div>
                </td>
              </tr>
              <tr>
                <td className="fs-4 pe-3">🩺</td>
                <td>
                  <strong>Expected care</strong>
                  <div className="text-muted small">
                    What you expect to spend, with help from AI if you like
                  </div>
                </td>
              </tr>
            </tbody>
          </Table>
          <div className="p-3 mb-4 rounded bg-light">
            <PrivacyNote className="fs-6 text-body">
              <strong>Your information stays on your device.</strong> This site has no server, so
              nothing you enter is sent anywhere. Your answers are saved only in this browser, so
              you can pick up where you left off.
            </PrivacyNote>
          </div>
          {resumeStep ? (
            <div className="d-flex flex-wrap gap-2">
              <Button size="lg" variant="success" className="px-5" onClick={() => goTo(resumeStep)}>
                Pick up where you left off <FontAwesomeIcon icon={faArrowRight} className="ms-2" />
              </Button>
              <Button
                size="lg"
                variant="outline-secondary"
                onClick={() => {
                  // Forget everything and go straight to the first question
                  startOver();
                  goTo(steps[1]);
                }}
              >
                Start over
              </Button>
            </div>
          ) : (
            <Button size="lg" variant="success" className="px-5" onClick={next}>
              Let's go <FontAwesomeIcon icon={faArrowRight} className="ms-2" />
            </Button>
          )}
          <p className="text-muted small mt-4 mb-0">
            Already know what you're doing and want to jump into the data?{' '}
            <Button variant="link" size="sm" className="p-0 align-baseline" onClick={onSkip}>
              Go straight to the full form
            </Button>
            .
          </p>
        </Card.Body>
      </Card>
    );
  }

  const estimateCount = inputs.costs.categoryEstimates.length;

  const renderQuestion = () => {
    switch (step) {
      case 'year':
        return {
          title: 'What plan year are you working on?',
          body: (
            <Form.Select
              size="lg"
              value={inputs.year}
              onChange={e => onChange({ year: parseInt(e.target.value) })}
              autoFocus
            >
              {years.map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </Form.Select>
          ),
        };
      case 'coverage':
        return {
          title: 'Who will be covered in your household?',
          intro: fromClaims
            ? 'Names are optional and never leave your device; we use them only to label your expenses.'
            : 'List everyone, starting with you. Names are optional and never leave your device; we use them only to label your expenses.',
          body: (
            <>
              {fromClaims && (
                <Alert variant="info" className="d-flex align-items-start gap-3">
                  <span className="fs-3 lh-1 text-nowrap">
                    {householdEmoji(peopleCount(inputs))}
                  </span>
                  <span>
                    <strong>We filled this in from last year's claims.</strong> Add anyone who had
                    no claims or is new, like a baby, and remove anyone leaving your plan.
                  </span>
                </Alert>
              )}
              <PeopleList inputs={inputs} onChange={onChange} size="lg" />
            </>
          ),
        };
      case 'age':
        return {
          title: `How old will the primary policyholder be at the end of ${inputs.year}?`,
          intro:
            'People 55 and up can put an extra $1,000 a year into an HSA. This is the only thing age changes here.',
          body: (
            <>
              <Form.Select
                size="lg"
                value={inputs.ageGroup}
                onChange={e => onChange({ ageGroup: e.target.value as UserInputs['ageGroup'] })}
                autoFocus
              >
                <option value="55_plus">55 or older</option>
                <option value="under_55">Under 55</option>
              </Form.Select>
              {inputs.ageGroup === '55_plus' && <MedicareNote className="mt-3 mb-0" />}
            </>
          ),
        };
      case 'tax':
        return {
          title: "What's your combined income tax rate?",
          intro:
            'Premiums and HSA/FSA contributions come out of your paycheck before taxes, so your tax rate decides how much you save.',
          body: (
            <>
              <InputGroup size="lg" className="mb-4" style={{ maxWidth: '12rem' }}>
                <FormattedNumberInput
                  value={inputs.taxRate}
                  onChange={value => onChange({ taxRate: value })}
                  min={0}
                  max={100}
                  step={0.5}
                  autoFocus
                />
                <InputGroup.Text>%</InputGroup.Text>
              </InputGroup>
              <TaxRateGuide />
            </>
          ),
        };
      case 'accounts': {
        const hsa = hsaPlans.length > 0 && (
          <Col xs={12} lg key="hsa" className="d-flex flex-column">
            <h5>Health Savings Account (HSA)</h5>
            <p>
              Comes with the high-deductible plans, and {company.name} adds up to{' '}
              <strong>{formatCurrency(maxEmployerHSA)} a year</strong> to it for free. What you put
              in stays yours, even if you change jobs.
            </p>
            <p>
              📈 <strong>The hidden superpower:</strong> you can invest it like a 401(k) and let it
              grow for decades, then spend it on medical care completely tax-free.{' '}
              <a href={HSA_VIDEO_URL} target="_blank" rel="noopener noreferrer">
                Here's how it works
              </a>
            </p>
            <div className="mt-auto">
              <ContributionInput
                label="Most you'd put in an HSA"
                value={inputs.hsaContribution}
                max={maxEmployeeHSA}
                autoFocus
                onChange={value => {
                  hsaTouched.current = true;
                  onChange({ hsaContribution: value });
                }}
              />
            </div>
          </Col>
        );
        const fsa = fsaPlans.length > 0 && (
          <Col xs={12} lg key="fsa" className="d-flex flex-column">
            <h5>{company.fsa_name ?? 'Flexible Spending Account (FSA)'}</h5>
            <p>
              Comes with the plans that don't have an HSA. Money left at the end of the year is
              lost, past a small amount that rolls over. No need to get it exact: we'll work out how
              much makes sense for each plan from your expected costs.
            </p>
            <div className="mt-auto">
              <ContributionInput
                label="Most you'd put in an FSA"
                value={inputs.fsaContribution}
                max={maxFSA}
                autoFocus={!hsa}
                onChange={value => {
                  fsaTouched.current = true;
                  onChange({ fsaContribution: value });
                }}
              />
            </div>
          </Col>
        );
        return {
          title: "What's the most you'd put in a tax-free account?",
          intro: (
            <>
              <em>No need to pick a plan yet.</em> Each plan comes with one of these accounts. What
              you put in comes out of your paycheck <em>before</em> taxes. If you went that route,
              what's the most you'd be willing to contribute?
            </>
          ),
          body: <Row className="g-5">{[hsa, fsa]}</Row>,
        };
      }
      case 'estimate':
        return {
          title: 'How do you want to estimate your health expenses?',
          intro:
            "Doctor visits, prescriptions, tests, therapy and the like. Don't worry about being exact.",
          body: <EstimateChoiceStep choice={estimateChoice} onChoose={setEstimateChoice} />,
        };
      case 'import':
        return {
          title: "Start from last year's claims?",
          intro: (
            <>
              {company.claims_report
                ? "We'll read your claims report right here in your browser and use up to its most recent 12 months as a starting point."
                : "An AI assistant can read your claims history, ask a few questions about what's changing, and write a file this tool can load."}
              {estimateCount > 0 &&
                ` You already have ${estimateCount} ${estimateCount === 1 ? 'estimate' : 'estimates'}; loading a report replaces them.`}
            </>
          ),
          body: planData && (
            <ImportStep
              company={company}
              planData={planData}
              inputs={inputs}
              onImported={applyImported}
              claims={claims}
              onClaimsLoaded={loadClaims}
            />
          ),
        };
      case 'review':
        return {
          title: "Here's what we found",
          intro: claims && (
            <>
              Your care from {describePeriod(claims.prepared)}
              {claims.trimmed && ', the most recent year of your report'}. Prices are the full price
              your insurance negotiated with each provider, before insurance paid its share (not the
              provider's sticker price or your copay). Pick what to carry into {inputs.year}; you
              can change anything on the next screen.
            </>
          ),
          body: planData && claims && (
            <ClaimsReview claims={claims} planData={planData} onDraftChange={setClaimsDraft} />
          ),
        };
      case 'edit':
        return {
          title: `What health expenses do you expect in ${inputs.year}?`,
          intro: (
            <>
              <p>
                {claimsPeriod && estimateCount > 0
                  ? `Here are the ${estimateCount} ${estimateCount === 1 ? 'expense' : 'expenses'} you kept, with the price increase applied. Now plan for what's different in ${inputs.year}: add anything new, like a baby, a surgery or a new prescription, change how often or how much, and remove anything that won't happen again.`
                  : 'Add the care you expect, how often, and its full price before insurance.'}
              </p>
              <p className="mb-1">
                💡 <strong>Don't forget other medical costs!</strong> To get a clear picture of your
                medical costs, include expenses your insurance won't cover, like:
              </p>
              <ul className="mb-1">
                <li>Procedures and visits your plan doesn't cover</li>
                <li>Over-the-counter medicine</li>
                <li>Everyday health items, like sunscreen and reading glasses</li>
              </ul>
              <p className="mb-0">
                Add them under <em>Other medical costs</em>.
              </p>
            </>
          ),
          body: planData && (
            <EditStep
              planData={planData}
              inputs={inputs}
              onChange={onChange}
              highlightIndex={addedRow}
            />
          ),
        };
      default:
        return { title: '', body: null };
    }
  };

  const question = renderQuestion();
  const total = steps.length - 1;

  return (
    <Card className="mb-4 border-0 shadow-sm">
      <Card.Body className="p-3 p-sm-4 p-md-5">
        <div className="small text-muted mb-1">
          Question {index} of {total}
        </div>
        <ProgressBar now={(index / total) * 100} className="mb-4" style={{ height: '0.5rem' }} />

        <Form
          onSubmit={e => {
            e.preventDefault();
            if (step === 'import' || step === 'review' || step === 'edit') return;
            next();
          }}
        >
          <h2 className="mb-3">{question.title}</h2>
          {question.intro && <div className="text-muted mb-4">{question.intro}</div>}
          <div className="mb-4">{question.body}</div>
        </Form>

        <div className="d-flex justify-content-between align-items-center gap-2 border-top pt-3">
          <Button variant="outline-secondary" className="text-nowrap" onClick={back}>
            <FontAwesomeIcon icon={faArrowLeft} className="me-2" />
            Back
          </Button>
          {/* Import: skip until a report is loaded, then on to reviewing it */}
          {step === 'import' && !claims && (
            <Button variant="outline-secondary" onClick={() => goTo('coverage')}>
              {skipLabel(inputs.costs.categoryEstimates.length)}
              <FontAwesomeIcon icon={faArrowRight} className="ms-2" />
            </Button>
          )}
          {step === 'import' && claims && (
            <Button variant="success" size="lg" onClick={() => goTo('review')}>
              Next
              <FontAwesomeIcon icon={faArrowRight} className="ms-2" />
            </Button>
          )}
          {step === 'review' && (
            <Button
              variant="success"
              size="lg"
              disabled={!claimsDraft?.ready}
              onClick={() =>
                claimsDraft &&
                applyImported(claimsDraft.estimates, claimsDraft.period, claimsDraft.people)
              }
            >
              Continue
              <FontAwesomeIcon icon={faArrowRight} className="ms-2" />
            </Button>
          )}
          {step !== 'import' && step !== 'review' && (
            <Button
              variant="success"
              size="lg"
              onClick={next}
              disabled={(step === 'estimate' && !estimateChoice) || (isLast && !planData)}
            >
              {isLast ? 'See my results' : 'Next'}
              <FontAwesomeIcon icon={faArrowRight} className="ms-2" />
            </Button>
          )}
        </div>
      </Card.Body>
      <Modal show={showOtherCostsReminder} onHide={() => setShowOtherCostsReminder(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Anything insurance won't pay for?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Your HSA or FSA also pays for health costs insurance doesn't cover. Adding them makes
            your total more realistic and can raise your tax savings. Think about:
          </p>
          <ul>
            <li>Over-the-counter medicine, like pain relievers and allergy pills</li>
            <li>Bandages, first aid and other medical supplies</li>
            <li>Sunscreen (SPF 15 or higher)</li>
            <li>Visits or treatments your plan won't cover</li>
          </ul>
          <p className="mb-0">
            Not sure what counts? Search{' '}
            <a href="https://www.hsalist.org/" target="_blank" rel="noopener noreferrer">
              hsalist.org <FontAwesomeIcon icon={faArrowUpRightFromSquare} size="xs" />
            </a>
            . Costs your HSA or FSA can't pay for go under{' '}
            <em>Other medical costs (HSA/FSA ineligible)</em>.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => {
              setShowOtherCostsReminder(false);
              onFinish();
            }}
          >
            Skip, see my results
          </Button>
          <Button
            variant="success"
            onClick={() => {
              setShowOtherCostsReminder(false);
              setAddedRow(inputs.costs.categoryEstimates.length);
              onChange({
                costs: {
                  ...inputs.costs,
                  categoryEstimates: [
                    ...inputs.costs.categoryEstimates,
                    {
                      categoryId: ELIGIBLE_OTHER_ID,
                      // A starting guess of $50 a person, for them to adjust
                      estimate: {
                        quantity: 1,
                        costPerVisit: OTHER_COSTS_PER_PERSON * peopleCount(inputs),
                        isInNetwork: true,
                      },
                      notes: 'Over-the-counter medicines, glasses, and other medical supplies',
                    },
                  ],
                },
              });
            }}
          >
            Add them
          </Button>
        </Modal.Footer>
      </Modal>
    </Card>
  );
};

export default GuidedSetup;
