import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import CollapsibleCard from './CollapsibleCard';
import { PlanData, UserInputs } from '../types';
import { tracksPeople, rowsWithoutPerson } from '../utils/people';
import { isCoveredByInsurance } from '../utils/costCalculator';

/** Where the important notes live, so other parts of the page can bring them into view */
export const ESTIMATE_NOTES_ID = 'estimate-notes';

interface EstimateNotesProps {
  planData: PlanData;
  userInputs: UserInputs;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** How far to trust the totals, above the results, in plain words */
const EstimateNotes: React.FC<EstimateNotesProps> = ({
  planData,
  userInputs,
  open,
  onOpenChange,
}) => {
  const withPeople = tracksPeople(userInputs.coverage);
  const unassigned = rowsWithoutPerson(userInputs, categoryId =>
    isCoveredByInsurance(planData.categories, categoryId)
  );
  return (
    <CollapsibleCard
      id={ESTIMATE_NOTES_ID}
      title="Important notes"
      titleClassName="h6 mb-0"
      className="mb-3"
      icon={<FontAwesomeIcon icon={faCircleExclamation} className="text-warning" fixedWidth />}
      open={open}
      onOpenChange={onOpenChange}
    >
      <div className="small">
        {unassigned > 0 && (
          <p>
            <strong>Tell us who each cost is for.</strong> Each person in your family has their own
            yearly limit. Once they reach it, the plan pays the rest of their bills. Some of your
            costs are marked "Not sure," so we can't count them toward anyone's limit. That can make
            your totals look higher than they really are.
          </p>
        )}
        {withPeople && (
          <>
            <p>
              <strong>
                The order your medical care happens in can sometimes change what you pay.
              </strong>{' '}
              Plans have an individual out-of-pocket max and a family out-of-pocket max. If one of
              you reaches his or her individual out-of-pocket max, but the family as a whole does
              not reach the family out-of-pocket max, the order of your care can make a big
              difference in what you pay for the year.
            </p>
            <p>
              Let's take a simple example. Suppose a couple's plan has a family deductible. This
              year, the wife will have one big bill, like a surgery, and the husband will have a few
              smaller ones.
            </p>
            <p>
              Suppose her surgery happens at the beginning of the year. That one big bill meets the
              family deductible and her out-of-pocket max all at once. For the rest of the year, her
              care is free, and because the deductible is already met, her husband's care is
              discounted.
            </p>
            <p>
              On the other hand, suppose her surgery happens at the <em>end</em> of the year. Now
              his care comes first, so he pays full price until he meets the deductible himself. Her
              surgery still reaches her out-of-pocket max, so she pays the same either way. He pays
              more, and nothing makes up for it. We don't know when your care will happen, so if two
              plans are close, treat them as a tie.
            </p>
          </>
        )}
        <p className="mb-0">
          <strong>PPO plans are an approximation.</strong> On a PPO plan, many visits cost a small
          set fee (a copay) once you've met your deductible. Before that, you pay the full price of
          each visit. So which visits happen before you meet your deductible changes what you pay
          for the year. And once it's met, a single $2,000 visit with a $35 copay costs you just
          $35, far less than the same $2,000 spread across 10 visits, each with its own copay. To
          approximate this, we spread your visits evenly across the year. If most of your care comes
          early or late in the year, a PPO plan could cost a little more or less than we show.
        </p>
      </div>
    </CollapsibleCard>
  );
};

export default EstimateNotes;
