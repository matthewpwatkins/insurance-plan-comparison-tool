import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Col, Form, ListGroup, Row, Spinner } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFilePdf } from '@fortawesome/free-solid-svg-icons';
import PrivacyNote from './PrivacyNote';
import { readPdfLines } from '../claims/pdfText';
import { CLAIMS_READERS } from '../claims/readers';
import { ClaimsReadError } from '../claims/types';
import {
  CarryOver,
  estimatesFromCarryOvers,
  groupPastExpenses,
  limitToRecent,
  PastExpense,
  prepareClaims,
  PreparedClaims,
  suggestCarryOver,
  yearsCovered,
} from '../claims/estimateFromClaims';
import { formatCurrency } from '../utils/formatters';
import { CategoryEstimate, ClaimsReport, PlanData } from '../types';

/** Estimates come from at most the most recent year of the report. */
const MONTHS_USED = 12;
const MAX_INFLATION_RATE = 20;

/**
 * One row's columns: a column per field on wider screens. On phones the expense takes its own
 * line and category, count and prices share the next, each with a small label.
 */
const ExpenseColumns: React.FC<{
  expense: React.ReactNode;
  category: React.ReactNode;
  quantity: React.ReactNode;
  past: React.ReactNode;
  next: React.ReactNode;
  /** Labels shown above each field on phones; the header row covers wider screens */
  labels?: { quantity: string; past: string; next: string };
}> = ({ expense, category, quantity, past, next, labels }) => {
  const label = (text?: string) => text && <div className="d-md-none small text-muted">{text}</div>;
  return (
    <Row className="g-1 g-md-2 align-items-center">
      <Col xs={12} md style={{ minWidth: 0 }}>
        {expense}
      </Col>
      <Col xs={12} md={3}>
        {category}
      </Col>
      <Col xs={4} md={2} lg={1} className="text-md-end">
        {label(labels?.quantity)}
        {quantity}
      </Col>
      <Col xs={4} md={2} lg={1} className="text-md-end">
        {label(labels?.past)}
        {past}
      </Col>
      <Col xs={4} md={2} lg={1} className="text-md-end">
        {label(labels?.next)}
        {next}
      </Col>
    </Row>
  );
};

/** A claims report that has been read, ready to review. */
export interface LoadedClaims {
  prepared: PreparedClaims;
  expenses: PastExpense[];
  /** True when the report covered more than the year we use */
  trimmed: boolean;
}

/** What the page's Continue button sends on from the review. */
export interface ClaimsDraft {
  estimates: CategoryEstimate[];
  /** Date range the estimates came from, for the notice on the editor */
  period: string;
  /** False until every checked row has a category */
  ready: boolean;
}

const titleCase = (text: string): string =>
  text.toLowerCase().replace(/(^|[\s/&-])([a-z])/g, (_, gap, letter) => gap + letter.toUpperCase());

const formatDate = (isoDate: string, day = false): string =>
  new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: day ? 'numeric' : undefined,
    year: 'numeric',
  });

export const claimsPeriod = (prepared: PreparedClaims): string =>
  `${formatDate(prepared.firstDate, true)} to ${formatDate(prepared.lastDate, true)}`;

/** Reads a claims report PDF in the browser. */
export const ClaimsReportLoader: React.FC<{
  report: ClaimsReport;
  loaded: boolean;
  onLoaded: (claims: LoadedClaims) => void;
}> = ({ report, loaded, onLoaded }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reader = CLAIMS_READERS[report.format];

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const charges = reader.read(await readPdfLines(await file.arrayBuffer()));
      const all = prepareClaims(charges, report);
      if (all.visits.length === 0) {
        throw new ClaimsReadError('We found no costs in this report.');
      }
      const recent = limitToRecent(all, MONTHS_USED);
      onLoaded({
        prepared: recent,
        expenses: groupPastExpenses(recent.visits, report),
        trimmed: all.visits.length > recent.visits.length,
      });
    } catch (e) {
      setError(
        e instanceof ClaimsReadError
          ? e.message
          : `We couldn't read this file. Make sure it's ${reader.description}, saved as a PDF.`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center gap-3 mb-2">
        <Form.Label
          htmlFor="claims-report-file"
          className={`btn mb-0 ${loaded ? 'btn-outline-secondary btn-sm' : 'btn-primary'}`}
        >
          <FontAwesomeIcon icon={faFilePdf} className="me-2" />
          {loaded ? 'Choose a different report' : 'Choose claims report'}
        </Form.Label>
        <Form.Control
          id="claims-report-file"
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFile}
          className="d-none"
        />
        {loading && (
          <span className="text-muted">
            <Spinner animation="border" size="sm" className="me-2" />
            Reading your report…
          </span>
        )}
      </div>
      <PrivacyNote className="mb-3">
        Your report is read on your device and never uploaded.
      </PrivacyNote>
      {error && <Alert variant="warning">{error}</Alert>}
    </div>
  );
};

/**
 * Lists the past year's expenses by person, with the category, yearly count and price we
 * suggest for each. The person picks which ones to bring along and how much prices rise;
 * every number is editable on the next screen.
 */
export const ClaimsReview: React.FC<{
  claims: LoadedClaims;
  planData: PlanData;
  /** The current selection, or null once the review closes */
  onDraftChange: (draft: ClaimsDraft | null) => void;
}> = ({ claims, planData, onDraftChange }) => {
  const { prepared, expenses } = claims;
  // Every service starts checked, including ones we can't place: the person picks a category
  // for those or unchecks them
  const [included, setIncludedKeys] = useState<Set<string>>(
    () => new Set(expenses.map(expense => expense.key))
  );
  /** Categories picked for services the company's mapping doesn't know */
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [inflationRate, setInflationRate] = useState(planData.healthcare_price_increase);

  const sortedCategories = useMemo(
    () => Object.entries(planData.categories).sort(([, a], [, b]) => a.name.localeCompare(b.name)),
    [planData.categories]
  );

  /** Our suggestion for each expense, with any category the person picked. */
  const suggestions = useMemo(() => {
    const options = { planYear: planData.year, years: yearsCovered(prepared), inflationRate };
    const result: Record<string, CarryOver> = {};
    for (const expense of expenses) {
      const suggestion = suggestCarryOver(expense, options);
      result[expense.key] = {
        ...suggestion,
        categoryId: suggestion.categoryId ?? picked[expense.key] ?? null,
        include: included.has(expense.key),
      };
    }
    return result;
  }, [prepared, expenses, picked, included, inflationRate, planData.year]);

  const setIncluded = (include: boolean, rows: PastExpense[] = expenses) =>
    setIncludedKeys(current => {
      const next = new Set(current);
      rows.forEach(expense => (include ? next.add(expense.key) : next.delete(expense.key)));
      return next;
    });

  // Preventive care first, then by person, then by category name
  const ordered = useMemo(() => {
    const categoryName = (expense: PastExpense) =>
      planData.categories[suggestions[expense.key]?.categoryId ?? '']?.name ?? '~';
    return [...expenses].sort(
      (a, b) =>
        Number(b.preventive) - Number(a.preventive) ||
        a.patient.localeCompare(b.patient) ||
        categoryName(a).localeCompare(categoryName(b))
    );
  }, [expenses, suggestions, planData.categories]);

  const people = useMemo(
    () => Array.from(new Set(expenses.map(expense => expense.patient))),
    [expenses]
  );
  const kept = expenses.filter(expense => included.has(expense.key));
  const missingCategory = kept.some(expense => !suggestions[expense.key]?.categoryId);
  const pastPrice = (expense: PastExpense) => Math.round(expense.total / expense.visits.length);
  const totalAt = (price: (expense: PastExpense, suggestion: CarryOver) => number) =>
    kept.reduce((sum, expense) => {
      const suggestion = suggestions[expense.key];
      return suggestion ? sum + suggestion.quantity * price(expense, suggestion) : sum;
    }, 0);
  const pastTotal = totalAt(pastPrice);
  const yearlyTotal = totalAt((_, suggestion) => suggestion.costPerVisit);
  const planYearLabel = `${planData.year} est.`;

  // Leaving the screen clears the selection
  useEffect(() => () => onDraftChange(null), [onDraftChange]);

  // Keep the page's Continue button in step with the selection
  useEffect(() => {
    onDraftChange({
      estimates: estimatesFromCarryOvers(ordered, suggestions),
      period: claimsPeriod(prepared),
      ready: !missingCategory,
    });
  }, [prepared, ordered, suggestions, missingCategory, onDraftChange]);

  /** A dropdown only for services we couldn't place; everything else is plain text. */
  const categoryCell = (expense: PastExpense, suggestion: CarryOver) =>
    expense.choices.length > 0 ? (
      (planData.categories[suggestion.categoryId ?? '']?.name ?? suggestion.categoryId)
    ) : (
      <Form.Select
        size="sm"
        aria-label={`Category for ${expense.provider}`}
        value={picked[expense.key] ?? ''}
        isInvalid={included.has(expense.key) && !picked[expense.key]}
        onChange={e => setPicked({ ...picked, [expense.key]: e.target.value })}
      >
        <option value="">Pick a category</option>
        {sortedCategories.map(([id, category]) => (
          <option key={id} value={id}>
            {category.name}
          </option>
        ))}
      </Form.Select>
    );

  const labels = { quantity: 'Per year', past: 'Past avg', next: planYearLabel };

  const expenseRow = (expense: PastExpense) => {
    const suggestion = suggestions[expense.key];
    if (!suggestion) return null;
    const count = expense.visits.length;
    return (
      <ListGroup.Item
        key={expense.key}
        className={`small py-2 ${suggestion.include ? '' : 'text-muted'}`}
      >
        <div className="d-flex gap-2">
          <Form.Check
            aria-label={`Include ${expense.provider}`}
            checked={suggestion.include}
            onChange={e => setIncluded(e.target.checked, [expense])}
          />
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <ExpenseColumns
              labels={labels}
              expense={
                <>
                  <div className="fw-semibold">
                    {titleCase(expense.provider)}
                    {expense.preventive && (
                      <Badge bg="success" className="ms-2">
                        Preventive
                      </Badge>
                    )}
                    {!expense.inNetwork && (
                      <Badge bg="warning" text="dark" className="ms-2">
                        Out of network
                      </Badge>
                    )}
                  </div>
                  <div>{titleCase(expense.service)}</div>
                  <div className="text-muted">
                    {count} {count === 1 ? 'time' : 'times'}:{' '}
                    {expense.visits.map(visit => formatDate(visit.date, true)).join(', ')}
                  </div>
                </>
              }
              category={categoryCell(expense, suggestion)}
              quantity={suggestion.quantity}
              past={<span className="text-muted">{formatCurrency(pastPrice(expense))}</span>}
              next={<span className="fw-semibold">{formatCurrency(suggestion.costPerVisit)}</span>}
            />
          </div>
        </div>
      </ListGroup.Item>
    );
  };

  return (
    <div>
      <div className="p-3 p-md-4 mb-4 rounded border bg-body-tertiary">
        <Form.Label htmlFor="claims-inflation" className="d-flex align-items-baseline gap-2 mb-1">
          <span className="fs-3" aria-hidden>
            📈
          </span>
          <span className="fw-semibold fs-5">Yearly price increase</span>
          <span className="fs-3 fw-bold text-primary ms-auto">{inflationRate.toFixed(1)}%</span>
        </Form.Label>
        <Form.Range
          id="claims-inflation"
          min={0}
          max={MAX_INFLATION_RATE}
          step={0.1}
          value={inflationRate}
          onChange={e => setInflationRate(Number(e.target.value))}
        />
        <div className="d-flex justify-content-between small text-muted">
          <span>0%</span>
          <span>{MAX_INFLATION_RATE}%</span>
        </div>
        <div className="small text-muted mt-2">
          Healthcare prices go up every year. The {planYearLabel} prices below are the past average
          plus this increase. We start at {planData.healthcare_price_increase.toFixed(1)}%, the
          expected rise in healthcare prices going into {planData.year}.
        </div>
      </div>

      <Form.Check
        id="claims-select-all"
        className="mb-2 small fw-semibold"
        label={`Select all (${kept.length} of ${expenses.length} selected)`}
        checked={kept.length === expenses.length}
        ref={(input: HTMLInputElement | null) => {
          if (input) input.indeterminate = kept.length > 0 && kept.length < expenses.length;
        }}
        onChange={e => setIncluded(e.target.checked)}
      />

      {people.map(person => {
        const rows = ordered.filter(expense => expense.patient === person);
        const keptRows = rows.filter(expense => included.has(expense.key)).length;
        return (
          <div key={person} className="mb-3">
            <h6 className="mb-1">{titleCase(person)}</h6>
            <ListGroup>
              <ListGroup.Item className="small fw-semibold bg-body-tertiary py-1">
                <div className="d-flex gap-2 align-items-center">
                  <Form.Check
                    aria-label={`Select all for ${titleCase(person)}`}
                    title={`Select all for ${titleCase(person)}`}
                    checked={keptRows === rows.length}
                    ref={(input: HTMLInputElement | null) => {
                      if (input) input.indeterminate = keptRows > 0 && keptRows < rows.length;
                    }}
                    onChange={e => setIncluded(e.target.checked, rows)}
                  />
                  <div className="flex-grow-1">
                    <span className="d-md-none">Select all</span>
                    <div className="d-none d-md-block">
                      <ExpenseColumns
                        expense="Expense"
                        category="Category"
                        quantity="Per year"
                        past={<span title="Average price each time in your report">Past avg</span>}
                        next={
                          <span title="Past average plus the yearly price increase">
                            {planYearLabel}
                          </span>
                        }
                      />
                    </div>
                  </div>
                </div>
              </ListGroup.Item>
              {rows.map(expenseRow)}
            </ListGroup>
          </div>
        );
      })}

      <div className="small fw-semibold rounded bg-body-tertiary border px-3 py-2">
        <div className="d-flex gap-2">
          <div style={{ width: '1em' }} />
          <div className="flex-grow-1">
            <ExpenseColumns
              labels={{ quantity: '', past: 'Past total', next: `${planData.year} total` }}
              expense={`${kept.length}/${expenses.length} selected`}
              category={
                <span className={missingCategory ? 'text-danger' : undefined}>
                  {missingCategory
                    ? 'Pick a category for every checked row'
                    : 'Total before insurance'}
                </span>
              }
              quantity={null}
              past={<span className="text-muted fw-normal">{formatCurrency(pastTotal)}/yr</span>}
              next={`${formatCurrency(yearlyTotal)}/yr`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
