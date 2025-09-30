import React from 'react';
import { Form } from 'react-bootstrap';
import BasicInfoSection from './BasicInfoSection';
import HSAFSASection from './HSAFSASection';
import HealthcareCategoriesSection from './HealthcareCategoriesSection';
import HelpIcon from './HelpIcon';
import { UserInputs, PlanData } from '../types';

interface CostInputFormProps {
  inputs: UserInputs;
  onChange: (updates: Partial<UserInputs>) => void;
  planData: PlanData | null;
}

const CostInputForm: React.FC<CostInputFormProps> = ({ inputs, onChange, planData }) => {
  return (
    <>
      <BasicInfoSection inputs={inputs} onChange={onChange} planData={planData} />

      <HSAFSASection inputs={inputs} onChange={onChange} planData={planData} />

      <div className="mb-4">
        <h3 className="d-flex justify-content-between align-items-center">
          <span>Annual Cost Estimates</span>
          <HelpIcon
            title="How to Estimate Your Healthcare Costs"
            content={
              <div>
                <p>
                  Estimating your healthcare costs accurately helps you choose the best plan. Here
                  are two methods:
                </p>

                <h5 className="mt-3">Method 1: Use a Healthcare Cost Estimator Tool</h5>
                <p>
                  For future procedures or services, many healthcare providers offer cost estimation
                  tools. For example, the University of Utah provides a tool with DMBA integration:
                </p>
                <ol>
                  <li>
                    Visit a cost estimator tool (e.g.,{' '}
                    <a
                      href="https://healthcare.utah.edu/pricing"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      healthcare.utah.edu/pricing
                    </a>
                    )
                  </li>
                  <li>Search for the procedure or service you need</li>
                  <li>Select "DMBA" as your insurance when available</li>
                  <li>
                    The tool will show you estimated costs including the negotiated rate with DMBA
                  </li>
                </ol>

                <h5 className="mt-4">Method 2: Review Your Past EOBs (Explanation of Benefits)</h5>
                <p>
                  Your EOBs show the negotiated rates DMBA has already paid for your past medical
                  services. This is your most accurate source for cost estimates.
                </p>
                <ol>
                  <li>
                    Log in to{' '}
                    <a
                      href="https://www.dmba.com/sc/medical/HealthClaims.aspx?type=medical"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      DMBA Claims Portal
                    </a>
                  </li>
                  <li>Navigate to My Health &gt; Claims</li>
                  <li>Click "Create Claims History Report"</li>
                  <li>Select all family members and both prescription and medical categories</li>
                  <li>Include the past 2 years and select a "Detail" report</li>
                  <li>
                    Look for the <strong>negotiated price</strong> on each EOB (the amount after
                    insurance discounts but before splitting between you and DMBA)
                  </li>
                </ol>
                <p className="mt-2">
                  <strong>Finding the negotiated price:</strong> On your EOB, look for terms like
                  "Allowed amount," "Negotiated rate," or amounts after "Over allowed amount" or
                  "Discounted price" are subtracted.
                </p>
                <p>
                  In the example below, the provider wanted to bill $100. The insurance company
                  negotiated it down by $28.81 + $25.00, leaving $46.19 as the negotiated amount.
                  $20.00 of that $46.19 was paid as the copay, and DMBA paid the remaining $26.19.
                </p>
                <img
                  src="/img/eob-example.jpg"
                  alt="EOB Example showing negotiated pricing"
                  className="img-fluid mt-2"
                  style={{ maxWidth: '100%', border: '1px solid #ddd', borderRadius: '4px' }}
                />

                <p className="mt-3 text-muted">
                  <strong>Tip:</strong> Don't worry about being exact. Use your best estimate based
                  on your health history and expected needs for the upcoming year.
                </p>
              </div>
            }
          />
        </h3>
        <p className="text-muted mb-4">
          No way around it, you have to use your magic ball now. Don't fret about getting it exact,
          just take a guess and use your previous health history and EOBs to estimate how many times
          you'll need each service and how much is the DMBA-negotiated rate on average.
        </p>
        <Form>
          <HealthcareCategoriesSection inputs={inputs} onChange={onChange} planData={planData} />
        </Form>
      </div>
    </>
  );
};

export default CostInputForm;
