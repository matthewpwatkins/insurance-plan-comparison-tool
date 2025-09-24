import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Alert } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

import CostInputForm from './components/CostInputForm';
import ResultsTable from './components/ResultsTable';
import { loadPlanData } from './services/planDataService';
import { calculateAllPlans } from './utils/costCalculator';

function App() {
  const [planData, setPlanData] = useState(null);
  const [userInputs, setUserInputs] = useState({
    year: 2026,
    coverage: 'family',
    ageGroup: 'under_55', // 'under_55' or '55_plus'
    taxRate: 24, // Store as percentage for UI, convert to decimal for calculations
    costInputMode: 'simple',
    costs: {
      totalAnnualCosts: 2000,
      networkMix: 'in_network'
    },
    hsaContribution: 0, // Will be calculated and set as default
    fsaContribution: 0  // Will be calculated and set as default
  });
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  // Load plan data on component mount and when year changes
  useEffect(() => {
    const loadData = async () => {
      try {
        setError(null);
        const data = await loadPlanData(userInputs.year);
        setPlanData(data);
      } catch (err) {
        setError(`Failed to load plan data: ${err.message}`);
      }
    };
    loadData();
  }, [userInputs.year]);

  // Recalculate results when inputs or plan data change
  useEffect(() => {
    if (planData && userInputs) {
      try {
        const calculatedResults = calculateAllPlans(planData, userInputs);
        setResults(calculatedResults);
      } catch (err) {
        setError(`Calculation error: ${err.message}`);
      }
    }
  }, [planData, userInputs]);

  const handleInputChange = (newInputs) => {
    setUserInputs(prev => ({ ...prev, ...newInputs }));
  };

  return (
    <Container className="mt-4">
      <Row>
        <Col>
          <h1 className="text-center mb-4">Health Insurance Plan Comparison Tool</h1>

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