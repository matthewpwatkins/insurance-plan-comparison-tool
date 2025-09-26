import React from 'react';
import { Card } from 'react-bootstrap';
import NetworkVisitsInputRow from './NetworkVisitsInputRow';
import HelpIcon from './HelpIcon';
import { UserInputs } from '../types';

interface OtherCostsSectionProps {
  inputs: UserInputs;
  onChange: (updates: Partial<UserInputs>) => void;
}

const OtherCostsSection: React.FC<OtherCostsSectionProps> = ({ inputs, onChange }) => {
  const updateOtherCosts = (network: 'inNetwork' | 'outOfNetwork', value: any) => {
    onChange({
      costs: {
        ...inputs.costs,
        otherCosts: {
          inNetwork: network === 'inNetwork' ? value : (inputs.costs.otherCosts?.inNetwork || { quantity: 0, costPerVisit: 0 }),
          outOfNetwork: network === 'outOfNetwork' ? value : (inputs.costs.otherCosts?.outOfNetwork || { quantity: 0, costPerVisit: 0 })
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
        <NetworkVisitsInputRow
          inNetworkValue={inputs.costs.otherCosts?.inNetwork || { quantity: 0, costPerVisit: 0 }}
          outOfNetworkValue={inputs.costs.otherCosts?.outOfNetwork || { quantity: 0, costPerVisit: 0 }}
          onInNetworkChange={(value) => updateOtherCosts('inNetwork', value)}
          onOutOfNetworkChange={(value) => updateOtherCosts('outOfNetwork', value)}
          inNetworkHelpTitle="In-Network Other Visits"
          outOfNetworkHelpTitle="Out-of-Network Other Visits"
          inNetworkHelpContent={
            <div>
              <p>Other healthcare visits using <strong>in-network</strong> providers beyond your specific categories.</p>
              <p><strong>Consider:</strong></p>
              <ul>
                <li>Unexpected medical visits</li>
                <li>Additional services not in your categories</li>
                <li>Urgent care or walk-in clinic visits</li>
                <li>Lab work or imaging not elsewhere categorized</li>
              </ul>
              <p><strong>In-network benefits:</strong></p>
              <ul>
                <li>Lower costs with contracted rates</li>
                <li>Better coverage under your plan</li>
                <li>Predictable copays or coinsurance</li>
              </ul>
            </div>
          }
          outOfNetworkHelpContent={
            <div>
              <p>Other healthcare visits using <strong>out-of-network</strong> providers beyond your specific categories.</p>
              <p><strong>Consider:</strong></p>
              <ul>
                <li>Emergency care (often covered at in-network rates)</li>
                <li>Specialists not available in-network</li>
                <li>Care received while traveling</li>
                <li>Services from preferred providers outside network</li>
              </ul>
              <p><strong>Important notes:</strong></p>
              <ul>
                <li>Higher out-of-pocket costs</li>
                <li>May require pre-authorization</li>
                <li>Some plans don't cover out-of-network care</li>
                <li>You might pay upfront and seek reimbursement</li>
              </ul>
            </div>
          }
        />
      </Card.Body>
    </Card>
  );
};

export default OtherCostsSection;