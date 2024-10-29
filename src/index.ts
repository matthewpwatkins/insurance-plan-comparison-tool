import { PLAN_DEFINITIONS } from "./models/plans";
import { parseService, Service } from "./models/services";
import { CoverageScope, parseCoverageScope } from "./models/coverage-scope";
import { PlanExecution } from "./models/plan-execution";
import { UserSelections } from "./models/user-selections";

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});
const THIS_YEAR_HSA_MAX_CONTRIBUTION_LIMIT = 8550;

const DEFAULT_QTY_PRICES = Object.values(Service).reduce((acc, serviceName) => {
  acc[serviceName] = { qty: 0, price: 0 };
  return acc;
}, {} as Record<string, { qty: number, price: number }>);

function populateCoverageScopeDropdown() {
  const coverageScopeSelect = document.getElementById('coverageScope') as HTMLSelectElement;
  for (const coverageScopeName of Object.values(CoverageScope)) {
    const option = document.createElement('option');
      option.value = coverageScopeName;
      option.text = coverageScopeName;
      option.selected = coverageScopeName === CoverageScope.FAMILY;
      coverageScopeSelect.appendChild(option);
  }
}

function parseDollars(input: string): number {
  if (input.startsWith('$')) {
    return parseFloat(input.substring(1));
  }
  return parseFloat(input);
}

function calculate() {
  // Create an instance of UserSelections
  const userSelections: UserSelections = {
    taxRate: parseFloat((document.getElementById('taxRate') as HTMLInputElement).value) / 100,
    coverageScope: parseCoverageScope((document.getElementById('coverageScope') as HTMLSelectElement).value),
    expenses: []
  };

  // Populate the expenses array
  for (const row of Array.from(document.querySelectorAll<HTMLTableRowElement>('#costTable tbody tr'))) {
    userSelections.expenses.push({
      service: parseService(row.children[0].textContent!),
      quantity: parseInt(row.children[1].textContent!),
      cost: parseDollars(row.children[2].textContent!.substring(1))
    });
  }

  // Use the userSelections object in the calculation logic
  const planExecutions = PLAN_DEFINITIONS.map(plan => {
    const participantHsaContribution = plan.employerHsaContributions
      ? THIS_YEAR_HSA_MAX_CONTRIBUTION_LIMIT - plan.employerHsaContributions[userSelections.coverageScope]: 0;
    return new PlanExecution(plan, userSelections.coverageScope, participantHsaContribution, userSelections.taxRate);
  });

  for (const expense of userSelections.expenses) {
    for (const planExecution of planExecutions) {
      for (let i = 0; i < expense.quantity; i++) {
        planExecution.recordExpense(expense.service, expense.cost);
      }
    }
  }

  // Sort plan executions by net cost in ascending order
  planExecutions.sort((a, b) => a.netCost() - b.netCost());

  const tableBody = document.querySelector<HTMLTableSectionElement>('#planTable tbody')!;
  tableBody.innerHTML = '';

  for (const planExecution of planExecutions) {
    const newRow = document.createElement('tr');
    const netCost = Math.round(planExecution.netCost());
    newRow.innerHTML = `<td>${planExecution.planDefinition.name}</td><td>${USD_FORMATTER.format(netCost)}</td>`;
    tableBody.appendChild(newRow);
  }

  // Highlight the row with the lowest cost
  if (tableBody.firstChild) {
    (tableBody.firstChild as HTMLTableRowElement).classList.add('table-success');
  }
}

function addRow(serviceName: string, qty: number, cost: number) {
  const tableBody = document.querySelector<HTMLTableSectionElement>('#costTable tbody')!;
  const newRow = document.createElement('tr');
  newRow.innerHTML = `<td>${serviceName}</td><td contenteditable="true">${qty}</td><td contenteditable="true">${USD_FORMATTER.format(cost)}</td>`;
  tableBody.appendChild(newRow);
}

function loadTable() {
  for (const serviceName of Object.values(Service)) {
    addRow(serviceName, DEFAULT_QTY_PRICES[serviceName].qty, DEFAULT_QTY_PRICES[serviceName].price);
  }
  calculate();
}

// Run on document ready
document.addEventListener('DOMContentLoaded', () => {
  populateCoverageScopeDropdown();
  loadTable();
  document.getElementById('btn-calculate')!.addEventListener('click', calculate);
});