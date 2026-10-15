# Adding your company

Plans live in YAML files under `data/`. Add a folder, open a pull request, and your company gets its own page at `/<your-company-slug>`.

## Steps

1. Copy `data/companies/_template/` to `data/companies/<slug>/`. The slug is lowercase letters, digits, and dashes, and becomes the URL.
2. Edit `company.yml`: display name plus the optional help links.
3. Add `plan_years/<year>.yml` for each plan year, using your Summary of Benefits and Coverage (SBC) and rate sheet as the source. Keep those documents in `sources/` next to the plans so reviewers can check the numbers.
4. Run `npm run build-data`. It checks every file and prints the file and field of any mistake.
5. Run `npm start`, open `http://localhost:3000/<slug>`, and compare a few scenarios against what your benefits site shows.
6. Open a pull request. CI runs the same checks.

## Reading an SBC into the format

| SBC says                                 | File field                                               |
| ---------------------------------------- | -------------------------------------------------------- |
| Monthly employee premium, by tier        | `monthly_premiums` (`single`, `two_party`, `family`)     |
| Deductible, individual / family          | `annual_deductible.<network>.single` / `.family`         |
| Out-of-pocket limit, individual / family | `out_of_pocket_maximum.<network>.individual` / `.family` |
| "20% coinsurance"                        | `coinsurance: 0.2` (the share the member pays)           |
| "$25 copay"                              | `copay: 25`                                              |
| "No charge"                              | `is_free: true`                                          |
| "Limited to 12 visits"                   | `qty_cap: 12`                                            |
| "Up to $1,200 per year"                  | `cost_cap: 1200`                                         |
| Employer HSA seed money                  | `employer_hsa_contribution`                              |

List only the categories that differ from `default`. Category ids come from `data/categories.yml`; add new ones there (or in your company's own `categories.yml`) rather than reusing a close match.

## Reading claims reports

If your insurer's website exports a claims report as a PDF, people can load it in the guided setup and get cost estimates from their own history. The file is read in the browser and never uploaded.

1. **Find or add a reader for the layout.** Readers live in `src/claims/readers/`, one per insurer report layout (not per company, so every employer on the same insurer shares one). Each turns the PDF's text lines into charges: date, patient, provider, the insurer's service label, and the negotiated price (plan paid plus member owed). Copy `dmbaEob.ts`, register it in `readers/index.ts`, and add its format id to the `claims_report.format` enum in `data/schema/company.schema.json`.
2. **Test it on made-up text** in `src/claims/__tests__/`, like `dmbaEob.test.ts`. Never commit a real report.
3. **Check it against your own report** without committing it:
   ```bash
   CLAIMS_PDF=/path/to/report.pdf CLAIMS_COMPANY=<slug> CLAIMS_TOTAL=<paid + owed total> \
     npm test -- --watchAll=false realReport
   ```
   It prints how many claims it read, every service label in the report, and how many rows land in each category (no names, so it's safe to share), and fails if the total doesn't match the one on the insurer's summary report.
4. **Map the insurer's service labels** to categories under `claims_report.service_map` in `company.yml`, default first. A label with several choices (like "OFFICE VISIT": primary care or specialist) is shown to the person to confirm for each provider. Charges the report marks as preventive map through `preventive_map` instead, and each preventive claim counts as one visit. Labels for small charges billed alongside a visit, like supplies, go in `add_to_main_service` so their cost joins that visit. The build fails if a mapping names an unknown category.

## Shared federal numbers

`data/irs/<year>.yml` holds the HSA, FSA, and payroll tax limits every company shares. If your plan year has no file yet, add one from the IRS's published limits.

## Editor help

Each YAML file starts with a `yaml-language-server` schema line, so editors with the YAML extension autocomplete field names and flag typos as you type.
