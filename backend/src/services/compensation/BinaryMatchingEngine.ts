import { ICompensationRule } from '../../models/CompensationRule.model';

/**
 * Pure binary matching rules. No database access: the daily settlement, the live "today" preview
 * and the tests all run the same function.
 *
 *  1st payout: 2500 BV on one leg and 1250 BV on the other. The 1250 is used; the 2500 is kept
 *              (reserved) for the 2nd payout.
 *  2nd payout: the kept 2500 plus 1250 new BV on the other leg. Both are used.
 *  3rd payout onwards: 1250 BV on each leg, any number of times.
 *  Each payout earns the same amount (₹250). Unused BV carries forward with no expiry.
 */

export type BinaryLeg = 'LEFT' | 'RIGHT';
export type BinaryPayoutStage = 'FIRST_PAYOUT' | 'SECOND_PAYOUT' | 'SUBSEQUENT';

export interface BinaryMatchState {
  left: number; // available (unmatched) BV on the left leg, excluding reserved BV
  right: number;
  reservedBV: number; // BV kept from the 1st payout for the 2nd payout
  reservedSide: BinaryLeg | null;
  payoutCount: number; // payouts completed over the member's lifetime
}

export interface BinaryMatchRules {
  firstDominantBV: number;
  firstOppositeBV: number;
  secondNewBV: number;
  pairBV: number;
  ratePerMatch: number;
}

export interface BinaryMatchCycle {
  payoutSequence: number;
  stage: BinaryPayoutStage;
  ratio: '2:1' | '1:2' | '1:1';
  leftBVUsed: number;
  rightBVUsed: number;
  reservedSide: BinaryLeg | null; // leg whose 2500 BV was kept (1st payout) or released (2nd payout)
  amount: number;
}

export interface BinaryMatchResult {
  cycles: BinaryMatchCycle[];
  matches: number;
  generatedAmount: number;
  leftBVUsed: number; // includes reserved BV released by the 2nd payout
  rightBVUsed: number;
  state: BinaryMatchState;
}

export const DEFAULT_MATCH_RULES: BinaryMatchRules = {
  firstDominantBV: 2500,
  firstOppositeBV: 1250,
  secondNewBV: 1250,
  pairBV: 1250,
  ratePerMatch: 250,
};

export function matchRulesFrom(rules?: Partial<ICompensationRule> | null): BinaryMatchRules {
  const b = rules?.binaryBonus;
  const positive = (value: unknown, fallback: number) => (typeof value === 'number' && value > 0 ? value : fallback);
  return {
    firstDominantBV: positive(b?.firstPayoutDominantBv, DEFAULT_MATCH_RULES.firstDominantBV),
    firstOppositeBV: positive(b?.firstPayoutOppositeBv, DEFAULT_MATCH_RULES.firstOppositeBV),
    secondNewBV: positive(b?.secondPayoutNewBv, DEFAULT_MATCH_RULES.secondNewBV),
    pairBV: positive(b?.pairBvUnit, DEFAULT_MATCH_RULES.pairBV),
    ratePerMatch: positive(b?.rateInRupees, DEFAULT_MATCH_RULES.ratePerMatch),
  };
}

export function computeMatches(start: BinaryMatchState, rules: BinaryMatchRules = DEFAULT_MATCH_RULES): BinaryMatchResult {
  const state: BinaryMatchState = {
    left: Math.max(0, start.left || 0),
    right: Math.max(0, start.right || 0),
    reservedBV: Math.max(0, start.reservedBV || 0),
    reservedSide: start.reservedBV > 0 ? start.reservedSide : null,
    payoutCount: Math.max(0, start.payoutCount || 0),
  };
  const cycles: BinaryMatchCycle[] = [];

  const push = (cycle: Omit<BinaryMatchCycle, 'payoutSequence' | 'amount'>) => {
    state.payoutCount += 1;
    cycles.push({ ...cycle, payoutSequence: state.payoutCount, amount: rules.ratePerMatch });
  };

  // The loop always consumes BV, so it ends; the guard only protects against bad rule values
  for (let guard = 0; guard < 1_000_000; guard++) {
    if (state.payoutCount === 0) {
      const leftDominant = state.left >= rules.firstDominantBV && state.right >= rules.firstOppositeBV;
      const rightDominant = state.right >= rules.firstDominantBV && state.left >= rules.firstOppositeBV;
      if (!leftDominant && !rightDominant) break;

      // When both orientations fit, keep the 2500 on the stronger leg (left on a tie)
      const keepLeft = leftDominant && (!rightDominant || state.left >= state.right);
      if (keepLeft) {
        state.left -= rules.firstDominantBV;
        state.right -= rules.firstOppositeBV;
      } else {
        state.right -= rules.firstDominantBV;
        state.left -= rules.firstOppositeBV;
      }
      state.reservedBV = rules.firstDominantBV;
      state.reservedSide = keepLeft ? 'LEFT' : 'RIGHT';
      push({
        stage: 'FIRST_PAYOUT',
        ratio: keepLeft ? '2:1' : '1:2',
        leftBVUsed: keepLeft ? 0 : rules.firstOppositeBV,
        rightBVUsed: keepLeft ? rules.firstOppositeBV : 0,
        reservedSide: state.reservedSide,
      });
      continue;
    }

    if (state.payoutCount === 1 && state.reservedBV > 0 && state.reservedSide) {
      const keptLeft = state.reservedSide === 'LEFT';
      const opposite = keptLeft ? state.right : state.left;
      if (opposite < rules.secondNewBV) break;

      const released = state.reservedBV;
      if (keptLeft) state.right -= rules.secondNewBV;
      else state.left -= rules.secondNewBV;
      state.reservedBV = 0;
      state.reservedSide = null;
      push({
        stage: 'SECOND_PAYOUT',
        ratio: keptLeft ? '2:1' : '1:2',
        leftBVUsed: keptLeft ? released : rules.secondNewBV,
        rightBVUsed: keptLeft ? rules.secondNewBV : released,
        reservedSide: keptLeft ? 'LEFT' : 'RIGHT',
      });
      continue;
    }

    if (state.left < rules.pairBV || state.right < rules.pairBV) break;
    state.left -= rules.pairBV;
    state.right -= rules.pairBV;
    push({ stage: 'SUBSEQUENT', ratio: '1:1', leftBVUsed: rules.pairBV, rightBVUsed: rules.pairBV, reservedSide: null });
  }

  return {
    cycles,
    matches: cycles.length,
    generatedAmount: cycles.length * rules.ratePerMatch,
    leftBVUsed: cycles.reduce((sum, c) => sum + c.leftBVUsed, 0),
    rightBVUsed: cycles.reduce((sum, c) => sum + c.rightBVUsed, 0),
    state,
  };
}

/** Splits generated income into the part paid out and the part flushed by the daily cap (cap <= 0 means uncapped). */
export function applyDailyCap(generatedAmount: number, dailyCap: number): { creditedAmount: number; flushedAmount: number } {
  if (dailyCap <= 0 || generatedAmount <= dailyCap) return { creditedAmount: generatedAmount, flushedAmount: 0 };
  return { creditedAmount: dailyCap, flushedAmount: generatedAmount - dailyCap };
}
