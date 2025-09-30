import React, { useState, useImperativeHandle, forwardRef } from 'react';
import { Modal, Button, Accordion, Table } from 'react-bootstrap';
import { formatCurrency } from '../utils/formatters';
import { OrganizedLedger } from '../types';

export interface FAQButtonRef {
  openFAQ: (sectionIndex?: number) => void;
  openLedger: (planName: string, ledger: OrganizedLedger) => void;
}

interface FAQButtonProps {
  showButton?: boolean;
}

const FAQButton = forwardRef<FAQButtonRef, FAQButtonProps>(({ showButton = true }, ref) => {
  const [showModal, setShowModal] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'faq' | 'ledger'>('faq');
  const [ledgerData, setLedgerData] = useState<{
    planName: string;
    ledger: OrganizedLedger;
  } | null>(null);

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
            The best way to tell what kind of medical expenses you'll have in the future is to look
            at your past. Log in to DMBA, navigate to{' '}
            <a
              href="https://www.dmba.com/sc/medical/HealthClaims.aspx?type=medical"
              target="_blank"
              rel="noopener noreferrer"
            >
              My Health &gt; Claims
            </a>
            , and click "Create Claims History Report." Select all family members, both prescription
            and medical categories, and include the past 2 years. Select a "Detail" report. You
            should see all EOBs for that time range which will list all the associated medical costs
            you submitted through insurance.
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
            looking EOB report. Looks for words like "Over allowed amount" or "Discounted price" on
            the EOB. The remaining cost is divided between you and the insurance company. In the
            example below, the provider wanted to bill $100. The insurance company negotiated it
            down by 28.81 + 25.00, leaving $46.19 as the negotiated amount. $20.00 of that $46.19
            was paid as the copay, and DMBA paid the remaining $26.19.
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
            Good for you for picking up on that! Yes, HSAs have some amazing superpowers that aren't
            accounted for in this tool:
          </p>
          <p>
            <strong>First superpower:</strong> You keep the money and you use it whenever you want.
            FSAs (the kind you get with the PPO plan) are "use it or lose it" -- if you don't spend
            the money by the end of the year, you've just made a generous contribution to the FSA
            plan administrator. But HSAs are truly yours forever, and you can use them for any
            medical expenses you ever incur after the opening date of the HSA-- even when you're no
            longer on DMBA's plans!
          </p>
          <p>
            <strong>Second superpower:</strong> Investment. FSAs sit in a cash account and earn no
            interest. So technically, the money you put in an FSA is slowly evaporating to inflation
            over the course of the year. But HSAs usually live in a brokerage account, where cash by
            itself can often earn enough interest to outpace inflation.
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
            withdrawal for medical expenses. HSA is the best parts of an FSA plus the best parts of
            a Roth IRA combined!
          </p>
          <p>
            Those are some amazing superpowers. But those are long-term financial benefits that play
            out over the rest of our life. In order to provide an apples-to-apples comparison to PPO
            plans (which have zero long-term financial benefits), I had to ignore all of HSA's
            superpowers for this tool. Just know that they're there, and they're amazing. If you
            want to learn about the hundreds of thousands of dollars you save from just a single
            year's contributions to an HSA check out this great explainer video:
          </p>
          <div
            className="mt-3"
            style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}
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

      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {modalMode === 'faq'
              ? 'Frequently Asked Questions'
              : `Cost Calculation Details - ${ledgerData?.planName}`}
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
                This breakdown shows all the components that contribute to your total annual cost
                for <strong>{ledgerData?.planName}</strong>.
              </p>

              {/* Contributions and Savings Table */}
              {ledgerData?.ledger.contributionsAndSavings &&
                ledgerData.ledger.contributionsAndSavings.length > 0 && (
                  <>
                    <h5 className="mb-3">Contributions and Savings</h5>
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
                            <td>{entry.description}</td>
                            <td className="text-success">{formatCurrency(entry.amount, true)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="table-active">
                          <td>
                            <strong>Total Contributions and Savings</strong>
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
                      <strong>Total Premiums</strong>
                    </td>
                    <td className="text-danger">
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

              {/* In Network Expenses Table */}
              {ledgerData?.ledger.inNetworkExpenses &&
                ledgerData.ledger.inNetworkExpenses.length > 0 && (
                  <>
                    <h5 className="mb-3">In-Network Expenses</h5>
                    {(() => {
                      const showCopayColumn = ledgerData.ledger.inNetworkExpenses.some(
                        entry => entry.copay && entry.copay > 0
                      );
                      return (
                        <Table striped bordered hover responsive className="mb-4">
                          <thead>
                            <tr>
                              <th>Category</th>
                              <th style={{ width: '90px' }}>Cost</th>
                              {showCopayColumn && <th style={{ width: '80px' }}>Copay</th>}
                              <th style={{ width: '90px' }}>Your cost</th>
                              <th style={{ width: '90px' }}>Ins. cost</th>
                              <th style={{ width: '90px' }}>Deductible</th>
                              <th style={{ width: '80px' }}>OOP</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ledgerData.ledger.inNetworkExpenses.map((entry, index) => (
                              <tr key={index}>
                                <td>
                                  {entry.categoryDisplayName}
                                  {entry.notes && (
                                    <div className="text-muted small">{entry.notes}</div>
                                  )}
                                </td>
                                <td>{formatCurrency(entry.billedAmount, true)}</td>
                                {showCopayColumn && (
                                  <td>{entry.copay ? formatCurrency(entry.copay, true) : '—'}</td>
                                )}
                                <td
                                  className={entry.employeeResponsibility > 0 ? 'text-danger' : ''}
                                >
                                  {formatCurrency(entry.employeeResponsibility, true)}
                                </td>
                                <td>{formatCurrency(entry.insuranceResponsibility, true)}</td>
                                <td>{formatCurrency(entry.deductibleRemaining, true)}</td>
                                <td>{formatCurrency(entry.outOfPocketRemaining, true)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="table-active">
                              <td>
                                <strong>Total In-Network</strong>
                              </td>
                              <td>
                                <strong>
                                  {formatCurrency(
                                    ledgerData.ledger.inNetworkExpenses.reduce(
                                      (sum, entry) => sum + entry.billedAmount,
                                      0
                                    )
                                  )}
                                </strong>
                              </td>
                              {showCopayColumn && <td>—</td>}
                              <td className="text-danger">
                                <strong>
                                  {formatCurrency(
                                    ledgerData.ledger.inNetworkExpenses.reduce(
                                      (sum, entry) => sum + entry.employeeResponsibility,
                                      0
                                    )
                                  )}
                                </strong>
                              </td>
                              <td>
                                <strong>
                                  {formatCurrency(
                                    ledgerData.ledger.inNetworkExpenses.reduce(
                                      (sum, entry) => sum + entry.insuranceResponsibility,
                                      0
                                    )
                                  )}
                                </strong>
                              </td>
                              <td>—</td>
                              <td>—</td>
                            </tr>
                          </tfoot>
                        </Table>
                      );
                    })()}
                  </>
                )}

              {/* Out of Network Expenses Table */}
              {ledgerData?.ledger.outOfNetworkExpenses &&
                ledgerData.ledger.outOfNetworkExpenses.length > 0 && (
                  <>
                    <h5 className="mb-3">Out-of-Network Expenses</h5>
                    {(() => {
                      const showCopayColumn = ledgerData.ledger.outOfNetworkExpenses.some(
                        entry => entry.copay && entry.copay > 0
                      );
                      return (
                        <Table striped bordered hover responsive className="mb-4">
                          <thead>
                            <tr>
                              <th>Category</th>
                              <th style={{ width: '90px' }}>Cost</th>
                              {showCopayColumn && <th style={{ width: '80px' }}>Copay</th>}
                              <th style={{ width: '90px' }}>Your cost</th>
                              <th style={{ width: '90px' }}>Ins. cost</th>
                              <th style={{ width: '90px' }}>Deductible</th>
                              <th style={{ width: '80px' }}>OOP</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ledgerData.ledger.outOfNetworkExpenses.map((entry, index) => (
                              <tr key={index}>
                                <td>
                                  {entry.categoryDisplayName}
                                  {entry.notes && (
                                    <div className="text-muted small">{entry.notes}</div>
                                  )}
                                </td>
                                <td>{formatCurrency(entry.billedAmount, true)}</td>
                                {showCopayColumn && (
                                  <td>{entry.copay ? formatCurrency(entry.copay, true) : '—'}</td>
                                )}
                                <td
                                  className={entry.employeeResponsibility > 0 ? 'text-danger' : ''}
                                >
                                  {formatCurrency(entry.employeeResponsibility, true)}
                                </td>
                                <td>{formatCurrency(entry.insuranceResponsibility, true)}</td>
                                <td>{formatCurrency(entry.deductibleRemaining, true)}</td>
                                <td>{formatCurrency(entry.outOfPocketRemaining, true)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="table-active">
                              <td>
                                <strong>Total Out-of-Network</strong>
                              </td>
                              <td>
                                <strong>
                                  {formatCurrency(
                                    ledgerData.ledger.outOfNetworkExpenses.reduce(
                                      (sum, entry) => sum + entry.billedAmount,
                                      0
                                    )
                                  )}
                                </strong>
                              </td>
                              {showCopayColumn && <td>—</td>}
                              <td className="text-danger">
                                <strong>
                                  {formatCurrency(
                                    ledgerData.ledger.outOfNetworkExpenses.reduce(
                                      (sum, entry) => sum + entry.employeeResponsibility,
                                      0
                                    )
                                  )}
                                </strong>
                              </td>
                              <td>
                                <strong>
                                  {formatCurrency(
                                    ledgerData.ledger.outOfNetworkExpenses.reduce(
                                      (sum, entry) => sum + entry.insuranceResponsibility,
                                      0
                                    )
                                  )}
                                </strong>
                              </td>
                              <td>—</td>
                              <td>—</td>
                            </tr>
                          </tfoot>
                        </Table>
                      );
                    })()}
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
                    <td>Annual Premiums</td>
                    <td className="text-danger">
                      {formatCurrency(
                        ledgerData?.ledger.premiums.reduce((sum, entry) => sum + entry.amount, 0) ||
                          0
                      )}
                    </td>
                  </tr>
                  {ledgerData?.ledger.inNetworkExpenses &&
                    ledgerData.ledger.inNetworkExpenses.length > 0 && (
                      <tr>
                        <td>In-Network Out-of-Pocket Costs</td>
                        <td className="text-danger">
                          {formatCurrency(
                            ledgerData.ledger.inNetworkExpenses.reduce(
                              (sum, entry) => sum + entry.employeeResponsibility,
                              0
                            )
                          )}
                        </td>
                      </tr>
                    )}
                  {ledgerData?.ledger.outOfNetworkExpenses &&
                    ledgerData.ledger.outOfNetworkExpenses.length > 0 && (
                      <tr>
                        <td>Out-of-Network Out-of-Pocket Costs</td>
                        <td className="text-danger">
                          {formatCurrency(
                            ledgerData.ledger.outOfNetworkExpenses.reduce(
                              (sum, entry) => sum + entry.employeeResponsibility,
                              0
                            )
                          )}
                        </td>
                      </tr>
                    )}
                  {ledgerData?.ledger.contributionsAndSavings &&
                    ledgerData.ledger.contributionsAndSavings.length > 0 && (
                      <tr>
                        <td>Total Contributions and Savings</td>
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
                      <strong>Your Total Annual Cost</strong>
                    </td>
                    <td>
                      <strong className="fs-4 fw-bold text-primary">
                        {formatCurrency(
                          (ledgerData?.ledger.premiums.reduce(
                            (sum, entry) => sum + entry.amount,
                            0
                          ) || 0) +
                            (ledgerData?.ledger.inNetworkExpenses?.reduce(
                              (sum, entry) => sum + entry.employeeResponsibility,
                              0
                            ) || 0) +
                            (ledgerData?.ledger.outOfNetworkExpenses?.reduce(
                              (sum, entry) => sum + entry.employeeResponsibility,
                              0
                            ) || 0) -
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
});

export default FAQButton;
