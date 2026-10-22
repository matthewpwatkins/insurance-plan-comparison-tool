import React from 'react';
import { Alert } from 'react-bootstrap';

/**
 * Warns people 55 and up that Medicare can make HSA deposits count against them: Medicare coverage
 * can be backdated up to 6 months, and nobody on Medicare may put money in an HSA.
 */
const MedicareNote: React.FC<{ className?: string }> = ({ className = '' }) => (
  <Alert variant="info" className={`small py-2 ${className}`}>
    <strong>Retiring or signing up for Medicare soon?</strong> If you sign up for Medicare
    (including through Social Security) during or soon after this plan year, your Medicare coverage
    can be backdated up to 6 months. HSA deposits made during those months, including your
    employer's, can trigger a tax penalty. Talk to your HSA provider or a fiduciary financial
    advisor before choosing an HSA plan.
  </Alert>
);

export default MedicareNote;
