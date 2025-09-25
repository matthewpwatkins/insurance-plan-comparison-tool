import React, { useState } from 'react';
import { Modal, Button, Accordion } from 'react-bootstrap';

const FAQButton: React.FC = () => {
  const [showModal, setShowModal] = useState(false);

  const faqData = [
    {
      question: "How do I determine my marginal tax rate?",
      answer: (
        <div>
          <p>Your marginal tax rate is the rate at which your last dollar of income is taxed. It's the sum of your federal and state marginal tax rates.</p>
          <p><strong>To find yours:</strong></p>
          <ul>
            <li>Check your last tax return for your tax bracket</li>
            <li>Add your state income tax rate</li>
            <li>Use online tax calculators for estimates</li>
          </ul>
          <p><strong>Common combined rates:</strong></p>
          <ul>
            <li>22% federal + 5% state = 27% total</li>
            <li>24% federal + 6% state = 30% total</li>
            <li>32% federal + 7% state = 39% total</li>
          </ul>
        </div>
      )
    },
    {
      question: "What's the difference between HSA and FSA?",
      answer: (
        <div>
          <p><strong>HSA (Health Savings Account):</strong></p>
          <ul>
            <li>Triple tax advantage (deductible, tax-free growth, tax-free withdrawals)</li>
            <li>Money rolls over year to year</li>
            <li>Can be invested for long-term growth</li>
            <li>Only available with high-deductible health plans</li>
            <li>Becomes retirement account after age 65</li>
          </ul>
          <p><strong>FSA (Flexible Spending Account):</strong></p>
          <ul>
            <li>Tax-deductible contributions, tax-free spending</li>
            <li>"Use it or lose it" - must spend by year end</li>
            <li>Available with PPO plans</li>
            <li>Full amount available immediately</li>
            <li>Cannot have both HSA and FSA</li>
          </ul>
        </div>
      )
    },
    {
      question: "How should I estimate my healthcare costs?",
      answer: (
        <div>
          <p><strong>Review your past year:</strong></p>
          <ul>
            <li>Look at EOBs (Explanation of Benefits) from your current plan</li>
            <li>Count doctor visits, prescriptions, procedures</li>
            <li>Consider upcoming known expenses (surgery, pregnancy, etc.)</li>
          </ul>
          <p><strong>Common cost estimates:</strong></p>
          <ul>
            <li>Primary care visit: $200-300</li>
            <li>Specialist visit: $300-500</li>
            <li>Generic prescription (30-day): $10-50</li>
            <li>Brand prescription (30-day): $100-300</li>
            <li>Annual wellness exam: Usually covered 100%</li>
          </ul>
          <p><strong>Don't forget:</strong> It's better to overestimate than underestimate!</p>
        </div>
      )
    },
    {
      question: "What does 'in-network' vs 'out-of-network' mean?",
      answer: (
        <div>
          <p><strong>In-Network Providers:</strong></p>
          <ul>
            <li>Have contracts with your insurance company</li>
            <li>Offer negotiated, lower rates</li>
            <li>Count toward your deductible and out-of-pocket maximum</li>
            <li>Usually require just a copay</li>
          </ul>
          <p><strong>Out-of-Network Providers:</strong></p>
          <ul>
            <li>Don't have contracts with your insurance</li>
            <li>You pay significantly more</li>
            <li>May have separate, higher deductibles</li>
            <li>You might pay upfront and seek reimbursement</li>
            <li>Some plans don't cover out-of-network care at all</li>
          </ul>
          <p><strong>Pro tip:</strong> Always check if a provider is in-network before scheduling!</p>
        </div>
      )
    },
    {
      question: "Which plan type should I choose?",
      answer: (
        <div>
          <p><strong>Choose a PPO if:</strong></p>
          <ul>
            <li>You prefer predictable costs (copays vs. coinsurance)</li>
            <li>You have ongoing medical needs</li>
            <li>You want lower deductibles</li>
            <li>You prefer access to specialists without referrals</li>
          </ul>
          <p><strong>Choose an HSA if:</strong></p>
          <ul>
            <li>You're generally healthy with minimal healthcare needs</li>
            <li>You want maximum tax savings</li>
            <li>You can handle higher deductibles</li>
            <li>You want to build long-term savings for healthcare</li>
            <li>You're looking for retirement planning benefits</li>
          </ul>
          <p><strong>Remember:</strong> You can always change during open enrollment!</p>
        </div>
      )
    },
    {
      question: "How accurate are these calculations?",
      answer: (
        <div>
          <p>These calculations are estimates based on:</p>
          <ul>
            <li>Your input cost estimates</li>
            <li>Official plan documents and coverage details</li>
            <li>Current IRS contribution limits</li>
            <li>Standard tax calculations</li>
          </ul>
          <p><strong>Factors that may affect actual costs:</strong></p>
          <ul>
            <li>Actual healthcare utilization vs. estimates</li>
            <li>Network status of providers you use</li>
            <li>Plan changes during the year</li>
            <li>Emergency or unexpected medical needs</li>
          </ul>
          <p><strong>Use this tool to:</strong> Compare relative costs between plans, not as a guarantee of exact expenses.</p>
        </div>
      )
    }
  ];

  return (
    <>
      <Button
        variant="outline-primary"
        onClick={() => setShowModal(true)}
        className="ms-2"
      >
        📋 FAQ
      </Button>

      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Frequently Asked Questions</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Accordion>
            {faqData.map((faq, index) => (
              <Accordion.Item eventKey={index.toString()} key={index}>
                <Accordion.Header>{faq.question}</Accordion.Header>
                <Accordion.Body>
                  {faq.answer}
                </Accordion.Body>
              </Accordion.Item>
            ))}
          </Accordion>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={() => setShowModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default FAQButton;