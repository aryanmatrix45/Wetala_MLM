/**
 * Binary matching rules: pure tests, no database.
 *   npm run test:binary
 */
import {
  BinaryMatchState,
  DEFAULT_MATCH_RULES,
  applyDailyCap,
  computeMatches,
  matchRulesFrom,
} from '../src/services/compensation/BinaryMatchingEngine';
import { BusinessDate } from '../src/utils/businessDate';

const tests: Array<{ name: string; fn: () => void }> = [];
const test = (name: string, fn: () => void) => tests.push({ name, fn });

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
  }
}

const fresh = (left: number, right: number): BinaryMatchState => ({ left, right, reservedBV: 0, reservedSide: null, payoutCount: 0 });

/** Simulates consecutive days: each day adds new BV to the carry forward and matches */
function runDays(days: Array<[number, number]>, cap = 4000) {
  let state = fresh(0, 0);
  return days.map(([newLeft, newRight]) => {
    const result = computeMatches({ ...state, left: state.left + newLeft, right: state.right + newRight });
    state = result.state;
    return { ...result, ...applyDailyCap(result.generatedAmount, cap) };
  });
}

test('1st payout: 2500 left : 1250 right pays ₹250 and keeps the 2500', () => {
  const r = computeMatches(fresh(2500, 1250));
  assertEqual(r.matches, 1, 'one payout');
  assertEqual(r.generatedAmount, 250, '₹250');
  assertEqual(r.state, { left: 0, right: 0, reservedBV: 2500, reservedSide: 'LEFT', payoutCount: 1 }, 'state after 1st payout');
});

test('1st payout works the other way round: 1250 left : 2500 right', () => {
  const r = computeMatches(fresh(1250, 2500));
  assertEqual(r.matches, 1, 'one payout');
  assertEqual(r.state.reservedSide, 'RIGHT', '2500 kept on the right');
  assertEqual(r.leftBVUsed, 1250, 'left 1250 used');
});

test('No payout at 1250 : 1250 before the first payout (needs 2:1)', () => {
  const r = computeMatches(fresh(1250, 1250));
  assertEqual(r.matches, 0, 'no payout');
  assertEqual(r.state, fresh(1250, 1250), 'BV untouched');
});

test('2nd payout needs 1250 new BV on the opposite leg of the kept 2500', () => {
  const kept: BinaryMatchState = { left: 0, right: 0, reservedBV: 2500, reservedSide: 'RIGHT', payoutCount: 1 };
  assertEqual(computeMatches({ ...kept, left: 1249 }).matches, 0, '1249 is not enough');
  assertEqual(computeMatches({ ...kept, right: 5000 }).matches, 0, 'BV on the kept leg does not trigger the 2nd payout');
  const r = computeMatches({ ...kept, left: 1250 });
  assertEqual(r.matches, 1, '2nd payout');
  assertEqual(r.cycles[0].stage, 'SECOND_PAYOUT', 'stage');
  assertEqual(r.state, { left: 0, right: 0, reservedBV: 0, reservedSide: null, payoutCount: 2 }, 'kept BV released');
});

test('3rd payout onwards: 1250 : 1250 each, unlimited, leftovers carry forward', () => {
  const r = computeMatches({ left: 5100, right: 3800, reservedBV: 0, reservedSide: null, payoutCount: 2 });
  assertEqual(r.matches, 3, 'three 1:1 payouts');
  assertEqual(r.generatedAmount, 750, '₹750');
  assertEqual([r.state.left, r.state.right], [1350, 50], 'carry forward');
  assertEqual(r.cycles.map((c) => c.payoutSequence), [3, 4, 5], 'sequence continues');
});

test('All stages can happen on the same day', () => {
  const r = computeMatches(fresh(5000, 3750));
  // 1st: L2500 kept, R1250 used | 2nd: R1250 used + kept released | 3rd: L1250 + R1250
  assertEqual(r.cycles.map((c) => c.stage), ['FIRST_PAYOUT', 'SECOND_PAYOUT', 'SUBSEQUENT'], 'stages');
  assertEqual([r.state.left, r.state.right, r.state.reservedBV], [1250, 0, 0], 'leftover');
});

test('Worked example over three days (2700 → 200 carry, 1300 → 50 carry)', () => {
  const days = runDays([
    [2700, 1250], // day 1: 1st payout, 200 left carries forward
    [0, 1300], // day 2: 2nd payout, 50 right carries forward
    [1100, 1250], // day 3: 1300 : 1300 → 1:1 payout, 50 : 50 carries forward
  ]);
  assertEqual(days.map((d) => d.creditedAmount), [250, 250, 250], '₹250 each day');
  assertEqual([days[0].state.left, days[0].state.reservedBV], [200, 2500], 'day 1 carry + kept');
  assertEqual([days[1].state.left, days[1].state.right], [200, 50], 'day 2 carry');
  assertEqual([days[2].state.left, days[2].state.right], [50, 50], 'day 3 carry');
});

test('BV used today cannot be used again tomorrow', () => {
  const days = runDays([
    [2500, 1250],
    [0, 0],
  ]);
  assertEqual(days[1].matches, 0, 'no second payout without new BV');
});

test('Daily cap ₹4000: 17 matches pay ₹4000 and flush ₹250; flushed BV is still used', () => {
  const start: BinaryMatchState = { left: 17 * 1250, right: 17 * 1250, reservedBV: 0, reservedSide: null, payoutCount: 2 };
  const r = computeMatches(start);
  assertEqual(r.matches, 17, '17 matches');
  assertEqual(applyDailyCap(r.generatedAmount, 4000), { creditedAmount: 4000, flushedAmount: 250 }, 'capped');
  assertEqual([r.state.left, r.state.right], [0, 0], 'all matched BV used, nothing carried for the flushed part');
});

test('Cap of 0 means uncapped; earnings under the cap are paid in full', () => {
  assertEqual(applyDailyCap(10000, 0), { creditedAmount: 10000, flushedAmount: 0 }, 'uncapped');
  assertEqual(applyDailyCap(3750, 4000), { creditedAmount: 3750, flushedAmount: 0 }, 'under cap');
});

test('Rules come from the compensation settings with safe defaults', () => {
  assertEqual(matchRulesFrom(null), DEFAULT_MATCH_RULES, 'defaults');
  assertEqual(matchRulesFrom({ binaryBonus: { isEnabled: true, rateInRupees: 300 } } as any).ratePerMatch, 300, 'rate override');
});

test('IST business dates: 18:29 UTC is still the same day, 18:30 UTC is the next day', () => {
  assertEqual(BusinessDate.of(new Date('2026-10-20T18:29:59.999Z')), '2026-10-20', 'before IST midnight');
  assertEqual(BusinessDate.of(new Date('2026-10-20T18:30:00.000Z')), '2026-10-21', 'after IST midnight');
  assertEqual(BusinessDate.startOf('2026-10-21').toISOString(), '2026-10-20T18:30:00.000Z', 'start of day');
  assertEqual(BusinessDate.addDays('2026-12-31', 1), '2027-01-01', 'year rollover');
  assertEqual(BusinessDate.isValid('2026-02-30'), false, 'invalid date');
});

let failed = 0;
for (const t of tests) {
  try {
    t.fn();
    console.log(`  ✓ ${t.name}`);
  } catch (error: any) {
    failed++;
    console.log(`  ✗ ${t.name}\n    ${error.message}`);
  }
}
console.log(`\n${tests.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
