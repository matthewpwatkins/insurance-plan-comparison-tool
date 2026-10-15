import { ClaimCharge } from './types';
import { CategoryEstimate, ClaimsReport } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** One visit: the charges a claim has for one service on one day, summed. */
export interface ClaimVisit {
  patient: string;
  provider: string;
  service: string;
  date: string;
  cost: number;
  inNetwork: boolean;
  /** Covered in full as preventive care, so it maps through preventive_map */
  preventive: boolean;
}

export interface PreparedClaims {
  visits: ClaimVisit[];
  /** First and last service dates in the report, used to turn totals into a yearly rate */
  firstDate: string;
  lastDate: string;
}

/**
 * One person's visits to one provider for one kind of service: a row the person reviews
 * and decides whether, and how much of it, to carry into next year.
 */
export interface PastExpense {
  key: string;
  patient: string;
  provider: string;
  service: string;
  preventive: boolean;
  inNetwork: boolean;
  /** Oldest first */
  visits: ClaimVisit[];
  total: number;
  /** Candidate categories from company.yml; the first is the default, empty if unknown */
  choices: string[];
}

/** What the person decided for one past expense. */
export interface CarryOver {
  include: boolean;
  categoryId: string | null;
  quantity: number;
  costPerVisit: number;
}

const yearFraction = (isoDate: string): number => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  return date.getUTCFullYear() + (date.getTime() - start) / (365.25 * DAY_MS);
};

/**
 * Turns raw charges into visits. Zero-dollar charges (denied or reversed) drop out, and
 * charges like supplies fold into the claim's main service so a surgery counts as one
 * visit with its full price. A claim's preventive and other services stay separate visits,
 * since they land in different categories.
 */
export const prepareClaims = (charges: ClaimCharge[], report: ClaimsReport): PreparedClaims => {
  const dates = charges.map(charge => charge.date).sort();
  const addToMain = new Set(report.add_to_main_service ?? []);
  const byClaim = new Map<string, ClaimCharge[]>();

  for (const charge of charges) {
    if (charge.allowed === 0) continue;
    const list = byClaim.get(charge.claimId) ?? [];
    list.push({ ...charge });
    byClaim.set(charge.claimId, list);
  }

  const largest = (list: ClaimCharge[]) => list.reduce((a, b) => (b.allowed > a.allowed ? b : a));
  const addTo = (target: ClaimCharge, extras: ClaimCharge[]) => {
    target.allowed += extras.reduce((sum, charge) => sum + charge.allowed, 0);
  };

  const visits = new Map<string, ClaimVisit>();
  byClaim.forEach((claimCharges, claimId) => {
    // A preventive claim is one checkup: its labs and shots join its biggest preventive charge.
    const preventive = claimCharges.filter(charge => charge.preventive);
    const checkup = preventive.length > 0 ? largest(preventive) : undefined;
    if (checkup) {
      addTo(
        checkup,
        preventive.filter(charge => charge !== checkup)
      );
    }

    // Other charges: add-ons like supplies join the claim's biggest main service. Add-ons
    // with no main service of their own join the checkup, since they came with it.
    const other = claimCharges.filter(charge => !charge.preventive);
    const main = other.filter(charge => !addToMain.has(charge.service));
    const extras = other.filter(charge => addToMain.has(charge.service));
    const host = main.length > 0 ? largest(main) : checkup;
    if (host) addTo(host, extras);
    const kept = [...(checkup ? [checkup] : []), ...main, ...(host ? [] : extras)];

    for (const charge of kept) {
      const key = [claimId, charge.preventive, charge.date, charge.service, charge.inNetwork].join(
        '|'
      );
      const visit = visits.get(key);
      if (visit) {
        visit.cost += charge.allowed;
      } else {
        visits.set(key, {
          patient: charge.patient,
          provider: charge.provider,
          service: charge.service,
          date: charge.date,
          cost: charge.allowed,
          inNetwork: charge.inNetwork,
          preventive: charge.preventive,
        });
      }
    }
  });

  return {
    visits: Array.from(visits.values()).filter(visit => visit.cost > 0),
    firstDate: dates[0] ?? '',
    lastDate: dates[dates.length - 1] ?? '',
  };
};

/**
 * Keeps only visits in the last `months` months of the report, counting back from its
 * latest service date, so estimates can come from just the most recent year.
 */
export const limitToRecent = (prepared: PreparedClaims, months: number): PreparedClaims => {
  if (!prepared.lastDate) return prepared;
  const start = new Date(`${prepared.lastDate}T00:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() - months);
  start.setUTCDate(start.getUTCDate() + 1);
  const cutoff = start.toISOString().slice(0, 10);
  const firstDate = cutoff > prepared.firstDate ? cutoff : prepared.firstDate;
  return {
    visits: prepared.visits.filter(visit => visit.date >= firstDate),
    firstDate,
    lastDate: prepared.lastDate,
  };
};

/** How many years the report covers, at least one, for turning visit counts into a yearly rate. */
export const yearsCovered = (prepared: PreparedClaims): number => {
  const spanDays =
    (Date.parse(prepared.lastDate) - Date.parse(prepared.firstDate)) / DAY_MS + 1 || 0;
  return Math.max(1, spanDays / 365.25);
};

/** Groups visits into past expenses, by person and then biggest total first. */
export const groupPastExpenses = (visits: ClaimVisit[], report: ClaimsReport): PastExpense[] => {
  const groups = new Map<string, PastExpense>();
  for (const visit of visits) {
    const key = [
      visit.patient,
      visit.provider,
      visit.service,
      visit.preventive,
      visit.inNetwork,
    ].join('|');
    const group = groups.get(key);
    if (group) {
      group.visits.push(visit);
      group.total += visit.cost;
    } else {
      const map = visit.preventive ? (report.preventive_map ?? {}) : report.service_map;
      groups.set(key, {
        key,
        patient: visit.patient,
        provider: visit.provider,
        service: visit.service,
        preventive: visit.preventive,
        inNetwork: visit.inNetwork,
        visits: [visit],
        total: visit.cost,
        choices: map[visit.service] ?? [],
      });
    }
  }
  const expenses = Array.from(groups.values());
  expenses.forEach(expense => expense.visits.sort((a, b) => a.date.localeCompare(b.date)));
  return expenses.sort((a, b) => a.patient.localeCompare(b.patient) || b.total - a.total);
};

export interface CarryOverOptions {
  planYear: number;
  years: number;
  /** Yearly price increase in percent */
  inflationRate: number;
}

/**
 * The starting suggestion for one past expense: its default category, its visits per year
 * averaged over the report, and its average price grown by inflation from the visits'
 * average date to the middle of the plan year.
 */
export const suggestCarryOver = (
  expense: PastExpense,
  { planYear, years, inflationRate }: CarryOverOptions
): CarryOver => {
  const count = expense.visits.length;
  const averageDate = expense.visits.reduce((sum, v) => sum + yearFraction(v.date), 0) / count;
  const growth = Math.pow(1 + inflationRate / 100, Math.max(0, planYear + 0.5 - averageDate));
  const categoryId = expense.choices[0] ?? null;
  return {
    include: categoryId !== null,
    categoryId,
    quantity: Math.max(1, Math.round(count / years)),
    costPerVisit: Math.round((expense.total / count) * growth),
  };
};

const titleCase = (text: string): string =>
  text.toLowerCase().replace(/(^|[\s/&-])([a-z])/g, (_, gap, letter) => gap + letter.toUpperCase());

/** "Jane: Pat Q Example, office visit", for the estimate's notes. */
export const describeExpense = (expense: PastExpense): string => {
  const firstName = titleCase(expense.patient.split(' ')[0] ?? '');
  const service = expense.service.toLowerCase();
  return `${firstName}: ${titleCase(expense.provider)}, ${service}`.slice(0, 100);
};

/** One estimate per past expense the person kept. */
export const estimatesFromCarryOvers = (
  expenses: PastExpense[],
  decisions: Record<string, CarryOver>
): CategoryEstimate[] =>
  expenses.reduce<CategoryEstimate[]>((estimates, expense) => {
    const decision = decisions[expense.key];
    if (decision?.include && decision.categoryId && decision.quantity > 0) {
      estimates.push({
        categoryId: decision.categoryId,
        estimate: {
          quantity: decision.quantity,
          costPerVisit: decision.costPerVisit,
          isInNetwork: expense.inNetwork,
        },
        notes: describeExpense(expense),
      });
    }
    return estimates;
  }, []);
