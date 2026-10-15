import React, { useState } from 'react';
import { Button, Card, Col, Form, Row } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy, faCheck, faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import { ClaimsReportLoader, LoadedClaims } from '../ClaimsReportImporter';
import EstimateImporter from '../EstimateImporter';
import HealthcareCategoriesSection from '../HealthcareCategoriesSection';
import PrivacyNote from '../PrivacyNote';
import { buildEstimatePrompt } from '../../utils/estimatePrompt';
import { CategoryEstimate, Company, PlanData, UserInputs } from '../../types';

export type EstimateChoice = 'estimate' | 'preventive';

const CHOICES: { id: EstimateChoice; emoji: string; title: string; description: string }[] = [
  {
    id: 'estimate',
    emoji: '🧾',
    title: 'Estimate my costs (recommended)',
    description: "Start from last year's claims or enter them yourself. About 5 to 10 minutes.",
  },
  {
    id: 'preventive',
    emoji: '🩺',
    title: 'Only preventive care',
    description:
      'Compare plans as if you only use care every plan covers in full. Goes straight to results.',
  },
];

/** Step 1: estimate costs, or compare on premiums and savings alone. */
export const EstimateChoiceStep: React.FC<{
  choice: EstimateChoice | null;
  onChoose: (choice: EstimateChoice) => void;
}> = ({ choice, onChoose }) => (
  <Row className="g-3 align-items-stretch">
    {CHOICES.map((option, i) => (
      <React.Fragment key={option.id}>
        {i > 0 && (
          <Col xs={12} md="auto" className="d-flex align-items-center justify-content-center">
            <span className="badge rounded-pill text-bg-light border text-muted px-3 py-2">OR</span>
          </Col>
        )}
        <Col xs={12} md>
          <Card
            role="button"
            onClick={() => onChoose(option.id)}
            border={choice === option.id ? 'primary' : undefined}
            className={`h-100 ${choice === option.id ? 'shadow-sm bg-primary-subtle' : ''}`}
          >
            <Card.Body>
              <div className="fs-3">{option.emoji}</div>
              <div className="fw-bold">{option.title}</div>
              <div className="small text-muted">{option.description}</div>
            </Card.Body>
          </Card>
        </Col>
      </React.Fragment>
    ))}
  </Row>
);

const StepNumber: React.FC<{ n: number }> = ({ n }) => (
  <span
    className="badge rounded-pill bg-primary me-2 flex-shrink-0"
    style={{ width: '1.75rem', height: '1.75rem', lineHeight: '1.25rem' }}
  >
    {n}
  </span>
);

const DownloadSteps: React.FC<{ company: Company }> = ({ company }) => {
  const portal = company.claims_portal;
  return portal ? (
    <ol>
      <li>
        Log in to{' '}
        <a href={portal.url} target="_blank" rel="noopener noreferrer">
          {portal.name} <FontAwesomeIcon icon={faArrowUpRightFromSquare} size="xs" />
        </a>
      </li>
      {portal.steps?.map(step => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  ) : (
    <p>
      Download a detailed claims report for the last year from your insurance company's website,
      including both medical and prescription claims.
    </p>
  );
};

interface ImportStepProps {
  company: Company;
  planData: PlanData;
  inputs: UserInputs;
  /** `period` is the claims date range, when the estimates came from a claims report */
  onImported: (estimates: CategoryEstimate[], period?: string) => void;
  /** The claims report already read, if any */
  claims: LoadedClaims | null;
  onClaimsLoaded: (claims: LoadedClaims) => void;
}

/** Label for the skip button, which keeps any estimates the person already has. */
export const skipLabel = (existing: number): string =>
  existing > 0
    ? `Keep my ${existing} ${existing === 1 ? 'estimate' : 'estimates'}`
    : 'Skip, enter by hand';

const ClaimsInstructions: React.FC<ImportStepProps> = ({ company, claims, onClaimsLoaded }) => {
  const report = company.claims_report;
  if (!report) return null;
  return (
    <div>
      <h5 className="d-flex align-items-center mt-2">
        <StepNumber n={1} /> Download your claims history
      </h5>
      <DownloadSteps company={company} />

      <h5 className="d-flex align-items-center mt-4">
        <StepNumber n={2} /> Load it here
      </h5>
      <ClaimsReportLoader report={report} loaded={!!claims} onLoaded={onClaimsLoaded} />
    </div>
  );
};

const AIInstructions: React.FC<ImportStepProps> = ({ company, planData, inputs, onImported }) => {
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const prompt = buildEstimatePrompt(company, planData, inputs.coverage);
  const assistant = company.ai_assistant;
  const assistantName = assistant?.name ?? 'your AI chat tool';

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setShowPrompt(true);
    }
  };

  return (
    <div>
      <h5 className="d-flex align-items-center mt-2">
        <StepNumber n={1} /> Download your claims history
      </h5>
      <DownloadSteps company={company} />

      <h5 className="d-flex align-items-center mt-4">
        <StepNumber n={2} /> Open {assistantName}
      </h5>
      <p className="mb-1">
        {assistant ? (
          <a href={assistant.url} target="_blank" rel="noopener noreferrer">
            Open {assistant.name} <FontAwesomeIcon icon={faArrowUpRightFromSquare} size="xs" />
          </a>
        ) : (
          'Open the AI chat tool your company approves for personal information.'
        )}{' '}
        {assistant?.note ?? 'Start a temporary or private chat so the conversation is not saved.'}
      </p>
      <PrivacyNote className="mb-2">
        Your claims go only to {assistantName}, never to us.
      </PrivacyNote>

      <h5 className="d-flex align-items-center mt-4">
        <StepNumber n={3} /> Attach the report and paste this prompt
      </h5>
      <div className="d-flex flex-wrap gap-2 mb-2">
        <Button variant={copied ? 'success' : 'primary'} onClick={copyPrompt}>
          <FontAwesomeIcon icon={copied ? faCheck : faCopy} className="me-2" />
          {copied ? 'Copied!' : 'Copy prompt'}
        </Button>
        <Button variant="link" onClick={() => setShowPrompt(!showPrompt)}>
          {showPrompt ? 'Hide prompt' : 'Show prompt'}
        </Button>
      </div>
      {showPrompt && (
        <Form.Control
          as="textarea"
          readOnly
          rows={10}
          value={prompt}
          className="font-monospace small mb-2"
          onFocus={e => e.target.select()}
        />
      )}

      <h5 className="d-flex align-items-center mt-4">
        <StepNumber n={4} /> Answer its questions
      </h5>
      <p>
        It will ask about changes coming up, like a new baby, a new prescription or a planned
        surgery. At the end it gives you a file named <code>health-cost-estimates.csv</code>.
      </p>

      <h5 className="d-flex align-items-center mt-4">
        <StepNumber n={5} /> Bring the file back here
      </h5>
      <EstimateImporter
        categories={planData.categories}
        existingCount={0}
        onImport={estimates => onImported(estimates)}
      />
    </div>
  );
};

/** Step 2: load last year's claims, or skip ahead and enter costs by hand. */
export const ImportStep: React.FC<ImportStepProps> = props => {
  return props.company.claims_report ? (
    <ClaimsInstructions {...props} />
  ) : (
    <AIInstructions {...props} />
  );
};

/** Step 3: the estimates themselves, prefilled from claims or empty, to edit and add to. */
export const EditStep: React.FC<{
  planData: PlanData;
  inputs: UserInputs;
  onChange: (updates: Partial<UserInputs>) => void;
}> = ({ planData, inputs, onChange }) => (
  // Already inside the guided setup's form, whose Enter key does nothing on this step
  <HealthcareCategoriesSection inputs={inputs} onChange={onChange} planData={planData} />
);
