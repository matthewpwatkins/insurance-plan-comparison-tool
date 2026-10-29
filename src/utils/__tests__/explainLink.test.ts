/**
 * Debugging aid, not a regression test: runs the app's own logic on a shared results link.
 * Use scripts/explain-link.sh instead of running this directly. Skipped unless LINK is set.
 */
import { decodeUserInputs } from '../urlParams';
import { loadPlanData, getAvailableDataYears } from '../../services/planDataService';
import { generateChartData } from '../chartDataGenerator';
import { calculateAllPlans } from '../costCalculator';
import { CoverageType, UserInputs } from '../../types';

const link = process.env.LINK;
const planFilter = (process.env.PLAN ?? '').toLowerCase();
const maybe = link ? test : test.skip;

const money = (n: number) => Math.round(n).toLocaleString('en-US');

maybe('explain link', () => {
  const url = new URL(link!);
  const slug = url.pathname.split('/').filter(Boolean)[0];
  const decoded = decodeUserInputs(url.hash, getAvailableDataYears(slug));
  if (decoded.status !== 'ok') throw new Error(`Link ${decoded.status}`);

  const planData = loadPlanData(
    slug,
    decoded.inputs.year ?? getAvailableDataYears(slug).slice(-1)[0]
  );
  // Same defaults CompanyApp starts from before a link's inputs are laid over them
  const inputs: UserInputs = {
    year: planData.year,
    coverage: CoverageType.Family,
    ageGroup: 'under_55',
    taxRate: 26.45,
    hsaContribution: 0,
    fsaContribution: 0,
    peopleNames: [],
    ...decoded.inputs,
    costs: { categoryEstimates: [], ...decoded.inputs.costs },
  };

  const chart = generateChartData(planData, inputs);
  const results = calculateAllPlans(planData, inputs);
  const out: string[] = [];
  out.push(
    `company=${slug} year=${inputs.year} coverage=${inputs.coverage} tax=${inputs.taxRate}%`
  );
  out.push(`hsa=${inputs.hsaContribution} fsa=${inputs.fsaContribution}`);
  inputs.costs.categoryEstimates.forEach(({ categoryId, estimate: e }) =>
    out.push(
      `  ${categoryId}: ${e.quantity} x $${e.costPerVisit} ${e.isInNetwork ? 'in' : 'out of'} network`
    )
  );
  out.push(`chart x (billed spending) = $${money(chart.userSpending)}`);
  out.push('');
  out.push('plan | dot (real total) | line at x | dot-line | out of pocket | OOP max');
  results.forEach(r => {
    const line = chart.plans
      .find(p => p.planName === r.planName)!
      .data.find(d => d.spending === chart.userSpending)!;
    out.push(
      [
        r.planName,
        money(r.totalCost),
        money(line.totalCost),
        money(r.totalCost - line.totalCost),
        money(r.outOfPocketCosts),
        money(r.outOfPocketMax),
      ].join(' | ')
    );
  });
  if (planFilter) {
    results
      .filter(r => r.planName.toLowerCase().includes(planFilter))
      .forEach(r => out.push('', `LEDGER ${r.planName}`, JSON.stringify(r.ledger, null, 1)));
  }
  // eslint-disable-next-line no-console
  console.log(out.join('\n'));
});
