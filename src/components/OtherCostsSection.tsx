import React from 'react';
import { Card } from 'react-bootstrap';
import CostInputRow from './CostInputRow';
import HelpIcon from './HelpIcon';
import { UserInputs } from '../types';

interface OtherCostsSectionProps {
  inputs: UserInputs;
  onChange: (updates: Partial<UserInputs>) => void;
}

const OtherCostsSection: React.FC<OtherCostsSectionProps> = ({ inputs, onChange }) => {
  const updateOtherCosts = (field: 'inNetworkCost' | 'outOfNetworkCost', value: number) => {
    onChange({
      costs: {
        ...inputs.costs,
        otherCosts: {
          inNetworkCost: field === 'inNetworkCost' ? value : (inputs.costs.otherCosts?.inNetworkCost || 0),
          outOfNetworkCost: field === 'outOfNetworkCost' ? value : (inputs.costs.otherCosts?.outOfNetworkCost || 0)
        }
      }
    });
  };

  return (
    <Card className="mb-3">
      <Card.Body>
        <h6 className="d-flex justify-content-between align-items-center mb-3">
          <span>"Other" Covered Costs</span>
          <HelpIcon
            title="Other Covered Healthcare Costs"
            content={
              <div>
                <p>This section is for <strong>additional healthcare costs</strong> that don't fit into specific categories you've added above.</p>
                <p><strong>What to include here:</strong></p>
                <ul>
                  <li>General medical services not covered by your specific categories</li>
                  <li>Unexpected or miscellaneous healthcare needs</li>
                  <li>Additional visits beyond what you've estimated in categories</li>
                  <li>Services that fall under general medical coverage</li>
                </ul>
                <p><strong>How it works:</strong></p>
                <ul>
                  <li>Uses your plan's default coinsurance rates after deductible</li>
                  <li>Separate from the specific categories you've defined</li>
                  <li>Helps account for unpredictable healthcare costs</li>
                </ul>
                <p>If you've already captured all your expected healthcare costs in the categories above, you can leave this at $0.</p>
              </div>
            }
          />
        </h6>
        <CostInputRow
          inNetworkValue={inputs.costs.otherCosts?.inNetworkCost || 0}
          outOfNetworkValue={inputs.costs.otherCosts?.outOfNetworkCost || 0}
          onInNetworkChange={(value) => updateOtherCosts('inNetworkCost', value)}
          onOutOfNetworkChange={(value) => updateOtherCosts('outOfNetworkCost', value)}
          inNetworkHelpTitle="In-Network Costs"
          outOfNetworkHelpTitle="Out-of-Network Costs"
          inNetworkHelpContent={
            <div>
              <p>Estimate your annual healthcare costs when using <strong>in-network</strong> providers.</p>
              <p><strong>In-network providers:</strong></p>
              <ul>
                <li>Have contracts with your insurance plan</li>
                <li>Offer lower costs and better coverage</li>
                <li>Apply toward your deductible and out-of-pocket maximum</li>
              </ul>
              <p><strong>Include costs like:</strong></p>
              <ul>
                <li>Medical services not covered by specific categories</li>
                <li>Additional visits beyond what you've specified</li>
                <li>Unexpected medical needs</li>
              </ul>
              <p>This uses your plan's default coinsurance rates after deductible.</p>
            </div>
          }
          outOfNetworkHelpContent={
            <div>
              <p>Estimate your annual healthcare costs when using <strong>out-of-network</strong> providers.</p>
              <p><strong>Out-of-network providers:</strong></p>
              <ul>
                <li>Don't have contracts with your insurance plan</li>
                <li>Result in higher costs and less coverage</li>
                <li>May have separate deductibles and out-of-pocket maximums</li>
              </ul>
              <p><strong>Important considerations:</strong></p>
              <ul>
                <li>You may pay significantly more</li>
                <li>You might need to pay upfront and get reimbursed</li>
                <li>Some plans don't cover out-of-network care at all</li>
              </ul>
              <p>Leave at $0 if you plan to stay in-network. This uses your plan's out-of-network coinsurance rates.</p>
            </div>
          }
        />
      </Card.Body>
    </Card>
  );
};

export default OtherCostsSection;