import React from 'react';
import { Form } from 'react-bootstrap';
import BasicInfoSection from './BasicInfoSection';
import HSAFSASection from './HSAFSASection';
import HealthcareCategoriesSection from './HealthcareCategoriesSection';
import CollapsibleCard from './CollapsibleCard';
import HelpIcon from './HelpIcon';
import { formatCurrency } from '../utils/formatters';
import { UserInputs, PlanData, Company } from '../types';

interface CostInputFormProps {
  inputs: UserInputs;
  onChange: (updates: Partial<UserInputs>) => void;
  planData: PlanData | null;
  company: Company;
  /** Whether the sections start open */
  defaultOpen?: boolean;
}

const CostInputForm: React.FC<CostInputFormProps> = ({
  inputs,
  onChange,
  planData,
  company,
  defaultOpen = true,
}) => {
  const count = inputs.costs.categoryEstimates.length;
  const yearlyTotal = inputs.costs.categoryEstimates.reduce(
    (sum, { estimate }) => sum + estimate.quantity * estimate.costPerVisit,
    0
  );
  const insurerName = company.insurer_name ?? company.name;
  const { claims_portal: claimsPortal, cost_estimator: costEstimator } = company;

  return (
    <>
      <BasicInfoSection
        inputs={inputs}
        onChange={onChange}
        planData={planData}
        company={company}
        defaultOpen={defaultOpen}
      />

      <HSAFSASection
        inputs={inputs}
        onChange={onChange}
        planData={planData}
        company={company}
        defaultOpen={defaultOpen}
      />

      <CollapsibleCard
        title="Annual Cost Estimates"
        summary={`${count} ${count === 1 ? 'expense' : 'expenses'} · ${formatCurrency(yearlyTotal)}/yr before insurance`}
        defaultOpen={defaultOpen}
        help={
          <HelpIcon
            title="How to Estimate Your Healthcare Costs"
            content={
              <div>
                <p>
                  Estimating your healthcare costs accurately helps you choose the best plan. Here
                  are two methods:
                </p>

                {costEstimator ? (
                  <>
                    <h5 className="mt-3">Method 1: Use a Healthcare Cost Estimator Tool</h5>
                    <p>
                      For future procedures or services, many healthcare providers offer cost
                      estimation tools. For example, {costEstimator.provider} provides a tool with{' '}
                      {insurerName} integration:
                    </p>
                    <ol>
                      <li>
                        Visit a cost estimator tool (e.g.,{' '}
                        <a href={costEstimator.url} target="_blank" rel="noopener noreferrer">
                          {costEstimator.name}
                        </a>
                        )
                      </li>
                      <li>Search for the procedure or service you need</li>
                      <li>Select "{insurerName}" as your insurance when available</li>
                      <li>
                        The tool will show you estimated costs including the negotiated rate with{' '}
                        {insurerName}
                      </li>
                    </ol>
                  </>
                ) : (
                  <p>
                    Estimating your healthcare costs accurately helps you choose the best plan. Look
                    at past EOBs (Explanation of Benefits) from {insurerName} to see what you've
                    actually paid.
                  </p>
                )}

                <h5 className="mt-4">Method 2: Review Your Past EOBs (Explanation of Benefits)</h5>
                <p>
                  Your EOBs show the negotiated rates {insurerName} has already paid for your past
                  medical services. This is your most accurate source for cost estimates.
                </p>
                <ol>
                  {claimsPortal && (
                    <li>
                      Log in to{' '}
                      <a href={claimsPortal.url} target="_blank" rel="noopener noreferrer">
                        {claimsPortal.name}
                      </a>
                    </li>
                  )}
                  {claimsPortal?.steps?.map(step => (
                    <li key={step}>{step}</li>
                  ))}
                  <li>
                    Look for the <strong>negotiated price</strong> on each EOB (the amount after
                    insurance discounts but before splitting between you and {insurerName})
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
                  $20.00 of that $46.19 was paid as the copay, and {insurerName} paid the remaining
                  $26.19.
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
        }
      >
        <p className="text-muted mb-4">
          No way around it, you have to use your magic ball now. Don't fret about getting it exact,
          just take a guess and use your previous health history and EOBs to estimate how many times
          you'll need each service and how much is the {insurerName}-negotiated rate on average.
        </p>
        <Form>
          <HealthcareCategoriesSection inputs={inputs} onChange={onChange} planData={planData} />
        </Form>
      </CollapsibleCard>
    </>
  );
};

export default CostInputForm;
