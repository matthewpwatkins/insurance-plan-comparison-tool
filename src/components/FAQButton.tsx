import React, { useState, useImperativeHandle, forwardRef } from 'react';
import { Modal, Button, Accordion, Table, Badge } from 'react-bootstrap';
import { formatCurrency } from '../utils/formatters';
import { OrganizedLedger, Company, ExpenseEntry } from '../types';
import HelpIcon from './HelpIcon';

const sumOf = <T,>(items: T[], amount: (item: T) => number) =>
  items.reduce((sum, item) => sum + amount(item), 0);

/** One label and amount on a phone's visit card, amount lined up on the right */
const CardLine: React.FC<{ label: string; amount: number; className?: string }> = ({
  label,
  amount,
  className = '',
}) => (
  <div className={`d-flex justify-content-between ${className}`}>
    <span>{label}</span>
    <span>{formatCurrency(amount, true)}</span>
  </div>
);

export interface FAQButtonRef {
  openFAQ: (sectionIndex?: number) => void;
  openLedger: (planName: string, ledger: OrganizedLedger) => void;
}

interface FAQButtonProps {
  showButton?: boolean;
  company: Company;
}

const FAQButton = forwardRef<FAQButtonRef, FAQButtonProps>(
  ({ showButton = true, company }, ref) => {
    const insurerName = company.insurer_name ?? company.name;
    const claimsPortal = company.claims_portal;
    const [showModal, setShowModal] = useState(false);
    const [activeKey, setActiveKey] = useState<string | null>(null);
    const [modalMode, setModalMode] = useState<'faq' | 'ledger'>('faq');
    const [ledgerData, setLedgerData] = useState<{
      planName: string;
      ledger: OrganizedLedger;
    } | null>(null);

    /** What you pay for care on one network */
    const shareOf = (network: ExpenseEntry['network']) =>
      sumOf(
        (ledgerData?.ledger.expenses ?? []).filter(entry => entry.network === network),
        entry => entry.employeeResponsibility
      );

    useImperativeHandle(ref, () => ({
      openFAQ: (sectionIndex?: number) => {
        setModalMode('faq');
        setShowModal(true);
        if (sectionIndex !== undefined) {
          setActiveKey(sectionIndex.toString());
        }
      },
      openLedger: (planName: string, ledger: OrganizedLedger) => {
        setModalMode('ledger');
        setLedgerData({ planName, ledger });
        setShowModal(true);
      },
    }));

    const faqData = [
      {
        question: 'Why do I need my marginal tax rate?',
        answer: (
          <div>
            <p>
              FSA and HSA contributions are tax-deductible, meaning that you can subtract them from
              your taxable income. For example, if you have a 25% tax rate and contribute $5,000 of
              your money to an HSA, you'll save at least $1,250 less in taxes this year. Win!
            </p>
          </div>
        ),
      },
      {
        question: 'How can I estimate my future medical expenses?',
        answer: (
          <div>
            <p>
              The best way to tell what kind of medical expenses you'll have in the future is to
              look at your past. Your EOBs (Explanation of Benefits) list all the medical costs you
              submitted through insurance.{' '}
              {claimsPortal && (
                <>
                  Log in to{' '}
                  <a href={claimsPortal.url} target="_blank" rel="noopener noreferrer">
                    {claimsPortal.name}
                  </a>{' '}
                  and look for your claims history.
                </>
              )}
            </p>
          </div>
        ),
      },
      {
        question: "Negotiated price? What's that?",
        answer: (
          <div>
            <p>
              Helping to pay for medical expenses is only part of what insurance companies do. They
              also negotiate with medical providers to get a lower price for services and reject any
              charges that are too high. You get the negotiated rates at in-network providers, no
              matter which health plan you choose.
            </p>
            <p>
              You can see how much your insurance company has negotiated off your total bill by
              looking EOB report. Looks for words like "Over allowed amount" or "Discounted price"
              on the EOB. The remaining cost is divided between you and the insurance company. In
              the example below, the provider wanted to bill $100. The insurance company negotiated
              it down by 28.81 + 25.00, leaving $46.19 as the negotiated amount. $20.00 of that
              $46.19 was paid as the copay, and {insurerName} paid the remaining $26.19.
            </p>
            <img src="/img/eob-example.jpg" alt="EOB Example" className="img-fluid mt-2" />
          </div>
        ),
      },
      {
        question:
          "This tool doesn't show the hundreds of thousands of dollars I can save from a single year of HSA Contributions!",
        answer: (
          <div>
            <p>
              Good for you for picking up on that! Yes, HSAs have some amazing superpowers that
              aren't accounted for in this tool:
            </p>
            <p>
              <strong>First superpower:</strong> You keep the money and you use it whenever you
              want. FSAs (the kind you get with the PPO plan) are "use it or lose it" -- if you
              don't spend the money by the end of the year, you've just made a generous contribution
              to the FSA plan administrator. But HSAs are truly yours forever, and you can use them
              for any medical expenses you ever incur after the opening date of the HSA-- even when
              you're no longer on {company.name}'s plans!
            </p>
            <p>
              <strong>Second superpower:</strong> Investment. FSAs sit in a cash account and earn no
              interest. So technically, the money you put in an FSA is slowly evaporating to
              inflation over the course of the year. But HSAs usually live in a brokerage account,
              where cash by itself can often earn enough interest to outpace inflation.
            </p>
            <p>
              But even better, you can invest your HSA in index funds, where it can grow 8-10% on
              average. This is incredibly powerful. If you're in your early 20s, you can expect each
              $1,000 you invest in your HSA today to grow to $88,000 by the time you retire. That's
              not a typo-- that's the power of compound interest-- the eighth wonder of the world!
            </p>
            <p>
              <strong>Third superpower:</strong> Triple tax advantage! Like FSAs, HSAs are
              tax-deductible on the front-end. But they also grow tax-free, and are tax-free on
              withdrawal for medical expenses. HSA is the best parts of an FSA plus the best parts
              of a Roth IRA combined!
            </p>
            <p>
              Those are some amazing superpowers. But those are long-term financial benefits that
              play out over the rest of our life. In order to provide an apples-to-apples comparison
              to PPO plans (which have zero long-term financial benefits), I had to ignore all of
              HSA's superpowers for this tool. Just know that they're there, and they're amazing. If
              you want to learn about the hundreds of thousands of dollars you save from just a
              single year's contributions to an HSA check out this great explainer video:
            </p>
            <div
              className="mt-3"
              style={{
                position: 'relative',
                paddingBottom: '56.25%',
                height: 0,
                overflow: 'hidden',
              }}
            >
              <iframe
                src="https://www.youtube.com/embed/xn6FtTZYeWE"
                title="HSA Explainer Video"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        ),
      },
    ];

    return (
      <>
        {showButton && (
          <Button variant="outline-primary" onClick={() => setShowModal(true)} className="ms-2">
            📋 FAQ
          </Button>
        )}

        <Modal
          show={showModal}
          onHide={() => setShowModal(false)}
          size="xl"
          fullscreen="sm-down"
          centered
        >
          <Modal.Header closeButton>
            <Modal.Title>
              {modalMode === 'faq'
                ? 'Frequently Asked Questions'
                : `How we got the total for ${ledgerData?.planName}`}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {modalMode === 'faq' ? (
              <Accordion
                activeKey={activeKey}
                onSelect={eventKey => setActiveKey(typeof eventKey === 'string' ? eventKey : null)}
              >
                {faqData.map((faq, index) => (
                  <Accordion.Item eventKey={index.toString()} key={index}>
                    <Accordion.Header>{faq.question}</Accordion.Header>
                    <Accordion.Body>{faq.answer}</Accordion.Body>
                  </Accordion.Item>
                ))}
              </Accordion>
            ) : (
              <div>
                <p className="mb-4">
                  Every cost and benefit that adds up to your total healthcare cost for{' '}
                  <strong>{ledgerData?.planName}</strong>.
                </p>

                {/* Premiums Table */}
                <h5 className="mb-3">Premiums</h5>
                <Table striped bordered hover responsive className="mb-4">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th style={{ width: '120px' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerData?.ledger.premiums.map((entry, index) => (
                      <tr key={index}>
                        <td>{entry.description}</td>
                        <td className="text-danger">{formatCurrency(entry.amount, true)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="table-active">
                      <td>
                        <strong>Premiums for the year</strong>
                      </td>
                      <td>
                        <strong>
                          {formatCurrency(
                            ledgerData?.ledger.premiums.reduce(
                              (sum, entry) => sum + entry.amount,
                              0
                            ) || 0
                          )}
                        </strong>
                      </td>
                    </tr>
                  </tfoot>
                </Table>

                {/* Expenses Table */}
                {ledgerData && ledgerData.ledger.expenses.length > 0 && (
                  <>
                    <h5 className="mb-3">Medical Costs</h5>
                    {(() => {
                      const expenses = ledgerData.ledger.expenses;
                      const showCopayColumn = expenses.some(
                        entry => entry.copay && entry.copay > 0
                      );
                      return (
                        <>
                          <Table
                            striped
                            bordered
                            hover
                            responsive
                            className="mb-4 text-nowrap d-none d-md-table"
                          >
                            <thead>
                              <tr className="align-bottom">
                                <th className="text-wrap">Category</th>
                                <th>Cost</th>
                                {showCopayColumn && <th>Copay</th>}
                                <th>Your cost</th>
                                <th>Plan pays</th>
                                <th>Rem. deductible</th>
                                <th>Rem. out of pocket</th>
                              </tr>
                            </thead>
                            <tbody>
                              {expenses.map((entry, index) => {
                                const isInitialState = entry.category === 'initial_state';
                                return (
                                  <tr key={index}>
                                    <td className="text-wrap">
                                      <div style={{ maxWidth: '50rem' }}>
                                        {entry.categoryDisplayName}
                                        {entry.isPreventive && (
                                          <Badge bg="success" className="ms-2">
                                            Preventive
                                          </Badge>
                                        )}
                                        {entry.network === 'out_of_network' && !isInitialState && (
                                          <Badge bg="warning" text="dark" className="ms-2">
                                            Out-of-network
                                          </Badge>
                                        )}
                                        {entry.notes && (
                                          <div className="text-muted small">{entry.notes}</div>
                                        )}
                                      </div>
                                    </td>
                                    <td>
                                      {isInitialState
                                        ? '—'
                                        : formatCurrency(entry.billedAmount, true)}
                                    </td>
                                    {showCopayColumn && (
                                      <td>
                                        {entry.copay ? formatCurrency(entry.copay, true) : '—'}
                                      </td>
                                    )}
                                    <td
                                      className={
                                        entry.employeeResponsibility > 0 ? 'text-danger' : ''
                                      }
                                    >
                                      {isInitialState
                                        ? '—'
                                        : formatCurrency(entry.employeeResponsibility, true)}
                                    </td>
                                    <td>
                                      {isInitialState
                                        ? '—'
                                        : formatCurrency(entry.insuranceResponsibility, true)}
                                    </td>
                                    <td>{formatCurrency(entry.deductibleRemaining, true)}</td>
                                    <td>{formatCurrency(entry.outOfPocketRemaining, true)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="table-active">
                                <td>
                                  <strong>Total</strong>
                                </td>
                                <td>
                                  <strong>
                                    {formatCurrency(sumOf(expenses, entry => entry.billedAmount))}
                                  </strong>
                                </td>
                                {showCopayColumn && <td>—</td>}
                                <td className="text-danger">
                                  <strong>
                                    {formatCurrency(
                                      sumOf(expenses, entry => entry.employeeResponsibility)
                                    )}
                                  </strong>
                                </td>
                                <td>
                                  <strong>
                                    {formatCurrency(
                                      sumOf(expenses, entry => entry.insuranceResponsibility)
                                    )}
                                  </strong>
                                </td>
                                <td>—</td>
                                <td>—</td>
                              </tr>
                            </tfoot>
                          </Table>
                          {/* Phones get one card per visit, since the table won't fit */}
                          <div className="mb-4 d-md-none border rounded overflow-hidden">
                            {expenses.map((entry, index) => {
                              const isInitialState = entry.category === 'initial_state';
                              return (
                                <div key={index} className={index > 0 ? 'border-top' : ''}>
                                  <div className="bg-body-tertiary px-2 py-1">
                                    <div className="d-flex justify-content-between align-items-start gap-2">
                                      <span className="fw-semibold">
                                        {entry.categoryDisplayName}
                                      </span>
                                      <span className="d-flex gap-1 flex-shrink-0">
                                        {entry.isPreventive && (
                                          <Badge bg="success">Preventive</Badge>
                                        )}
                                        {entry.network === 'out_of_network' && !isInitialState && (
                                          <Badge bg="warning" text="dark">
                                            Out-of-network
                                          </Badge>
                                        )}
                                      </span>
                                    </div>
                                    {entry.notes && (
                                      <div className="text-muted small">{entry.notes}</div>
                                    )}
                                  </div>
                                  <div className="px-2 py-1">
                                    {!isInitialState && (
                                      <>
                                        <CardLine label="Cost" amount={entry.billedAmount} />
                                        {entry.copay ? (
                                          <CardLine label="Copay" amount={entry.copay} />
                                        ) : null}
                                        <CardLine
                                          label="Plan pays"
                                          amount={entry.insuranceResponsibility}
                                        />
                                        <CardLine
                                          label="You pay"
                                          amount={entry.employeeResponsibility}
                                          className={
                                            entry.employeeResponsibility > 0 ? 'text-danger' : ''
                                          }
                                        />
                                      </>
                                    )}
                                    <CardLine
                                      label="Rem. deductible"
                                      amount={entry.deductibleRemaining}
                                    />
                                    <CardLine
                                      label="Rem. out of pocket"
                                      amount={entry.outOfPocketRemaining}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                            <div className="border-top">
                              <div className="bg-body-secondary px-2 py-1 fw-semibold">Total</div>
                              <div className="px-2 py-1">
                                <CardLine
                                  label="Cost"
                                  amount={sumOf(expenses, entry => entry.billedAmount)}
                                />
                                <CardLine
                                  label="Plan pays"
                                  amount={sumOf(expenses, entry => entry.insuranceResponsibility)}
                                />
                                <CardLine
                                  label="You pay"
                                  amount={sumOf(expenses, entry => entry.employeeResponsibility)}
                                  className="text-danger fw-semibold"
                                />
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </>
                )}

                {/* Benefits Table */}
                {ledgerData?.ledger.contributionsAndSavings &&
                  ledgerData.ledger.contributionsAndSavings.length > 0 && (
                    <>
                      <h5 className="mb-3">Your benefits</h5>
                      <Table striped bordered hover responsive className="mb-4">
                        <thead>
                          <tr>
                            <th>Description</th>
                            <th style={{ width: '120px' }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ledgerData.ledger.contributionsAndSavings.map((entry, index) => (
                            <tr key={index}>
                              <td>
                                {entry.description}
                                {entry.description === 'Tax savings on premiums' && (
                                  <>
                                    {' '}
                                    <HelpIcon
                                      title="Tax savings on premiums"
                                      content={
                                        <p className="mb-0">
                                          This isn't a refund or a check. Your employer takes
                                          premiums out of your pay <em>before</em> figuring your
                                          taxes, so you're taxed on less money and your take-home
                                          pay is higher than if you paid the same premiums after
                                          taxes.
                                        </p>
                                      }
                                    />
                                  </>
                                )}
                              </td>
                              <td className="text-success">{formatCurrency(entry.amount, true)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="table-active">
                            <td>
                              <strong>Total benefits</strong>
                            </td>
                            <td className="text-success">
                              <strong>
                                {formatCurrency(
                                  ledgerData.ledger.contributionsAndSavings.reduce(
                                    (sum, entry) => sum + entry.amount,
                                    0
                                  )
                                )}
                              </strong>
                            </td>
                          </tr>
                        </tfoot>
                      </Table>
                    </>
                  )}

                {/* Final Summary Table */}
                <h5 className="mb-3">Summary</h5>
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th style={{ width: '120px' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Premiums</td>
                      <td className="text-danger">
                        {formatCurrency(
                          ledgerData?.ledger.premiums.reduce(
                            (sum, entry) => sum + entry.amount,
                            0
                          ) || 0
                        )}
                      </td>
                    </tr>
                    {shareOf('in_network') > 0 && (
                      <tr>
                        <td>Your share of in-network medical costs</td>
                        <td className="text-danger">{formatCurrency(shareOf('in_network'))}</td>
                      </tr>
                    )}
                    {shareOf('out_of_network') > 0 && (
                      <tr>
                        <td>Your share of out-of-network medical costs</td>
                        <td className="text-danger">{formatCurrency(shareOf('out_of_network'))}</td>
                      </tr>
                    )}
                    {ledgerData?.ledger.contributionsAndSavings &&
                      ledgerData.ledger.contributionsAndSavings.length > 0 && (
                        <tr>
                          <td>Your benefits</td>
                          <td className="text-success">
                            -
                            {formatCurrency(
                              ledgerData.ledger.contributionsAndSavings.reduce(
                                (sum, entry) => sum + entry.amount,
                                0
                              )
                            )}
                          </td>
                        </tr>
                      )}
                  </tbody>
                  <tfoot>
                    <tr className="table-active">
                      <td>
                        <strong>Your total healthcare cost</strong>
                      </td>
                      <td>
                        <strong className="fs-4 fw-bold text-primary">
                          {formatCurrency(
                            (ledgerData?.ledger.premiums.reduce(
                              (sum, entry) => sum + entry.amount,
                              0
                            ) || 0) +
                              shareOf('in_network') +
                              shareOf('out_of_network') -
                              (ledgerData?.ledger.contributionsAndSavings?.reduce(
                                (sum, entry) => sum + entry.amount,
                                0
                              ) || 0)
                          )}
                        </strong>
                      </td>
                    </tr>
                  </tfoot>
                </Table>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="primary" onClick={() => setShowModal(false)}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      </>
    );
  }
);

export default FAQButton;
