import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const SCRIPT = path.join(__dirname, '../../../scripts/build-data.js');
const FIXTURES = path.join(__dirname, 'fixtures');

const runBuild = (dataDir: string) => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-data-'));
  const result = spawnSync('node', [SCRIPT], {
    env: { ...process.env, DATA_DIR: dataDir, OUTPUT_DIR: outputDir },
    encoding: 'utf8',
  });
  return { ...result, outputDir };
};

describe('build-data', () => {
  it('builds a valid company', () => {
    const { status, outputDir } = runBuild(path.join(FIXTURES, 'good-data'));

    expect(status).toBe(0);
    const data = JSON.parse(fs.readFileSync(path.join(outputDir, 'companyData.json'), 'utf8'));
    expect(data['tiny-co'].company).toEqual({ slug: 'tiny-co', name: 'Tiny Co' });
    expect(data['tiny-co'].years['2026'].plans).toHaveLength(1);
    expect(data['tiny-co'].years['2026'].hsa_contribution_limits).toBeDefined();
    expect(data['tiny-co'].years['2026'].healthcare_price_increase).toBe(3.5);
    expect(data['tiny-co'].years['2026'].categories.office_visit_pcp).toBeDefined();
  });

  it('builds the real data, including the template', () => {
    const { status, stdout } = runBuild(path.join(__dirname, '../../../data'));

    expect(status).toBe(0);
    expect(stdout).toContain('dmba (2025, 2026)');
    expect(stdout).not.toContain('_template');
  });

  it('rejects a broken company with file-level messages', () => {
    const { status, stderr } = runBuild(path.join(FIXTURES, 'bad-data'));
    const planFile = 'companies/bad-co/plan_years/2026.yml';

    expect(status).toBe(1);
    expect(stderr).toContain('companies/bad-co/company.yml');
    expect(stderr).toContain('must NOT have additional properties "logo"');
    expect(stderr).toContain(
      `${planFile}: /plans/0/monthly_premiums must have required property 'family'`
    );
    expect(stderr).toContain(
      `${planFile}: /plans/0/default/in_network_coverage/coinsurance must be <= 1`
    );
  });

  it('flags a category id missing from the catalog', () => {
    const { status, stderr } = runBuild(path.join(FIXTURES, 'unknown-category-data'));

    expect(status).toBe(1);
    expect(stderr).toContain('unknown category "made_up_category"');
  });

  it('flags a claims report label that maps to an unknown category', () => {
    const { status, stderr } = runBuild(path.join(FIXTURES, 'unknown-category-data'));

    expect(status).toBe(1);
    expect(stderr).toContain(
      'companies/odd-co/company.yml: claims_report label "OFFICE VISIT" uses unknown category "imaginary_visit"'
    );
  });

  it('requires a healthcare price increase in each IRS year', () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-data-src-'));
    fs.cpSync(path.join(FIXTURES, 'good-data'), dataDir, { recursive: true });
    const irsFile = path.join(dataDir, 'irs', '2026.yml');
    fs.writeFileSync(
      irsFile,
      fs.readFileSync(irsFile, 'utf8').replace(/^healthcare_price_increase:.*$/m, '')
    );

    const { status, stderr } = runBuild(dataDir);

    expect(status).toBe(1);
    expect(stderr).toContain("must have required property 'healthcare_price_increase'");
  });
});
