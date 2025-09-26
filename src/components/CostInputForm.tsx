import React from 'react';
import { Card, Form } from 'react-bootstrap';
import BasicInfoSection from './BasicInfoSection';
import HSAFSASection from './HSAFSASection';
import HealthcareCategoriesSection from './HealthcareCategoriesSection';
import { UserInputs, PlanData } from '../types';

interface CostInputFormProps {
  inputs: UserInputs;
  onChange: (updates: Partial<UserInputs>) => void;
  planData: PlanData | null;
}

const CostInputForm: React.FC<CostInputFormProps> = ({ inputs, onChange, planData }) => {
  return (
    <>
      <BasicInfoSection
        inputs={inputs}
        onChange={onChange}
        planData={planData}
      />

      <HSAFSASection
        inputs={inputs}
        onChange={onChange}
        planData={planData}
      />

      <div className="mb-4">
        <h3>Annual Cost Estimates</h3>
        <p className="text-muted mb-4">
          No way around it, you have to use your magic ball now. Don't fret about getting it exact, just take a guess and use your previous health history and EOBs to estimate how many times you'll need each service and how much is the DMBA-negotiated rate on average.
        </p>
        <Form>
          <HealthcareCategoriesSection
            inputs={inputs}
            onChange={onChange}
            planData={planData}
          />
        </Form>
      </div>
    </>
  );
};

export default CostInputForm;