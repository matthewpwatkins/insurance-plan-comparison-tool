import React from 'react';
import { Card, Form } from 'react-bootstrap';
import BasicInfoSection from './BasicInfoSection';
import HealthcareCategoriesSection from './HealthcareCategoriesSection';
import OtherCostsSection from './OtherCostsSection';
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

      <Card className="mb-4">
        <Card.Header>
          <h3>Healthcare Cost Estimates</h3>
        </Card.Header>
        <Card.Body>
          <Form>
            <OtherCostsSection
              inputs={inputs}
              onChange={onChange}
            />

            <HealthcareCategoriesSection
              inputs={inputs}
              onChange={onChange}
            />
          </Form>
        </Card.Body>
      </Card>
    </>
  );
};

export default CostInputForm;