import React from 'react';
import { Alert, Badge, Card, Row, Col } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faList } from '@fortawesome/free-solid-svg-icons';
import { formatCurrency } from '../utils/formatters';
import { PlanResult, ContributionType, PlanData, UserInputs } from '../types';
import HelpIcon from './HelpIcon';
import { breakEvenSpending } from '../utils/chartDataGenerator';
import {
  getMaxFSAContribution,
  getMaxHSAContribution,
  HSA_VIDEO_URL,
} from '../services/planDataService';

interface ResultsTableProps {
  results: PlanResult[];
  onShowWork: (result: PlanResult) => void;
  planData: PlanData;
  userInputs: UserInputs;
}

/** Card lines are hidden when their amount would display as $0. */
const shows = (amount: number): boolean => Math.round(amount) !== 0;

const ResultsTable: React.FC<ResultsTableProps> = ({
  results,
  onShowWork,
  planData,
  userInputs,
}) => {
  if (!results || results.length === 0) {
    return null;
  }

  const lowestCostAmount = results[0]?.totalCost;

  const Section: React.FC<{ title: string; className: string; children: React.ReactNode }> = ({
    title,
    className,
    children,
  }) => (
    <Col xs={12} lg={4}>
      <h6 className={`text-uppercase small fw-bold mb-3 text-nowrap ${className}`}>{title}</h6>
      {children}
    </Col>
  );

  const Item: React.FC<{
    amount: number;
    title: string;
    info: React.ReactNode;
    infoTitle?: string;
    amountClassName?: string;
    amountNode?: React.ReactNode;
    approx?: boolean;
    children?: React.ReactNode;
  }> = ({ amount, title, info, infoTitle, amountClassName, amountNode, approx, children }) => (
    <div className="mb-4">
      <div className={`fs-3 fw-bold lh-1 ${amountClassName ?? ''}`}>
        {approx && '~'}
        {amountNode ?? formatCurrency(amount)}
      </div>
      <div className="fw-semibold mt-1">
        {title} <HelpIcon title={infoTitle ?? title} content={info} />
      </div>
      {children && <div className="small text-muted mt-1">{children}</div>}
    </div>
  );

  // Shows a net amount as money spent (positive) or earned (negative)
  const netAmount = (amount: number) => (
    <span className={amount < 0 ? 'text-success' : 'text-danger'}>
      <strong>
        {formatCurrency(Math.abs(amount))} {amount < 0 ? 'earned' : 'spent'}
      </strong>
    </span>
  );

  const MathTable: React.FC<{ rows: [string, string][]; total: [string, string] }> = ({
    rows,
    total,
  }) => (
    <table className="table table-sm mb-3">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <td>{label}</td>
            <td className="text-end">{value}</td>
          </tr>
        ))}
        <tr className="fw-bold">
          <td>{total[0]}</td>
          <td className="text-end">{total[1]}</td>
        </tr>
      </tbody>
    </table>
  );

  const PlanCardBody: React.FC<{ result: PlanResult }> = ({ result }) => {
    const isHSA = result.contributionType === ContributionType.HSA;
    const account = isHSA ? 'HSA' : 'FSA';
    const taxRate = (
      userInputs.taxRate +
      planData.payroll_tax_rates.social_security +
      planData.payroll_tax_rates.medicare
    ).toFixed(2);
    const outOfPocketMax =
      result.maxAnnualCost -
      result.netAnnualPremiums +
      result.taxSavings +
      result.employerContribution;
    const incomeRate = userInputs.taxRate;
    const ssRate = planData.payroll_tax_rates.social_security;
    const medicareRate = planData.payroll_tax_rates.medicare;
    const rateRows: [string, string][] = [
      ['Your income tax rate (you entered this above)', `${incomeRate}%`],
      ['Social Security tax', `${ssRate}%`],
      ['Medicare tax', `${medicareRate}%`],
      ['Combined rate you skip', `${taxRate}%`],
    ];
    const depositLimit = isHSA
      ? getMaxHSAContribution(planData, userInputs.coverage, userInputs.ageGroup)
      : getMaxFSAContribution(planData);
    const bestCase = result.netAnnualPremiums - result.employerContribution - result.taxSavings;
    const breakEven = breakEvenSpending(planData, userInputs, result);
    const planShare = [
      ...result.ledger.inNetworkExpenses,
      ...result.ledger.outOfNetworkExpenses,
    ].reduce((sum, expense) => sum + expense.insuranceResponsibility, 0);
    const totalBills = result.outOfPocketCosts + planShare;
    const hasBenefits =
      shows(planShare) ||
      shows(result.premiumDiscount) ||
      shows(result.employerContribution) ||
      shows(result.taxSavings);

    return (
      <Row className="g-4">
        <Section title="Your costs" className="text-danger">
          {shows(result.annualPremiums) && (
            <Item
              amountClassName="text-danger"
              amount={result.annualPremiums}
              title="Premiums"
              info={
                <div>
                  <p>
                    Premiums are what you pay to have this plan, whether or not you use any care.
                    They come out of your paychecks in equal amounts all year.
                  </p>
                  <MathTable
                    rows={[
                      ['Per month', formatCurrency(result.annualPremiums / 12)],
                      ['× 12 months', ''],
                    ]}
                    total={['Premiums for the year', formatCurrency(result.annualPremiums)]}
                  />
                  <p className="mb-0">
                    This is the full price. Because premiums come out before taxes, part of it comes
                    back to you as tax savings, shown under Your benefits.
                  </p>
                </div>
              }
            >
              At {formatCurrency(result.annualPremiums / 12)}/month
            </Item>
          )}
          {shows(result.outOfPocketCosts) && (
            <Item
              amountClassName="text-danger"
              amount={result.outOfPocketCosts}
              approx
              title="Your share of medical costs"
              info={
                <div>
                  <p>
                    This is what you'd pay this year for the total medical costs you estimated
                    above, after the plan pays its part. It includes:
                  </p>
                  <ul>
                    <li>
                      <strong>Deductible:</strong> what you pay in full before the plan starts
                      sharing costs
                    </li>
                    <li>
                      <strong>Copays:</strong> flat fees for some visits and prescriptions
                    </li>
                    <li>
                      <strong>Coinsurance:</strong> your percentage of the bill after the deductible
                    </li>
                  </ul>
                  <p className="mb-0">
                    Medical costs include doctor visits, prescriptions, tests, procedures, and
                    therapy. Of the {formatCurrency(totalBills)} in total medical costs you
                    estimated above, the plan pays {formatCurrency(planShare)} and you pay{' '}
                    {formatCurrency(result.outOfPocketCosts)}. Your share never goes above the
                    plan's {formatCurrency(outOfPocketMax)} out-of-pocket max. Click{' '}
                    <strong>Details</strong> on this card to see every expense.
                  </p>
                </div>
              }
            >
              What you pay at the counter for the {formatCurrency(totalBills)} in total medical
              costs you estimated above
            </Item>
          )}
        </Section>

        <Section title="Your benefits" className="text-success">
          {shows(result.premiumDiscount) && (
            <Item
              amount={result.premiumDiscount}
              amountClassName="text-success"
              title="Tax savings on premiums"
              info={
                <div>
                  <p>
                    This isn't a refund or a check. Your employer takes premiums out of your pay{' '}
                    <em>before</em> figuring your taxes, so you're taxed on less money and your
                    take-home pay is higher than if you paid the same premiums after taxes.
                  </p>
                  <MathTable
                    rows={[
                      ['Your premiums for the year', formatCurrency(result.annualPremiums)],
                      ...rateRows,
                    ]}
                    total={['Taxes you skip', formatCurrency(result.premiumDiscount)]}
                  />
                  <p className="mb-0">
                    Plans with higher premiums save more in taxes, but never more than the premiums
                    themselves. Change your income tax rate above to see this update.
                  </p>
                </div>
              }
            >
              Because premiums are taken before taxes
            </Item>
          )}
          {shows(result.employerContribution) && (
            <Item
              amount={result.employerContribution}
              title={`Employer ${account} contribution`}
              amountClassName="text-success"
              info={
                isHSA ? (
                  <div>
                    <p>
                      Free money your employer puts into your Health Savings Account (HSA) this
                      year. You don't pay it back and you don't pay tax on it.
                    </p>
                    <ul className="mb-0">
                      <li>It's yours forever, even if you change jobs or plans.</li>
                      <li>Unused money rolls over every year. There's no deadline to spend it.</li>
                      <li>You can invest it, and growth is tax-free when spent on care.</li>
                      <li>It counts toward the yearly IRS HSA limit.</li>
                    </ul>
                  </div>
                ) : (
                  <div>
                    <p>
                      Free money your employer puts into your Flexible Spending Account (FSA) this
                      year. You don't pay it back and you don't pay tax on it.
                    </p>
                    <p className="mb-0">
                      Spend it on care by the end of the plan year. Money left over can be lost.
                    </p>
                  </div>
                )
              }
            >
              {isHSA ? 'Free, and yours to keep forever' : 'Free, use it by year end'}
            </Item>
          )}
          {shows(result.taxSavings) && (
            <Item
              amount={result.taxSavings}
              amountClassName="text-success"
              title={`Tax savings on your ${account} contributions`}
              info={
                <div>
                  <p>
                    Money you put into your {account} comes out of your pay before taxes, the same
                    way premiums do. You then spend it on care tax-free.
                  </p>
                  <MathTable
                    rows={[
                      [
                        `Your ${account} contribution for the year`,
                        formatCurrency(result.userContribution),
                      ],
                      ...rateRows,
                    ]}
                    total={['Taxes you skip', formatCurrency(result.taxSavings)]}
                  />
                  <p>
                    Every extra dollar you contribute saves about{' '}
                    {formatCurrency(Number(taxRate) / 100)} in taxes.{' '}
                    {isHSA ? (
                      <>
                        The IRS limit for your coverage this year is {formatCurrency(depositLimit)},
                        and your employer's {formatCurrency(result.employerContribution)} counts
                        toward it.
                      </>
                    ) : (
                      <>
                        The IRS limit for FSA contributions this year is{' '}
                        {formatCurrency(depositLimit)}.
                      </>
                    )}
                  </p>
                  <p className="mb-0">
                    {isHSA
                      ? 'Your contribution itself stays yours. Unused HSA money rolls over every year and goes with you if you change jobs, so contributing more than you expect to spend is safe.'
                      : 'Your contribution is still yours to spend on care, but FSA money left at the end of the plan year can be lost, so contribute only what you expect to spend.'}
                  </p>
                </div>
              }
            >
              On your {formatCurrency(result.userContribution)} contribution
            </Item>
          )}
          {shows(planShare) && (
            <Item
              amount={planShare}
              approx
              amountClassName="text-success"
              title="Plan's share of medical costs"
              info={
                <div>
                  <p>
                    The part of your medical costs the plan pays the doctor, hospital, or pharmacy
                    directly. You never see this money, but without the plan you'd owe it.
                  </p>
                  <MathTable
                    rows={[
                      ['Total medical costs you estimated above', formatCurrency(totalBills)],
                      ['− Your share', formatCurrency(result.outOfPocketCosts)],
                    ]}
                    total={["Plan's share", formatCurrency(planShare)]}
                  />
                  <p className="mb-0">
                    It isn't subtracted from your total healthcare cost, because you never pay it in
                    the first place. It shows how much this plan does for you. Click{' '}
                    <strong>Details</strong> on this card to see every expense.
                  </p>
                </div>
              }
            >
              What the plan pays for the {formatCurrency(totalBills)} in total medical costs you
              estimated above
            </Item>
          )}
          {!hasBenefits && (
            <p className="small text-muted">No employer money or tax savings with this plan.</p>
          )}
        </Section>

        <Section title="Your total healthcare cost" className="text-primary">
          <Item
            amount={result.totalCost}
            title={result.totalCost < 0 ? 'Earned' : 'Spent'}
            infoTitle="Your total healthcare cost"
            amountClassName={result.totalCost < 0 ? 'text-success' : 'text-danger'}
            approx
            amountNode={formatCurrency(Math.abs(result.totalCost))}
            info={
              <div>
                <p>
                  Everything you'd spend on healthcare this year with this plan, not just the plan's
                  price. The Estimated column below uses the total medical costs you estimated
                  above. Use it to compare plans.
                </p>
                <table className="table table-sm mb-3">
                  <thead>
                    <tr>
                      <th />
                      <th className="text-end">Best case</th>
                      <th className="text-end">Estimated</th>
                      <th className="text-end">Worst case</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        [
                          'Premiums',
                          result.annualPremiums,
                          result.annualPremiums,
                          result.annualPremiums,
                        ],
                        [
                          '+ Your share of medical costs',
                          0,
                          result.outOfPocketCosts,
                          outOfPocketMax,
                        ],
                        [
                          '− Tax savings on premiums',
                          result.premiumDiscount,
                          result.premiumDiscount,
                          result.premiumDiscount,
                        ],
                        [
                          `− Employer ${account} contribution`,
                          result.employerContribution,
                          result.employerContribution,
                          result.employerContribution,
                        ],
                        [
                          `− Tax savings on your ${account} contributions`,
                          result.taxSavings,
                          result.taxSavings,
                          result.taxSavings,
                        ],
                      ] as [string, number, number, number][]
                    ).map(([label, best, estimated, worst]) => (
                      <tr key={label}>
                        <td>{label}</td>
                        <td className="text-end">{formatCurrency(best)}</td>
                        <td className="text-end">{formatCurrency(estimated)}</td>
                        <td className="text-end">{formatCurrency(worst)}</td>
                      </tr>
                    ))}
                    <tr className="fw-bold">
                      <td>Total healthcare cost</td>
                      <td className="text-end">{formatCurrency(bestCase)}</td>
                      <td className="text-end">{formatCurrency(result.totalCost)}</td>
                      <td className="text-end">{formatCurrency(result.maxAnnualCost)}</td>
                    </tr>
                  </tbody>
                </table>
                <ul>
                  <li>
                    <strong>Best case:</strong> you need no care beyond free preventive visits. This
                    is where the plan's line starts on the chart below.
                  </li>
                  <li>
                    <strong>Worst case:</strong> your share of medical costs hits the{' '}
                    {formatCurrency(outOfPocketMax)} out-of-pocket max, a ceiling on your share of
                    covered medical costs. Past it, the plan pays the rest for the year. This is the
                    plan's flat line on the chart.
                  </li>
                </ul>
                <p className="mb-0">
                  Your own {account} contribution isn't counted as a cost, because that money stays
                  yours. The out-of-pocket max only applies to care the plan covers. Services the
                  plan excludes, and out-of-network charges above what the plan allows, can cost
                  more.
                </p>
              </div>
            }
          >
            Based on the total medical costs you estimated above. Best case {netAmount(bestCase)} ·
            Worst case {netAmount(result.maxAnnualCost)}
          </Item>
          {bestCase < 0 && (
            <Alert variant="success" className="small py-2 mb-4" style={{ marginTop: '-1rem' }}>
              <span className="fs-5 me-1">💰</span>
              <span>
                <strong>That's not a typo!</strong> This plan can pay you more than it costs.{' '}
                {result.maxAnnualCost < 0 || breakEven === null ? (
                  <>You come out ahead no matter how much care you need.</>
                ) : (
                  <>
                    As long as your medical bills for the year stay under about{' '}
                    {formatCurrency(breakEven ?? 0)}, not counting care that's free, you come out
                    ahead!
                  </>
                )}
              </span>
            </Alert>
          )}
          {isHSA && (
            <p className="small text-muted mb-0">
              <span className="me-1">📈</span>
              <strong>Hidden superpower not shown here:</strong> your HSA can be invested like a
              401(k) and grow for decades, then pay for medical care completely tax-free. Unspent
              money is yours forever, even if you change jobs.{' '}
              <a href={HSA_VIDEO_URL} target="_blank" rel="noopener noreferrer">
                Here's how it works
              </a>
            </p>
          )}
        </Section>
      </Row>
    );
  };

  // Card View Component for All Screen Sizes
  const PlanCard: React.FC<{ result: PlanResult; isLowestCost: boolean }> = ({
    result,
    isLowestCost,
  }) => (
    <div className={isLowestCost ? 'mx-n3 mx-md-n4' : ''}>
      <Card
        className={`mb-4 ${isLowestCost ? 'border-success border-4 shadow-lg' : 'mb-3'}`}
        style={
          isLowestCost
            ? {
                transform: 'scale(1.05)',
                transformOrigin: 'center',
                position: 'relative',
                zIndex: 10,
                overflow: 'hidden',
                // Green behind the header so scaling can't leave a light seam at its edges
                backgroundColor: 'var(--bs-success)',
              }
            : {}
        }
      >
        <Card.Header
          className={`d-flex justify-content-between align-items-center ${isLowestCost ? 'py-4 bg-success text-white' : 'py-3'}`}
        >
          <div className="d-flex align-items-center">
            <strong className={isLowestCost ? 'fs-4' : 'fs-5'}>{result.planName}</strong>
            {isLowestCost && (
              <Badge bg="warning" className="ms-3 text-dark fs-6 px-3 py-2">
                🏆 Best Value
              </Badge>
            )}
          </div>
          <div className="d-flex align-items-center gap-2">
            <Badge
              bg="info"
              className="fs-6"
              style={{ cursor: 'pointer' }}
              onClick={() => onShowWork(result)}
            >
              <FontAwesomeIcon icon={faList} /> Details
            </Badge>
          </div>
        </Card.Header>
        <Card.Body style={isLowestCost ? { backgroundColor: '#d1e7dd' } : undefined}>
          <PlanCardBody result={result} />
        </Card.Body>
      </Card>
    </div>
  );

  return (
    <>
      {/* Card View for All Screen Sizes. Top padding leaves room for the enlarged best plan. */}
      <div className="pt-4">
        {results.map(result => {
          const isLowestCost = result.totalCost === lowestCostAmount;
          return <PlanCard key={result.planName} result={result} isLowestCost={isLowestCost} />;
        })}
      </div>
    </>
  );
};

export default ResultsTable;
