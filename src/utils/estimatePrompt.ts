import { Company, CoverageType, PlanData } from '../types';
import { ESTIMATE_CSV_HEADER } from './estimateCsv';

const COVERAGE_DESCRIPTIONS: Record<CoverageType, string> = {
  [CoverageType.Single]: 'just myself',
  [CoverageType.TwoParty]: 'myself and one other person',
  [CoverageType.Family]: 'my family',
};

/** First sentence of a description, so the category list stays short enough to paste. */
const firstSentence = (text: string): string => {
  const match = text.match(/^.*?[.!?](\s|$)/);
  return (match ? match[0] : text).trim();
};

/**
 * Build the prompt employees paste into an AI chat, along with their claims report,
 * to get a CSV the guided setup can import. It lists this company's real categories
 * so the output always matches what the tool understands.
 */
export const buildEstimatePrompt = (
  company: Company,
  planData: PlanData,
  coverage: CoverageType
): string => {
  const insurer = company.insurer_name ?? company.name;
  const nonPreventiveIds = Object.keys(planData.categories).filter(
    id => !planData.categories[id].preventive
  );
  const exampleA: string = nonPreventiveIds[0] ?? 'category_id';
  const exampleB: string = nonPreventiveIds[1] ?? exampleA;
  const categoryLines = Object.entries(planData.categories)
    .sort(([, a], [, b]) => a.name.localeCompare(b.name))
    .map(([id, category]) => {
      const preventive = category.preventive ? ' (preventive)' : '';
      const description = category.description ? `: ${firstSentence(category.description)}` : '';
      return `- ${id} | ${category.name}${preventive}${description}`;
    })
    .join('\n');

  return `You are helping me estimate my healthcare costs for ${planData.year} so I can compare ${company.name} health plans. I'm getting coverage for ${COVERAGE_DESCRIPTIONS[coverage]}. I've attached my ${insurer} claims report for the last 2 years.

Please work through these steps with me:

1. Read every row of the attached report. For each claim, the ALLOWED amount (the real price after the insurer's discount) is what the plan paid plus what I owed. Don't use the billed amount. Skip claims where both the plan paid and I owed $0; those were denied or billed again later.

   Tell me how many claims you found, the date range, and your totals for billed, plan paid, and what I owed. If the report has a totals row, check your numbers against it and re-read until they match. If you could only read part of the report, say so and ask me to paste the rest as text.

2. Sort the claims into the categories listed at the bottom. The report may show only a provider name, not the kind of service. Make your best guess from the name and the price, then show me ONE list of every provider you're unsure about with your guess, and ask me to correct it (for example "Jane Smith: primary care?"). For pharmacy claims, ask whether each person's prescriptions are generic or brand-name.

   Then show me a table for each year: category, number of visits or fills, and average allowed amount, and a short, plain-English summary (for example "Year 1: 6 doctor visits, 2 urgent care visits, 24 prescription fills").

3. Ask me questions, ONE AT A TIME, in plain English, to adjust for ${planData.year}. Wait for my answer before asking the next one. Cover at least:
   - Anyone joining or leaving my coverage (a new baby, marriage, a child aging out)
   - Health conditions that started, ended, or are expected
   - Planned pregnancy, surgeries, procedures, or therapy
   - Prescriptions starting, stopping, or changing
   - Whether we usually stay in-network
   - What yearly price inflation to assume (suggest ${planData.healthcare_price_increase}% unless I say otherwise)

4. Estimate ${planData.year} usage for each category below. For cost per visit, start from the average allowed amount in your table, not the billed amount or my copay. For a category with no past claims, use a typical in-network price and say so in the notes. Each prescription fill counts as one visit. Apply the inflation rate. Assume in-network unless the report or my answers say otherwise.

5. Give me the result as a downloadable file named health-cost-estimates.csv. If you can't create files, put the CSV alone in a single code block so I can copy it. The CSV must have exactly this header row and one row per person, category and network:

${ESTIMATE_CSV_HEADER.join(',')}

Column rules:
- category: one of the ids from the list below, exactly as written
- network: "in" or "out"
- visits: how many times in the year (a whole number)
- cost_per_visit: average allowed amount in dollars, numbers only (no $ or commas)
- notes: a short reason, under 100 characters, wrapped in double quotes. No one's name.
- person: who the care is for, as a number: 1, 2, 3 and so on, the same number for the same person every time. Never a name.

Example rows:
${exampleA},in,4,180,"Sick visits, up from 3 last year",2
${exampleB},out,2,350,"Dermatologist, out of network",1

Only include categories we expect to use. Don't include premiums, deductibles, or anything about which plan to pick. Do ask me about health costs insurance won't pay for, like over-the-counter medicine, supplies and sunscreen, and put them in the two "Other medical costs" categories.

Categories (id | name: description):
${categoryLines}
`;
};
