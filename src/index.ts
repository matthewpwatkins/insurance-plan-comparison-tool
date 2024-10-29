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

  // Save userSelections to localStorage
  localStorage.setItem('userSelections', JSON.stringify(userSelections));

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
  const userSelectionsJson = localStorage.getItem('userSelections');
  const userSelections: UserSelections | undefined = userSelectionsJson ? JSON.parse(userSelectionsJson) : undefined;
  (document.getElementById('taxRate') as HTMLInputElement).value = ((userSelections?.taxRate || 0.24) * 100).toFixed(2);
  (document.getElementById('coverageScope') as HTMLSelectElement).value = userSelections?.coverageScope || CoverageScope.FAMILY;

  for (const serviceName of Object.values(Service)) {
    const selection = userSelections?.expenses.find(expense => expense.service === serviceName);
    addRow(serviceName, selection?.quantity || 0, selection?.cost || 0);
  }

  calculate();
}

// Run on document ready
document.addEventListener('DOMContentLoaded', () => {
  populateCoverageScopeDropdown();
  loadTable();
  document.querySelectorAll('.auto-calculate').forEach(element => {
    if (element.tagName === 'TBODY') {
      element.addEventListener('input', (event) => {
        if ((event.target as HTMLElement).tagName === 'TD') {
          calculate();
        }
      })
    } else {
      element.addEventListener('input', calculate);
      element.addEventListener('change', calculate);
    }
  });
});
