import React, { useEffect, useRef, useState } from 'react';
import { Button, Card, Form, InputGroup, ProgressBar, Table } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import FormattedNumberInput from '../FormattedNumberInput';
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
  isHSAQualified,
} from '../../services/planDataService';
import { formatCurrency } from '../../utils/formatters';
import { CategoryEstimate, Company, CoverageType, PlanData, UserInputs } from '../../types';

type StepId =
  | 'welcome'
  | 'year'
  | 'coverage'
  | 'age'
  | 'tax'
  | 'hsa'
  | 'fsa'
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
  value: number;
  max: number;
  onChange: (value: number) => void;
}> = ({ value, max, onChange }) => (
  <div style={{ maxWidth: '32rem' }}>
    <InputGroup size="lg" className="mb-3" style={{ maxWidth: '16rem' }}>
      <InputGroup.Text>$</InputGroup.Text>
      <FormattedNumberInput
        value={value}
        onChange={onChange}
        min={0}
        max={max}
        step={100}
        autoFocus
      />
    </InputGroup>
    <Form.Range
      min={0}
      max={max}
      step={50}
      value={Math.min(value, max)}
      onChange={e => onChange(Number(e.target.value))}
      aria-label="Contribution amount"
    />
    <div className="d-flex justify-content-between small text-muted">
      <span>$0</span>
      <span>Max {formatCurrency(max)}</span>
    </div>
  </div>
);

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
    (saved?.estimateChoice as EstimateChoice | null) ?? null
  );
  const [claimsPeriod, setClaimsPeriod] = useState<string | undefined>(saved?.claimsPeriod);
  const [claims, setClaims] = useState<LoadedClaims | null>(null);
  const [claimsDraft, setClaimsDraft] = useState<ClaimsDraft | null>(null);

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
    'coverage',
    ...(hsaPlans.length > 0 ? (['age'] as StepId[]) : []),
    'tax',
    ...(hsaPlans.length > 0 ? (['hsa'] as StepId[]) : []),
    ...(fsaPlans.length > 0 ? (['fsa'] as StepId[]) : []),
    'estimate',
    ...(estimateChoice !== 'preventive'
      ? (['import', ...(claims ? ['review'] : []), 'edit'] as StepId[])
      : []),
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

  /** Takes imported estimates and moves on to editing them. */
  const applyImported = (estimates: CategoryEstimate[], period?: string) => {
    onChange({ costs: { ...inputs.costs, categoryEstimates: estimates } });
    setClaimsPeriod(period);
    goTo('edit');
  };

  const startOver = () => {
    onStartOver();
    setSaved(null);
    setEstimateChoice(null);
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
              <Button size="lg" variant="outline-secondary" onClick={startOver}>
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
          title: 'And who are you getting coverage for?',
          body: (
            <Form.Select
              size="lg"
              value={inputs.coverage}
              onChange={e => onChange({ coverage: e.target.value as CoverageType })}
              autoFocus
            >
              <option value={CoverageType.Single}>Single - Just you</option>
              <option value={CoverageType.TwoParty}>Two party - You and one other person</option>
              <option value={CoverageType.Family}>Family - At least 3 people</option>
            </Form.Select>
          ),
        };
      case 'age':
        return {
          title: `How old will you be at the end of ${inputs.year}?`,
          intro:
            'People 55 and up can put an extra $1,000 a year into an HSA. This is the only thing your age changes.',
          body: (
            <Form.Select
              size="lg"
              value={inputs.ageGroup}
              onChange={e => onChange({ ageGroup: e.target.value as UserInputs['ageGroup'] })}
              autoFocus
            >
              <option value="55_plus">55 or older</option>
              <option value="under_55">Under 55</option>
            </Form.Select>
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
      case 'hsa':
        return {
          title: "What's the most you'd put in an HSA?",
          intro: (
            <>
              <p>
                <em>No need to pick a plan yet.</em> If you end up choosing a high-deductible plan,
                you get a Health Savings Account (HSA), and {company.name} adds up to{' '}
                <strong>{formatCurrency(maxEmployerHSA)} a year</strong> to it for free.
              </p>
              <p>
                What you put in comes out of your paycheck <em>before</em> taxes, rolls over every
                year, and can be invested like a retirement account.
              </p>
              <p className="mb-0">
                If you went that route, what's the most you'd be willing to contribute?
              </p>
            </>
          ),
          body: (
            <ContributionInput
              value={inputs.hsaContribution}
              max={maxEmployeeHSA}
              onChange={value => {
                hsaTouched.current = true;
                onChange({ hsaContribution: value });
              }}
            />
          ),
        };
      case 'fsa':
        return {
          title: "What's the most you'd put in an FSA?",
          intro: (
            <>
              <p>
                <em>Still no need to pick a plan.</em> If you end up choosing a plan without an HSA,
                you can use {company.fsa_name ?? 'a Flexible Spending Account (FSA)'} instead.
              </p>
              <p>
                What you put in comes out of your paycheck <em>before</em> taxes, but you have to
                spend it by the end of the year or lose it, so stick to costs you're sure you'll
                have.
              </p>
              <p className="mb-0">
                If you went that route, what's the most you'd be willing to contribute?
              </p>
            </>
          ),
          body: (
            <ContributionInput
              value={inputs.fsaContribution}
              max={maxFSA}
              onChange={value => {
                fsaTouched.current = true;
                onChange({ fsaContribution: value });
              }}
            />
          ),
        };
      case 'estimate':
        return {
          title: 'Do you want to estimate your health expenses?',
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
          intro:
            claimsPeriod && estimateCount > 0
              ? `Here are the ${estimateCount} ${estimateCount === 1 ? 'expense' : 'expenses'} you kept, with the price increase applied. Now plan for what's different in ${inputs.year}: add anything new, like a baby, a surgery or a new prescription, change how often or how much, and remove anything that won't happen again.`
              : 'Add the care you expect, how often, and its full price before insurance.',
          body: planData && <EditStep planData={planData} inputs={inputs} onChange={onChange} />,
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
        <p className="small text-muted mb-3">
          Not sure? Make your best guess. On the results page you can change any answer and see how
          it changes the best plan.
        </p>

        <div className="d-flex justify-content-between align-items-center gap-2 border-top pt-3">
          <Button variant="outline-secondary" className="text-nowrap" onClick={back}>
            <FontAwesomeIcon icon={faArrowLeft} className="me-2" />
            Back
          </Button>
          {/* Import: skip until a report is loaded, then on to reviewing it */}
          {step === 'import' && !claims && (
            <Button variant="outline-secondary" onClick={() => goTo('edit')}>
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
                claimsDraft && applyImported(claimsDraft.estimates, claimsDraft.period)
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
    </Card>
  );
};

export default GuidedSetup;
