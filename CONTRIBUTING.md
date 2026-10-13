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

## Shared federal numbers

`data/irs/<year>.yml` holds the HSA, FSA, and payroll tax limits every company shares. If your plan year has no file yet, add one from the IRS's published limits.

## Editor help

Each YAML file starts with a `yaml-language-server` schema line, so editors with the YAML extension autocomplete field names and flag typos as you type.
