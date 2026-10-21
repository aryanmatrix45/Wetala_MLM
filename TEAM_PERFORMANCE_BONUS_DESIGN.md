# Team Performance Bonus: Design and Open Rules

Written for: the business owner (to answer the questions in section 3) and the developers who will build this.

Status: **implemented with the proposed defaults in section 3** (backend only; see section 5 for what is not built yet). Answers that differ from the defaults change the code listed in section 4.

---

## 1. What the codebase already has

| Area | Current state | Impact on this feature |
|---|---|---|
| `BinaryVolume` ([BinaryVolume.model.ts](backend/src/models/BinaryVolume.model.ts)) | Lifetime `leftTotalBV` / `rightTotalBV` in raw BV, plus `leftAvailableBV` and `consumedTotalBV` for binary matching. | Source for RP. Lifetime totals are not reduced by binary matching, which matches the spec's "do not auto-exclude consumed BV". |
| `BVLedger` ([BVLedger.model.ts](backend/src/models/BVLedger.model.ts)) | Immutable rows per BV event, with `referenceId` and `sourceMemberId`. | Lets RP be rebuilt from ledger rows and de-duplicated by `referenceId`. |
| `TeamPerformanceService` ([TeamPerformanceService.ts](backend/src/services/compensation/TeamPerformanceService.ts)) | **Stub, already wired in.** Runs on every purchase for every binary ancestor. | See section 2. Needs replacing. |
| `CompensationRule.teamPerformanceBonus` ([CompensationRule.model.ts](backend/src/models/CompensationRule.model.ts)) | Six slabs stored with `leftThreshold`, `rightThreshold`, `royaltyBonusPercent`, `limitAmount`. Seed default `isEnabled: true`. Has an admin editor in [IncomeSettingsPage.tsx](frontend/src/pages/IncomeSettingsPage.tsx). | Good base for slab config. Needs an `active` flag per slab, a `pairRp` unit, and to move out of the per-purchase rule. |
| `RewardService` ([RewardService.ts](backend/src/services/compensation/RewardService.ts)) | Lifetime milestone rewards (5:5 ₹1,000, 10:10 ₹2,000, …). Counts pairs as `BV / 1000`, not `/ 1250`. | Same 10:10 milestone pays here too. See question 11. |
| `WelcomeBonusService` ([WelcomeBonusService.ts](backend/src/services/compensation/WelcomeBonusService.ts)) | Weekly pool = company gross BV × rate, split equally among eligible members, capped by remaining lifetime cap, with settlement records. | **Closest pattern to reuse** for the period pool, equal split, cap and settlement history. |
| `GrossVolumeService.forPeriod` ([GrossVolumeService.ts](backend/src/services/GrossVolumeService.ts)) | Company paid-order BV and revenue for a date range. Used by the dashboard and welcome bonus. | Candidate source for CTO (see question 5). |
| Transactions | `grep` finds **no `startSession` / `withTransaction` use anywhere** in the backend. Idempotency today is per purchase event (`CompensationEvent`). | Mongo transactions are not an established pattern here. Plan: unique indexes plus atomic `findOneAndUpdate`, and transactions only if the deployment is a replica set. |

### 1.1 Problems found in the current stub (should be fixed regardless of the answers)

1. **Unit mismatch.** Thresholds are RP (10, 100, …), but the code compares them with `leftTotalBV` (raw BV). Under the 1250 BV = 1 RP rule, "10 RP" means 12,500 BV. The current code treats 10 BV as enough.
2. **No duplicate protection.** The stub has no check for a member already holding a slab. It runs on every purchase by any downstream member, so the same ancestor can be paid the same slab many times. Ledger IDs are random, not keyed to the slab.
3. **Flat payout, no CTO share.** It pays `limitAmount` (the lifetime cap) as the bonus. It never uses `royaltyBonusPercent` × turnover, so the pool and equal-share rules are not applied.
4. **Deductions applied.** It calls `DeductionUtil` (TDS and admin fee). The architecture doc says no deductions apply to any income. Needs confirmation (question 9).
5. **Enabled by default.** The seed sets `isEnabled: true`. If the live rule document has the same value, production may already be paying this on every purchase. **Check the live `CompensationRule` document and `CommissionLedger` rows of type `TEAM_PERFORMANCE_BONUS` before any deployment.** Setting `isEnabled: false` is a data change, so I have not made it.

---

## 2. Proposed calculation flow

### Step A: Business volume to RP (per purchase, idempotent)

- Eligible left and right BV come from the member's `BVLedger` rows for their own binary legs (`position` LEFT / RIGHT), keyed by `referenceId` so each order counts once.
- `leftRP = floor(leftEligibleBV / 1250)`, `rightRP = floor(rightEligibleBV / 1250)`.
- Stored in `MemberRewardPoints` (`memberId`, `leftBV`, `rightBV`, `leftRP`, `rightRP`, `leftConsumedRP`, `rightConsumedRP`, `updatedAt`). Recalculated on each purchase, and a backfill can rebuild it from the ledger.
- Binary-consumed BV stays in the RP calculation (per the spec), so binary income is not changed.

### Step B: Slab qualification (cumulative, default)

- A member qualifies for slab *S* when `min(leftRP, rightRP) >= S.threshold` (both sides independently).
- One `TeamPerformanceBonusQualification` row per `(memberId, slabId)`, with a unique index. The first time the threshold is reached it is inserted, and the insert is the idempotency guard.
- Consumption: under the cumulative model, nothing is deducted from the RP balance. `consumedRP` records the highest slab reached. (Under the incremental model in question 1, consumption becomes real.)

### Step C: Period close (SuperAdmin-controlled)

For each `CompanyTurnoverPeriod` that is closed:

1. `turnover` = company turnover for the period (question 5).
2. For each active slab *S*:
   - `pool(S) = turnover × S.percent / 100` (question 4 decides whether slabs share one pool).
   - `eligible(S)` = members who **first** qualified for *S* in this period.
   - `share = floor(pool / eligible)` in whole rupees. The rounding remainder stays with the company.
   - Each member's payout = `min(share, slabRemainingLifetimeCap)`.
   - `sum(payouts) <= pool` is enforced in code. Undistributed amounts are recorded as undistributed (same as welcome bonus).
3. Each credit is written with an idempotency key `TPB:{periodId}:{slabId}:{memberId}`. A unique index on that key blocks duplicates, and the wallet credit and the payout row are written together. Retries are safe.
4. Each slab's lifetime counter is incremented with a conditional update (`paidTotal + amount <= limit`) so concurrent runs cannot overpay.

### Step D: Preview

`POST /admin/team-performance/preview` runs Steps B to C without writing and returns the plan: turnover, pool, eligible count, share, capped members, and undistributed amount.

### Step E: Member view

Shows left/right BV and RP, progress to each slab, qualified slabs (with dates), payouts, total earned, and remaining lifetime cap per slab.

---

## 3. Questions for the business owner (with proposed defaults)

| # | Question | Proposed default |
|---|---|---|
| 1 | **Milestone model.** Table thresholds (100:100) are cumulative. The spec example (10:10 → 20:20) reads as incremental. Are the slabs one-time cumulative levels, or do they repeat every 10 RP? | One-time cumulative slabs, as in the table. No repeating milestones unless a step rule is provided. |
| 2 | **Eligible BV.** Does BV from refunded or reversed orders count? Does BV from members not yet activated count? Does BV transferred by SuperAdmin count? | Paid orders only, minus refunds, same as `GrossVolumeService`. Activated members only. SuperAdmin-generated BV and transfers excluded. |
| 3 | **Consumption.** Should RP used for a slab be deducted from the balance (so 100:100 needs 100 *more* RP), or should thresholds be measured against total RP? | Total RP. Nothing deducted. |
| 4 | **Pool scope.** Is `royaltyBonusPercent` applied to one pool shared across all slabs (so the six slabs total 12%), or does each slab have its own pool of `turnover × percent`? The spec asks for prevention of over-allocation either way. | Each slab has its own pool, and a period's total payout must not exceed the sum of pools. |
| 5 | **Turnover definition.** Is CTO revenue (₹) or BV? Net of refunds? Does BV-wallet-paid orders count (also open in `superadmin-earnings-pending`)? | Revenue (₹) from paid orders, net of refunds, from `GrossVolumeService`. BV-wallet-paid orders included. |
| 6 | **Period length.** Weekly (as welcome bonus), monthly, or per settlement run? | Weekly, to match welcome bonus. SuperAdmin closes the period manually. |
| 7 | **Who shares a slab's pool.** Only members who first qualify for that slab in the period, or every member who holds the slab? | Members who first qualify in the period (the image says "all members who complete the pair… share the royalty bonus"). |
| 8 | **Lifetime limits.** Per slab (as the table) or one global cap across all slabs? | Per-slab counters, as in the table. |
| 9 | **Deductions and wallet.** Should TDS / admin fee apply (current stub) or not (architecture doc: no deductions)? Should payouts go to the rupee wallet or the BV wallet? | No deductions. Credited to rupee wallet. |
| 10 | **Equality.** Must left and right be exactly equal, or meet the threshold on each side? | Each side meets the threshold (≥). The stub already does this. |
| 11 | **Overlap with rewards.** 10:10 also pays ₹2,000 under `RewardService` (lifetime milestone rewards). Should both pay? | Both pay, since they are separate rules. Confirm. |
| 12 | **Unused pool.** Is leftover pool (undistributed or cap-reduced) kept by the company, or redistributed? | Kept by the company, recorded. |
| 13 | **Personal BV requirement.** Does the binary personal-BV minimum (100 BV) apply to this bonus? | No. Confirm. |

---

## 4. Implementation plan once answers are in

1. Disable the current stub path (remove it from `CompensationEngine` per-purchase loop) and migrate or void existing `TEAM_PERFORMANCE_BONUS` rows after checking them (section 1.1, item 5).
2. Models: `TeamPerformanceBonusConfig`, `MemberRewardPoints`, `TeamPerformanceBonusQualification`, `TeamPerformanceBonusPayout`, `CompanyTurnoverPeriod`, all with unique idempotency indexes.
3. Services: RP calculation from `BVLedger`, qualification, period settlement (reusing the welcome bonus pool pattern), preview.
4. APIs under SuperAdmin auth, with audit log entries for every slab edit and every settlement.
5. SuperAdmin UI: slab CRUD and activation, turnover and pool view, member-wise BV/RP table, payout history, preview.
6. Member dashboard panel.
7. Tests (Jest, alongside the existing tests in `backend/tests/`): unequal teams, multi-slab qualification, repeated requests, concurrent settlement, lifetime cap exhaustion, insufficient pool, idempotent re-run, and that binary and sponsor income outputs are unchanged.

---

## 5. Implementation status

Built (backend): models, RP and qualification, period settlement, preview, SuperAdmin config API, member status API, tests (`npm run test:team-performance`).

Not built yet: SuperAdmin UI section and member dashboard panel (frontend). `IncomeSettingsPage` still edits the old `CompensationRule.teamPerformanceBonus` field, which the engine no longer reads.
