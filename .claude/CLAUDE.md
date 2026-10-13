# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Client-side React 18 + TypeScript (Create React App) tool that compares health plans for open enrollment. No backend. Multi-company: each company's plans live in `data/companies/<slug>/` and are served at `/<slug>`. Users enter expected healthcare usage; the app computes total annual cost per plan and charts it.

## Commands

```bash
npm start                 # build-data, then dev server (http://localhost:3000/<slug>)
npm run build             # build-data, then production build
npm run build-data        # validate data/**/*.yml, regenerate src/generated
npm test                  # Jest via react-scripts (watch mode)
npm test -- --watchAll=false costCalculator          # one file / name pattern
npm test -- --watchAll=false -t "some test name"     # one test by name
npm run lint              # eslint (lint:fix to autofix)
npm run format:check      # prettier (format to write)
npx tsc --noEmit          # type check; ignore jest-type errors in __tests__ (no @types/jest installed)
```

Run `npm run build-data` before `npm test` or `tsc` on a fresh checkout. The project `.npmrc` pins public npmjs (overrides a corporate registry in `~/.npmrc`).. `src/generated/` is gitignored and tests import from it.

## Architecture

**Data pipeline (YAML to generated code).** All data lives in `data/`:

- `irs/<year>.yml`: federal HSA/FSA limits and payroll tax rates, shared by every company.
- `categories.yml`: shared category catalog (id to name, description, `preventive`). A company's own `categories.yml` can add or override ids.
- `companies/<slug>/company.yml`: display name and optional help copy/links. `plan_years/<year>.yml`: that company's plans. `sources/`: reference docs the numbers came from.
- `companies/_template/`: annotated starting point for new companies. It is validated but never emitted.
- `schema/*.json`: JSON Schemas for every file type; each YAML starts with a `yaml-language-server` line pointing at its schema.

`scripts/build-data.js` validates each file with ajv, cross-checks (year matches file name, IRS file exists for the year, every plan category id exists, no duplicate plan names), and fails with `file: /path message` lines. It merges IRS limits + categories + plans into one `PlanData` per company and year and writes `src/generated/{companyData.json,dataHelpers.ts}`. Never edit `src/generated/`. Contributor steps are in `CONTRIBUTING.md`.

**Routing (no router library).** `App.tsx` reads the company slug from the first URL path segment (`readCompanySlugFromPath`). Known slug renders `CompanyApp`; empty or unknown renders `CompanyChooser`, a list of companies linking to `/<slug>`. `public/_redirects` makes Netlify serve `index.html` for every path.

**Data flow.** `CompanyApp.tsx` holds all state (`UserInputs`). `planDataService.ts` wraps the generated helpers (all take the company slug) and holds HSA/FSA rules (`isHSAQualified` decides HSA vs FSA treatment from deductible thresholds, not from a plan flag). On "Compare", `calculateAllPlans` (`utils/costCalculator.ts`) returns results sorted by total cost. `ResultsTable`, `CostComparisonChart`, and the ledger modal (`FAQButton`) render from `PlanResult`. Company-specific copy (name, claims portal, estimator link, FSA name) comes from the `Company` object, never hardcoded in components.

**Cost engine (`utils/costCalculator.ts`).** `PlanExecution` simulates a year of expenses one visit at a time, tracking running deductible and OOP-max state, so order matters. Category display info comes from `planData.categories`. Total cost = net premiums + out-of-pocket - HSA/FSA tax savings - employer contribution. Key behaviors:

- Benefits resolve as `plan.default` overlaid with `plan.categories[id]`, per network (`in_network_coverage` / `out_of_network_coverage`).
- Per-category `qty_cap` (visits) and `cost_cap` (dollars): overflow is billed 100% to the user, still counts toward OOP max, and is labeled `[Over visit limit]` / `[Over cost limit]` in the ledger.
- Deductible flags `requires_deductible_to_be_met`, `contributes_to_deductible`, `contributes_to_out_of_pocket_max` default from whether the plan has a deductible.
- `prescriptions_subject_to_deductible` applies only to categories whose id starts with `pharmacy_`.
- `two_party` and `family` coverage both use the family deductible and OOP max.
- Tax savings and the pre-tax premium discount use income tax rate plus Social Security and Medicare rates.
- Every step is written to an `OrganizedLedger` that powers the "show work" view, so new cost logic needs ledger entries too.

**Chart (`utils/chartDataGenerator.ts`).** Re-runs `calculateAllPlans` across a sweep of spending levels to draw the cost curves.

**Shareable state (`utils/urlParams.ts`).** Inputs round-trip through the query string (category estimates as JSON), on top of the `/<slug>` path. `Compare` rewrites the URL; the share link adds `showResults=true`, which auto-runs the comparison on load. The `year` param is accepted only if the company has data for it.

## Conventions

- No backwards compatibility: old URLs and data layouts may break freely.
- Tests for year-specific data are named `*.test.2026.ts` and live in `src/utils/__tests__/`; they load real data with `loadPlanData('dmba', 2026)`.
- Use `// eslint-disable-next-line no-console` for intentional console output (lint rule); the build script does this.
