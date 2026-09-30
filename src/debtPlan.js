// Debt payoff planner: one monthly budget, paid in a chosen order, with rollover.
//
// The budget is every debt's monthly payment plus the extra. Each month every
// debt accrues interest, every open debt gets its own payment, and whatever is
// left goes to the first open debt in the order. When a debt is paid off its
// payment stays in the budget and rolls to the next one, so the total paid each
// month never drops until the last debt is gone.
//
// Pure functions, no React, no storage: App.jsx renders it, tests/ proves it.

const EPS = 0.005; // half a cent: a balance under this is paid off

export const STRATEGIES = {
  avalanche: {
    label: "Avalanche",
    rule: "Highest APR first",
    why: "Pays the least interest.",
  },
  snowball: {
    label: "Snowball",
    rule: "Smallest balance first",
    why: "Clears a whole debt soonest.",
  },
  hybrid: {
    label: "Hybrid",
    rule: "Quick wins first, then highest APR",
    why: "Debts you can clear within 6 months go first, smallest first. The rest go by APR.",
  },
};

export const QUICK_WIN_MONTHS = 6;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Normalise the app's debt records. Only open balances are planned.
// A debt with no monthly payment is "on hold": it is planned last, so the
// rollover reaches it once everything with a payment is gone.
export function normalizeDebts(debts) {
  return (debts || [])
    .map((d, i) => ({
      key: i,
      id: d.id ?? i,
      name: d.name || "Debt",
      bal: Math.max(0, num(d.bal)),
      rate: Math.max(0, num(d.rate)),
      minPay: Math.max(0, num(d.minPay)),
      paidOff: d.status === "paid",
    }))
    .filter((d) => d.bal > EPS && !d.paidOff)
    .map(({ paidOff, ...d }) => ({ ...d, hold: d.minPay <= 0 }));
}

const byAvalanche = (a, b) => b.rate - a.rate || a.bal - b.bal || a.key - b.key;
const bySnowball = (a, b) => a.bal - b.bal || b.rate - a.rate || a.key - b.key;

// The order the extra money attacks the debts in.
export function orderDebts(list, strategy = "avalanche", extra = 0) {
  const x = Math.max(0, num(extra));
  const paying = list.filter((d) => !d.hold);
  const held = list.filter((d) => d.hold);
  let head;
  if (strategy === "snowball") {
    head = [...paying].sort(bySnowball);
  } else if (strategy === "hybrid") {
    const quick = paying.filter((d) => d.bal <= QUICK_WIN_MONTHS * (d.minPay + x));
    const rest = paying.filter((d) => d.bal > QUICK_WIN_MONTHS * (d.minPay + x));
    head = [...quick.sort(bySnowball), ...rest.sort(byAvalanche)];
  } else {
    head = [...paying].sort(byAvalanche);
  }
  const tail = [...held].sort(strategy === "snowball" ? bySnowball : byAvalanche);
  return [...head, ...tail];
}

// What someone typed in "Other": keep digits and the first decimal point, cap the
// length, and read the amount. value is null while the text is not a number yet (".").
export function parseExtraInput(raw) {
  const text = String(raw ?? "")
    .replace(/[^0-9.]/g, "")
    .replace(/(\..*)\./g, "$1")
    .slice(0, 9);
  if (text === "") return { text, value: 0 };
  const n = parseFloat(text);
  return { text, value: Number.isFinite(n) ? Math.min(Math.round(n * 100) / 100, 1000000) : null };
}

// Simulate the plan month by month.
// Returns months to debt-free (payments made), total interest, whether it
// finishes inside maxMonths, the ordered debts with their payoff month, and
// the total balance after each month (index 0 = today) for charting.
export function planPayoff(debts, opts = {}) {
  const strategy = STRATEGIES[opts.strategy] ? opts.strategy : "avalanche";
  const extra = Math.max(0, num(opts.extra));
  const maxMonths = Math.max(1, Math.floor(num(opts.maxMonths) || 600));

  const list = normalizeDebts(debts);
  const order = orderDebts(list, strategy, extra);
  const budget = list.reduce((s, d) => s + d.minPay, 0) + extra;

  const bal = order.map((d) => d.bal);
  const interest = order.map(() => 0);
  const paid = order.map(() => 0);
  const payoffMonth = order.map(() => null);
  const payHist = order.map(() => []);
  const totals = [round2(bal.reduce((s, b) => s + b, 0))];
  const monthly = [];
  let totalInterest = 0;
  let m = 0;

  const open = () => bal.some((b) => b > EPS);

  while (open() && m < maxMonths) {
    m++;
    const payNow = order.map(() => 0);
    // 1. interest
    for (let k = 0; k < order.length; k++) {
      if (bal[k] > EPS) {
        const i = (bal[k] * order[k].rate) / 1200;
        bal[k] += i;
        interest[k] += i;
        totalInterest += i;
      }
    }
    // 2. each debt's own payment
    let avail = budget;
    for (let k = 0; k < order.length; k++) {
      if (bal[k] > EPS) {
        const p = Math.min(order[k].minPay, bal[k]);
        bal[k] -= p;
        payNow[k] += p;
        avail -= p;
      }
    }
    // 3. everything left, in order (this is the rollover)
    for (let k = 0; k < order.length && avail > EPS; k++) {
      if (bal[k] > EPS) {
        const p = Math.min(avail, bal[k]);
        bal[k] -= p;
        payNow[k] += p;
        avail -= p;
      }
    }
    for (let k = 0; k < order.length; k++) {
      paid[k] += payNow[k];
      payHist[k].push(payNow[k]);
      if (bal[k] <= EPS && payoffMonth[k] === null) {
        bal[k] = 0;
        payoffMonth[k] = m;
      }
    }
    totals.push(round2(bal.reduce((s, b) => s + Math.max(0, b), 0)));
    monthly.push(round2(payNow.reduce((s, p) => s + p, 0)));
  }

  const done = !open();
  const steps = order.map((d, k) => {
    const pm = payoffMonth[k];
    // Where this debt's money goes next: the first debt later in the order
    // that is still open after this one clears, and what it gets the month after.
    let rollsTo = null;
    if (pm !== null && pm < m) {
      for (let j = k + 1; j < order.length; j++) {
        if (payoffMonth[j] === null || payoffMonth[j] > pm) {
          rollsTo = { id: order[j].id, name: order[j].name, gets: round2(payHist[j][pm] || 0) };
          break;
        }
      }
    }
    // First month this debt got more than its own payment: when the extra
    // (and any rollover) reached it. null if it cleared on its own payment.
    const bi = payHist[k].findIndex((amt) => amt > d.minPay + EPS);
    return {
      id: d.id,
      name: d.name,
      bal: d.bal,
      rate: d.rate,
      minPay: d.minPay,
      hold: d.hold,
      payoffMonth: pm,
      boostFrom: bi === -1 ? null : bi + 1,
      interest: round2(interest[k]),
      paid: round2(paid[k]),
      firstPayment: round2(payHist[k][0] || 0),
      rollsTo,
    };
  });

  return {
    strategy,
    extra,
    budget: round2(budget),
    months: m,
    done,
    totalInterest: round2(totalInterest),
    totalPaid: round2(paid.reduce((s, p) => s + p, 0)),
    order: steps,
    totals,
    monthly,
    firstWin: steps.reduce((best, s) => (s.payoffMonth !== null && (best === null || s.payoffMonth < best) ? s.payoffMonth : best), null),
  };
}

// All three strategies at one extra amount, for the side-by-side choice.
export function compareStrategies(debts, extra = 0, opts = {}) {
  const out = {};
  for (const key of Object.keys(STRATEGIES)) out[key] = planPayoff(debts, { ...opts, strategy: key, extra });
  return out;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
