# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Client-side React 18 + TypeScript (Create React App) tool that compares DMBA health plans (HSA/PPO) for open enrollment. No backend. Users enter expected healthcare usage; the app computes total annual cost per plan and charts it.

## Commands

```bash
npm start                 # build-data, then dev server
npm run build             # build-data, then production build
npm run build-data        # regenerate src/generated from data/*.yml
npm test                  # Jest via react-scripts (watch mode)
npm test -- --watchAll=false costCalculator          # one file / name pattern
npm test -- --watchAll=false -t "some test name"     # one test by name
npm run lint              # eslint (lint:fix to autofix)
npm run format:check      # prettier (format to write)
```

Run `npm run build-data` before `npm test` or `tsc` on a fresh checkout. `src/generated/` is gitignored and tests import from it.

## Architecture

**Data pipeline (YAML to generated code).** All plan data lives in `data/`:
- `data/plan_years/<year>.yml`: IRS limits, payroll tax rates, and every plan's premiums, deductibles, OOP maximums, and per-category benefits.
- `data/categories.yml`: category id to display name, description, `preventive` flag.
- `data/sources/`: reference notes (plan summaries) the YAML was transcribed from.

`scripts/build-data.js` discovers every `<year>.yml`, then writes `src/generated/{planDataByYear.json,categoriesData.json,dataHelpers.ts}`. Never edit `src/generated/`. Adding a plan year means adding a YAML file, but see the year allowlist gotcha below.

**Data flow.** `App.tsx` holds all state (`UserInputs`). `planDataService.ts` wraps the generated helpers and holds HSA/FSA rules (`isHSAQualified` decides HSA vs FSA treatment from deductible thresholds, not from a plan flag). On "Compare", `calculateAllPlans` (`utils/costCalculator.ts`) returns results sorted by total cost. `ResultsTable`, `CostComparisonChart`, and the ledger modal (`FAQButton`) render from `PlanResult`.

**Cost engine (`utils/costCalculator.ts`).** `PlanExecution` simulates a year of expenses one visit at a time, tracking running deductible and OOP-max state, so order matters. Total cost = net premiums + out-of-pocket - HSA/FSA tax savings - employer contribution. Key behaviors:
- Benefits resolve as `plan.default` overlaid with `plan.categories[id]`, per network (`in_network_coverage` / `out_of_network_coverage`).
- Per-category `qty_cap` (visits) and `cost_cap` (dollars): overflow is billed 100% to the user, still counts toward OOP max, and is labeled `[Over visit limit]` / `[Over cost limit]` in the ledger.
- Deductible flags `requires_deductible_to_be_met`, `contributes_to_deductible`, `contributes_to_out_of_pocket_max` default from whether the plan has a deductible.
- `prescriptions_subject_to_deductible` applies only to categories whose id starts with `pharmacy_`.
- `two_party` and `family` coverage both use the family deductible and OOP max.
- Tax savings and the pre-tax premium discount use income tax rate plus Social Security and Medicare rates.
- Every step is written to an `OrganizedLedger` that powers the "show work" view, so new cost logic needs ledger entries too.

**Chart (`utils/chartDataGenerator.ts`).** Re-runs `calculateAllPlans` across a sweep of spending levels to draw the cost curves.

**Shareable state (`utils/urlParams.ts`).** Inputs round-trip through the query string (category estimates as JSON). `Compare` rewrites the URL; the share link adds `showResults=true`, which auto-runs the comparison on load.

## Gotchas

- `urlParamsToUserInputs` hardcodes `year === '2025' || '2026'`. A new plan year is silently ignored from URLs until that check is updated.
- Test files for year-specific data are named `*.test.2026.ts` and live in `src/utils/__tests__/`.
- Use `// eslint-disable-next-line no-console` for intentional console output (lint rule); the build script does this.
