import React, { useState } from 'react';
import { Alert, Button, Form, Table } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileArrowUp } from '@fortawesome/free-solid-svg-icons';
import PrivacyNote from './PrivacyNote';
import { parseEstimatesCsv, EstimateCsvResult } from '../utils/estimateCsv';
import { formatCurrency } from '../utils/formatters';
import { CategoriesData, CategoryEstimate } from '../types';

interface EstimateImporterProps {
  categories: CategoriesData;
  /** How many estimates are already entered; when nonzero, offer replace or add. */
  existingCount: number;
  onImport: (estimates: CategoryEstimate[], mode: 'replace' | 'add') => void;
}

/**
 * Reads an estimates CSV from a file or pasted text, previews it, and hands the rows
 * back only once the user confirms. The file is read in the browser, never uploaded.
 */
const EstimateImporter: React.FC<EstimateImporterProps> = ({
  categories,
  existingCount,
  onImport,
}) => {
  const [text, setText] = useState('');
  const [result, setResult] = useState<EstimateCsvResult | null>(null);

  const parse = (value: string) => {
    setText(value);
    setResult(value.trim() ? parseEstimatesCsv(value, categories) : null);
  };

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) file.text().then(parse);
    event.target.value = '';
  };

  const finish = (mode: 'replace' | 'add') => {
    if (!result) return;
    onImport(result.estimates, mode);
    setText('');
    setResult(null);
  };

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center gap-3 mb-2">
        <Form.Label htmlFor="estimate-file" className="btn btn-primary mb-0">
          <FontAwesomeIcon icon={faFileArrowUp} className="me-2" />
          Choose file
        </Form.Label>
        <Form.Control
          id="estimate-file"
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          onChange={handleFile}
          className="d-none"
        />
        <span className="text-muted">or paste it below</span>
      </div>
      <Form.Control
        as="textarea"
        rows={4}
        value={text}
        onChange={e => parse(e.target.value)}
        placeholder="category,network,visits,cost_per_visit,notes"
        className="font-monospace small mb-2"
      />
      <PrivacyNote className="mb-3">
        Your file is read on your device and never uploaded.
      </PrivacyNote>

      {result && (
        <>
          {result.errors.length > 0 && (
            <Alert variant="warning">
              <strong>
                We skipped {result.errors.length} {result.errors.length === 1 ? 'row' : 'rows'}:
              </strong>
              <ul className="mb-0">
                {result.errors.map(error => (
                  <li key={error.line}>
                    Line {error.line}: {error.message}
                  </li>
                ))}
              </ul>
            </Alert>
          )}
          {result.estimates.length > 0 && (
            <>
              <Table size="sm" responsive className="small">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Network</th>
                    <th className="text-end">Times per year</th>
                    <th className="text-end">Cost each</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {result.estimates.map((row, index) => (
                    <tr key={index}>
                      <td>{categories[row.categoryId]?.name ?? row.categoryId}</td>
                      <td>{row.estimate.isInNetwork ? 'In' : 'Out'}</td>
                      <td className="text-end">{row.estimate.quantity}</td>
                      <td className="text-end">{formatCurrency(row.estimate.costPerVisit)}</td>
                      <td>{row.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <div className="d-flex flex-wrap gap-2">
                <Button variant="success" onClick={() => finish('replace')}>
                  {existingCount > 0 ? 'Replace my estimates' : 'Use these estimates'}
                </Button>
                {existingCount > 0 && (
                  <Button variant="outline-success" onClick={() => finish('add')}>
                    Add to my estimates
                  </Button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default EstimateImporter;
