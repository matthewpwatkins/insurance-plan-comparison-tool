import React, { useEffect, useState } from 'react';
import { Container, FormSelect, InputGroup, Table } from 'react-bootstrap';
import { CoverageScope } from './models/coverage-scope';
import { PLAN_DEFINITIONS, YEAR } from './models/plans';
import FAQs from './FAQs';
import { DefaultUserSelections, ExpenseEstimate, UserSelections } from './models/user-selections';
import { Service } from './models/services';
import { PlanExecution } from './models/plan-execution';

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const App: React.FC = () => {
  // Load user selections from local storage
  const [userSelections, setUserSelections] = useState<UserSelections>(() => {
    const userSelectionsJson = localStorage.getItem('userSelections');
    const value = userSelectionsJson ? JSON.parse(userSelectionsJson) as UserSelections : DefaultUserSelections;
    const newExpenses: ExpenseEstimate[] = Object.values(Service).map(service => value.expenses.find(expense => expense.service === service) || { service, quantity: 0, cost: 0 });
    value.expenses = newExpenses;
    return value;
  });

  // Persist user selections to local storage when they change
  useEffect(() => {
    console.log('Saving user selections to local storage');
    localStorage.setItem('userSelections', JSON.stringify(userSelections));

    // Update totals
    const newPlanExecutions: PlanExecution[] = PLAN_DEFINITIONS.map(planDefinition => new PlanExecution(planDefinition, userSelections.coverageScope, userSelections.taxRate));
    for (const expense of userSelections.expenses) {
      for (const planExecution of newPlanExecutions) {
        for (let i = 0; i < expense.quantity; i++) {
          planExecution.recordExpense(expense.service, expense.cost);
        }
      }
    }
    newPlanExecutions.sort((a, b) => a.netCost() - b.netCost());
    setPlanExecutions(newPlanExecutions);
  }, [userSelections]);

  const [planExecutions, setPlanExecutions] = useState<PlanExecution[]>([]);

  const handleTaxRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserSelections({
      ...userSelections,
      taxRate: parseFloat(e.target.value) / 100
    });
  };

  const handleCoverageScopeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setUserSelections({
      ...userSelections,
      coverageScope: e.target.value as CoverageScope
    });
  };

  const handleExpenseChange = (index: number, field: keyof ExpenseEstimate, value: string) => {
    const parsedValue = field === 'quantity' ? parseInt(value, 10) : parseFloat(value);
    const updatedExpenses = userSelections.expenses.map((expense, i) =>
      i === index ? { ...expense, [field]: isNaN(parsedValue) ? 0 : parsedValue } : expense
    );
    setUserSelections({
      ...userSelections,
      expenses: updatedExpenses
    });
  };

  return (
    <Container className="mt-5">
      <h1 className="display-1">DMBA Plan Comparison Tool - {YEAR}</h1>
      <p className="lead">
        Use this tool to estimate the total cost of your medical expenses for the year under different DMBA plans
        and choose the plan that's cheapest for you. See the FAQ at the bottom of the page for more information.
      </p>
      <p className="lead">Made with ❤️ by Matthew Watkins.</p>

      <h2 className="mt-3">Basic information</h2>
      <div>
        <label htmlFor="coverage-scope">Coverage scope</label>
        <FormSelect id="coverage-scope" value={userSelections.coverageScope} onChange={handleCoverageScopeChange}>
          {Object.values(CoverageScope).map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </FormSelect>
      </div>

      <div className="mt-3">
        <label htmlFor="tax-rate">My marginal tax rate</label>
        <InputGroup>
          <input type="number" id="tax-rate" className="form-control" step={0.01} min={0} max={100} value={parseFloat((userSelections.taxRate * 100).toFixed(2))} onChange={handleTaxRateChange} />
          <InputGroup.Text>%</InputGroup.Text>
        </InputGroup>
        <div className="form-text">See the FAQ for why this information is helpful.</div>
      </div>

      <h2 className="mt-3">Estimated {YEAR} medical expenses</h2>
      <p>
        Don't fret about getting it exact, just take a guess and use your previous EOBs to help you estimate.
        Keep in mind that [Preventive] services are free no matter which plan you choose.
      </p>
      <Table bordered={true}>
        <thead className="thead-dark">
          <tr>
            <th>Service</th>
            <th>Quantity</th>
            <th>Negotiated cost</th>
          </tr>
        </thead>
        <tbody>
          {userSelections.expenses.map((expense, index) => (
            <tr key={index}>
            <td>{expense.service}</td>
            <td className="p-0">
              <input
                type="number"
                value={expense.quantity}
                onChange={(e) => handleExpenseChange(index, 'quantity', e.target.value)}
                className="border-0 form-control"
                min={0}
                step={1}
              />
            </td>
            <td className="p-0">
              <InputGroup className="border-0">
                <InputGroup.Text className="border-0">$</InputGroup.Text>
                <input
                  type="number"
                  value={expense.cost}
                  onChange={(e) => handleExpenseChange(index, 'cost', e.target.value)}
                  className="border-0 form-control"
                  min={0}
                  step={0.01}
                />
              </InputGroup>
            </td>
          </tr>
          ))}
        </tbody>
      </Table>

      <h2 className="mt-3">Total plan costs</h2>
      <p>
        Given the above information, here's how much you can expect to spend (total) on your
        insurance-related health costs.
      </p>
      <Table bordered={true}>
        <thead className="thead-dark">
          <tr>
            <th>Plan</th>
            <th>My HSA/FSA contribution</th>
            <th>Employer HSA/FSA contribution</th>
            <th>Tax savings</th>
            <th>Premiums</th>
            <th>Out of pocket</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {planExecutions.map((planExecution, index) => (
            <tr key={index} className={index === 0 ? "table-success" : ""}>
              <td>{planExecution.planDefinition.name}</td>
              <td>{USD_FORMATTER.format(planExecution.participantHealthAccountContribution)}</td>
              <td>{USD_FORMATTER.format(planExecution.gains.employerHealthAccountContribution)}</td>
              <td>{USD_FORMATTER.format(planExecution.gains.taxSavings)}</td>
              <td>{USD_FORMATTER.format(planExecution.payments.premiums)}</td>
              <td>{USD_FORMATTER.format(planExecution.payments.outOfPocket)}</td>
              <td>{USD_FORMATTER.format(planExecution.netCost())}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <div className="mt-3">
        <FAQs />
      </div>
    </Container>
  );
}

export default App;

