import React from 'react';
import { Table } from 'react-bootstrap';

const FEDERAL_RATE_URL = 'https://tax-visualizer.watkins.dev/';
const STATE_RATE_URL = 'https://ustax.tools/state-income-tax-calculator/';

const link = (url: string, text: string) => (
  <a href={url} target="_blank" rel="noopener noreferrer">
    {text}
  </a>
);

/**
 * How to work out a combined marginal income tax rate. Shared by the guided setup and
 * the tax rate help popup on the full form.
 */
const TaxRateGuide: React.FC = () => (
  <div>
    <p>
      Add up the tax rate you pay on your <em>last</em> dollar of income (your "marginal" rate) for
      each kind of income tax:
    </p>
    <Table size="sm" className="mb-3">
      <tbody>
        <tr>
          <th className="text-nowrap">Federal</th>
          <td>Find your bracket with the {link(FEDERAL_RATE_URL, 'tax visualizer')}.</td>
        </tr>
        <tr>
          <th className="text-nowrap">State</th>
          <td>
            Find your rate with the {link(STATE_RATE_URL, 'state income tax calculator')}. Use 0 if
            your state has no income tax.
          </td>
        </tr>
        <tr>
          <th className="text-nowrap">City or county</th>
          <td>
            Add it if you pay one (for example New York City, many Ohio cities, or Maryland
            counties). Most people don't.
          </td>
        </tr>
        <tr>
          <th className="text-nowrap">Social Security and Medicare</th>
          <td>Leave these out. We add them for you.</td>
        </tr>
      </tbody>
    </Table>
    <p className="mb-2">
      <strong>Example:</strong> a married couple living in Lehi, Utah, in the 22% federal bracket:
      22% federal + 4.45% Utah + 0% Lehi = <strong>26.45%</strong>.
    </p>
    <p className="small text-muted mb-0">
      We apply this rate to all of your tax savings. If you are at the very lowest end of your tax
      bracket, your real savings may be a little lower.
    </p>
  </div>
);

export default TaxRateGuide;
