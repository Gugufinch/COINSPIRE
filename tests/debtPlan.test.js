// npm test  (node --test, no dependencies)
//
// The four debts are the ones goldmine used on 2026-09-27 to test a money
// prompt, then checked by hand in Python: Visa, store card, car, student loan,
// $566 of monthly payments plus $300 extra = $866 a month.
import { test } from "node:test";
import assert from "node:assert/strict";
import { planPayoff, compareStrategies, orderDebts, normalizeDebts, parseExtraInput } from "../src/debtPlan.js";

const DEBTS = [
  { id: "visa", name: "Visa", bal: 4200, rate: 24.99, minPay: 126, status: "active" },
  { id: "store", name: "Store card", bal: 1150, rate: 19.99, minPay: 35, status: "active" },
  { id: "car", name: "Car", bal: 9800, rate: 6.9, minPay: 245, status: "active" },
  { id: "student", name: "Student loan", bal: 14500, rate: 5.5, minPay: 160, status: "active" },
];

// The What If code as it shipped in v4.6 (src/App.jsx, DebtPage), copied
// verbatim apart from the JSX: the extra is split evenly across debts and a
// paid-off debt's payment is never rolled forward.
function legacyWhatIf(debts, extra) {
  const active = debts.filter((d) => d.bal > 0);
  const scenarios = active.filter((d) => (d.minPay || 0) > 0).map((d) => {
    const r = d.rate / 100 / 12; let rem = d.bal; let m = 0;
    while (rem > 0 && m < 120) { rem = rem + rem * r - (d.minPay + extra / active.filter((x) => x.minPay > 0).length); m++; }
    return m;
  });
  const maxMo = Math.max(...scenarios);
  const totalInt = (extra2) => active.filter((d) => (d.minPay || 0) > 0).reduce((s, d) => {
    const r = d.rate / 100 / 12; let rem = d.bal; let intT = 0; let m = 0;
    const pay = d.minPay + extra2 / active.filter((x) => x.minPay > 0).length;
    while (rem > 0 && m < 120) { const i = rem * r; intT += i; rem = rem + i - pay; m++; }
    return s + Math.max(intT, 0);
  }, 0);
  return { months: maxMo, interest: totalInt(extra) };
}

const byId = (plan) => Object.fromEntries(plan.order.map((s) => [s.id, s]));
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);

test("the old What If: $300 extra split evenly, no rollover = 73 months, $5,088 interest", () => {
  const old = legacyWhatIf(DEBTS, 300);
  assert.equal(old.months, 73);
  near(old.interest, 5088.15);
});

test("avalanche with rollover: same $866 a month = 39 months, $3,573.32 interest", () => {
  const p = planPayoff(DEBTS, { strategy: "avalanche", extra: 300 });
  assert.equal(p.done, true);
  assert.equal(p.budget, 866);
  assert.equal(p.months, 39);
  near(p.totalInterest, 3573.32);
  assert.deepEqual(p.order.map((s) => s.id), ["visa", "store", "car", "student"]);
  const s = byId(p);
  assert.equal(s.visa.payoffMonth, 12);
  assert.equal(s.store.payoffMonth, 14);
  assert.equal(s.car.payoffMonth, 24);
  assert.equal(s.student.payoffMonth, 39);
});

test("snowball with rollover = 39 months, $3,630.93 interest, first win in month 4", () => {
  const p = planPayoff(DEBTS, { strategy: "snowball", extra: 300 });
  assert.equal(p.months, 39);
  near(p.totalInterest, 3630.93);
  assert.deepEqual(p.order.map((s) => s.id), ["store", "visa", "car", "student"]);
  const s = byId(p);
  assert.equal(s.store.payoffMonth, 4);
  assert.equal(s.visa.payoffMonth, 14);
  assert.equal(s.car.payoffMonth, 24);
  assert.equal(p.firstWin, 4);
});

test("the fix is worth 34 months and $1,514.83 on the tested numbers", () => {
  const old = legacyWhatIf(DEBTS, 300);
  const now = planPayoff(DEBTS, { strategy: "avalanche", extra: 300 });
  assert.equal(old.months - now.months, 34);
  near(old.interest - now.totalInterest, 1514.83);
});

test("hybrid: the store card is a quick win (under 6 months), then highest APR", () => {
  const p = planPayoff(DEBTS, { strategy: "hybrid", extra: 300 });
  assert.deepEqual(p.order.map((s) => s.id), ["store", "visa", "car", "student"]);
  near(p.totalInterest, 3630.93); // same order as snowball on this set, as the prompt run found
  // with no extra nothing clears in 6 months, so hybrid is plain avalanche
  const zero = planPayoff(DEBTS, { strategy: "hybrid", extra: 0 });
  assert.deepEqual(zero.order.map((s) => s.id), ["visa", "store", "car", "student"]);
});

test("rollover: once Visa clears in month 12, the store card gets $866 minus the other payments", () => {
  const p = planPayoff(DEBTS, { strategy: "avalanche", extra: 300 });
  const visa = byId(p).visa;
  assert.equal(visa.rollsTo.id, "store");
  // month 13: car $245 and student $160 keep their own payments, the store card gets the rest
  near(visa.rollsTo.gets, 866 - 245 - 160);
  // the extra hits Visa from month 1; the store card only once Visa is gone
  assert.equal(visa.boostFrom, 1);
  assert.equal(byId(p).store.boostFrom, 12); // month 12's leftover after Visa's last payment
  assert.equal(byId(p).car.boostFrom, 14);
});

test("the monthly total never drops until the last month", () => {
  for (const strategy of ["avalanche", "snowball", "hybrid"]) {
    const p = planPayoff(DEBTS, { strategy, extra: 300 });
    assert.equal(p.monthly.length, p.months);
    p.monthly.slice(0, -1).forEach((amt, i) => near(amt, 866, 0.011));
    assert.ok(p.monthly.at(-1) <= 866);
    // everything paid = starting balances + interest, to the cent
    const start = DEBTS.reduce((s, d) => s + d.bal, 0);
    near(p.totalPaid, start + p.totalInterest, 0.05);
    assert.equal(p.totals.at(-1), 0);
  }
});

test("rollover alone, with no extra, beats paying each debt separately (118 months)", () => {
  const old = legacyWhatIf(DEBTS, 0);
  assert.equal(old.months, 118);
  const p = planPayoff(DEBTS, { strategy: "avalanche", extra: 0 });
  assert.ok(p.months < 118, `rollover only took ${p.months} months`);
  assert.ok(p.totalInterest < old.interest);
});

test("more extra is never slower and never costs more interest", () => {
  for (const strategy of ["avalanche", "snowball", "hybrid"]) {
    let prev = planPayoff(DEBTS, { strategy, extra: 0 });
    for (const extra of [50, 100, 200, 300, 1057]) {
      const p = planPayoff(DEBTS, { strategy, extra });
      assert.ok(p.months <= prev.months, `${strategy} +${extra}`);
      assert.ok(p.totalInterest <= prev.totalInterest + 0.01, `${strategy} +${extra}`);
      prev = p;
    }
  }
});

test("avalanche never pays more interest than snowball on the tested debts", () => {
  for (const extra of [0, 50, 100, 200, 300]) {
    const c = compareStrategies(DEBTS, extra);
    assert.ok(c.avalanche.totalInterest <= c.snowball.totalInterest + 0.01, `+${extra}`);
  }
});

test("a debt on hold (no monthly payment) is planned last and gets the rollover", () => {
  const debts = [
    { id: "upstart", name: "Upstart", bal: 1999, rate: 10.5, minPay: 150 },
    { id: "edfin", name: "EdFinancial", bal: 4898, rate: 5.0, minPay: 0, status: "hold" },
    { id: "bcu", name: "BCU Loan", bal: 0, rate: 0, minPay: 345, status: "paid" },
  ];
  const p = planPayoff(debts, { strategy: "avalanche", extra: 100 });
  assert.deepEqual(p.order.map((s) => s.id), ["upstart", "edfin"]);
  assert.equal(p.order[1].hold, true);
  assert.equal(p.done, true);
  assert.equal(p.budget, 250);
  assert.equal(p.order[0].rollsTo.id, "edfin");
  near(p.order[0].rollsTo.gets, 250);
});

test("a payment below the interest never finishes and says so", () => {
  const p = planPayoff([{ id: "x", name: "X", bal: 10000, rate: 30, minPay: 100 }], { extra: 0, maxMonths: 600 });
  assert.equal(p.done, false);
  assert.equal(p.months, 600);
  assert.equal(p.order[0].payoffMonth, null);
});

test("bad input: no debts, paid debts, junk numbers", () => {
  assert.equal(planPayoff([], { extra: 300 }).months, 0);
  assert.equal(planPayoff(null).months, 0);
  assert.equal(planPayoff([{ id: 1, bal: 0, rate: 5, minPay: 10 }]).months, 0);
  const p = planPayoff([{ id: 1, name: "A", bal: "500", rate: "12", minPay: "100" }], { extra: "-40", strategy: "nonsense" });
  assert.equal(p.strategy, "avalanche");
  assert.equal(p.extra, 0);
  assert.equal(p.months, 6);
  assert.equal(normalizeDebts([{ bal: NaN, rate: 5, minPay: 5 }]).length, 0);
});

test("zero APR and ties keep a stable order", () => {
  const list = normalizeDebts([
    { id: "a", bal: 500, rate: 0, minPay: 25 },
    { id: "b", bal: 500, rate: 0, minPay: 25 },
    { id: "c", bal: 200, rate: 0, minPay: 25 },
  ]);
  assert.deepEqual(orderDebts(list, "avalanche").map((d) => d.id), ["c", "a", "b"]);
  assert.deepEqual(orderDebts(list, "snowball").map((d) => d.id), ["c", "a", "b"]);
  const p = planPayoff(list, { extra: 25 });
  assert.equal(p.totalInterest, 0);
  assert.equal(p.months, 12); // $1,200 at $100 a month
});

test("the Other amount box reads what a phone keyboard can type", () => {
  assert.deepEqual(parseExtraInput("250"), { text: "250", value: 250 });
  assert.deepEqual(parseExtraInput("$1,200"), { text: "1200", value: 1200 });
  assert.deepEqual(parseExtraInput("12.50"), { text: "12.50", value: 12.5 });
  assert.deepEqual(parseExtraInput("12.5.6"), { text: "12.56", value: 12.56 });
  assert.deepEqual(parseExtraInput("-40"), { text: "40", value: 40 });
  assert.deepEqual(parseExtraInput(""), { text: "", value: 0 });
  assert.deepEqual(parseExtraInput("abc"), { text: "", value: 0 });
  assert.deepEqual(parseExtraInput("."), { text: ".", value: null }); // mid-typing: keep the last amount
  assert.equal(parseExtraInput("999999999999").text.length, 9);
  // what it feeds the planner is the same as picking the preset
  assert.equal(planPayoff(DEBTS, { extra: parseExtraInput("300").value }).months, 39);
});
