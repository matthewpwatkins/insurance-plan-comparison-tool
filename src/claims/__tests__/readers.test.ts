import companySchema from '../../../data/schema/company.schema.json';
import { CLAIMS_READERS } from '../readers';

describe('claims readers', () => {
  it('has a reader for every format company.yml may name', () => {
    const formats = companySchema.properties.claims_report.properties.format.enum;
    expect(Object.keys(CLAIMS_READERS).sort()).toEqual([...formats].sort());
  });
});
