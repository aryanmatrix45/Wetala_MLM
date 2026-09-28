# Wetala MLM Platform: Architecture & Compensation Engine Specification

## 1. Architecture Overview

The system is built on a modular, enterprise-grade architecture:
- **Presentation Layer**: React (Vite + TypeScript) with a responsive dashboard, dual-tree visualizer (Binary vs. Sponsor), and an interactive Decimal-safe Compensation Simulator.
- **API & Controller Layer**: Express.js REST APIs with JWT authentication, role-based authorization (`superadmin`, `admin`, `member`), and validation.
- **Service Layer**: Decoupled domain services (`CompensationEngine`, `BinaryTreeService`, `SponsorTreeService`, `BVService`, `WalletService`, `AuditService`, and individual bonus services).
- **Persistence & Audit Layer**: MongoDB + Mongoose with schema validations, strict unique indexes, and an immutable double-entry ledger pattern for BV and Commissions.
- **Financial Precision**: All monetary operations utilize `DecimalUtil` (integer paise representation: ₹1 = 100 paise) to prevent IEEE 754 floating-point errors.

```
                          ┌────────────────────────┐
                          │   HTTP / REST API      │
                          └───────────┬────────────┘
                                      │
                   ┌──────────────────┴──────────────────┐
                   ▼                                     ▼
        ┌─────────────────────┐               ┌─────────────────────┐
        │ BinaryTreeService   │               │ SponsorTreeService  │
        │ (Binary Placement)  │               │ (Unilevel Referral) │
        └──────────┬──────────┘               └──────────┬──────────┘
                   │                                     │
                   └──────────────────┬──────────────────┘
                                      ▼
                        ┌───────────────────────────┐
                        │    CompensationEngine     │
                        │ (Idempotent Event Pipeline│
                        └─────────────┬─────────────┘
                                      │
       ┌──────────────────────────────┼──────────────────────────────┐
       ▼                              ▼                              ▼
┌──────────────┐              ┌───────────────┐              ┌──────────────┐
│  BVService   │              │  CapService   │              │WalletService │
│ (BV Ledger)  │              │(Daily Capping)│              │(Audit Ledger)│
└──────────────┘              └───────────────┘              └──────────────┘
```

---

## 2. Database Schema

### 2.1 Core MLM Models
1. **`Member` (`members` collection)**:
   - `memberId`: Unique uppercase distributor code (e.g., `MEM0101`).
   - `sponsorId`: Referrer code (**Sponsor Tree**).
   - `binaryParentId`: Immediate tree parent (**Binary Tree**).
   - `binaryPosition`: `LEFT` | `RIGHT` (with compound unique index on `{ binaryParentId, binaryPosition }`).
   - `rank`: Distributor rank.
   - `password`: Hashed using `bcryptjs` with `select: false`.
   - `isActive`, `status`: Active/inactive/blocked flags.

2. **`Package` (`packages` collection)**:
   - Configurable joining packages:
     - Package 1: ₹3,000, 1,250 BV (Daily Cap: ₹4,000)
     - Package 2: ₹6,500, 2,500 BV (Daily Cap: ₹4,000)
     - Package 3: ₹12,000, 5,000 BV (Daily Cap: ₹8,000)
     - Package 4: ₹24,000, 10,000 BV (Daily Cap: ₹15,000)

3. **`Purchase` (`purchases` collection)**:
   - `purchaseId`, `memberId`, `type` (`JOINING`, `REPURCHASE`, `RETAIL`).
   - `items`: Itemized array with unit price, paise, and BV.
   - `totalAmount`, `totalAmountInPaise`, `totalBV`.
   - `status`: `CONFIRMED`, `COMPLETED`, `REFUNDED`.

4. **`BVLedger` (`bvledgers` collection)**:
   - Immutable audit trail of Business Volume credits, matches, and flushes.
   - `openingBV`, `earnedBV`, `consumedBV`, `carriedForwardBV`, `flushedBV`, `closingBV`.

5. **`BinaryVolume` (`binaryvolumes` collection)**:
   - Cumulative totals: `leftTotalBV`, `rightTotalBV`, `matchedTotalBV`.
   - Live unmatched volume: `leftAvailableBV`, `rightAvailableBV`.
   - `leftCarryForwardBV`, `rightCarryForwardBV`.

6. **`CompensationRule` (`compensationrules` collection)**:
   - Active versioned configuration for Binary, Team, Welcome, Sponsor, Self Purchase, Rewards, Franchise, Upline, and Royalty rules.

7. **`CompensationEvent` (`compensationevents` collection)**:
   - Guarantees strict idempotency via `eventId` (e.g. `EVENT-PURCHASE-123`).

8. **`CommissionLedger` (`commissionledgers` collection)**:
   - Immutable records with `type`, `grossAmount`, `tdsDeduction` (5%), `adminFee` (5%), `payableAmount`, and detailed calculation metadata.

9. **`Wallet` & `WalletTransaction`**:
   - `availableBalance`, `pendingBalance`, `totalEarned`, `withdrawnAmount`.
   - Every credit or debit logs an immutable transaction with balance before/after.

10. **`AuditLog` (`auditlogs` collection)**:
    - Immutable logs recording entity changes, old values, new values, performed by, and timestamps.

---

## 3. API Endpoints

### Authentication & Profile
- `POST /api/auth/login`: Unified login for SuperAdmin, Admin, and Members via Email/MemberID + Password.
- `GET /api/auth/me`: Authenticated profile.

### Binary Tree & Placement
- `GET /api/binary/tree?root=MEM0001&depth=4`: Visual binary tree hierarchy.
- `POST /api/binary/validate-placement`: Placement validation (prevents duplicate legs, self-placement, or circular downline assignment).
- `GET /api/binary/volume/:memberId`: Live left/right total and unmatched available BV.
- `GET /api/binary/available-placement/:memberId?leg=LEFT`: Automatic spillover placement finder.

### Sponsor Tree (Unilevel)
- `GET /api/sponsor/tree?root=MEM0001&depth=3`: Unilevel sponsor referral tree.
- `GET /api/sponsor/directs/:memberId`: Direct referral list.

### Compensation Engine & Simulator
- `GET /api/compensation/rules`: Active compensation configuration.
- `PUT /api/compensation/rules`: Admin updates to rules with automatic audit logging.
- `POST /api/compensation/simulate`: Decimal-safe compensation simulator.
- `GET /api/compensation/commission/:commissionId`: Commission Explanation API with step-by-step arithmetic.
- `GET /api/compensation/commissions`: Filterable commission ledger query.

### Purchases & Reversals
- `POST /api/purchases`: Create purchase and automatically trigger commission pipeline.
- `POST /api/purchases/:purchaseId/complete`: Process purchase event idempotently.
- `POST /api/purchases/:purchaseId/refund`: Claw back commissions with negative reversal ledger entries.
- `GET /api/purchases`: Purchase history.

### Wallet & Payouts
- `GET /api/wallet/:memberId`: Wallet balances.
- `GET /api/wallet/transactions/:memberId`: Audit transaction history.
- `POST /api/wallet/withdraw`: Request withdrawal.

### Reports & Audits
- `GET /api/reports/overview`: Sales, BV, commissions, and member summaries.
- `GET /api/reports/audit-logs`: Administrative audit trail.

---

## 4. Compensation Formulas

### 4.1 Binary Matching Bonus
$$\text{matchedBV} = \min(\text{leftAvailableBV}, \text{rightAvailableBV})$$
$$\text{rawCommission} = \text{matchedBV} \times \text{binaryRate} \quad (\text{default standard rate } = 20\%)$$
$$\text{dailyRemainingCap} = \max(0, \text{dailyBinaryPayoutCap} - \text{alreadyEarnedToday})$$
$$\text{payableBinaryCommission} = \min(\text{rawCommission}, \text{dailyRemainingCap})$$
$$\text{excessCommission} = \text{rawCommission} - \text{payableBinaryCommission} \quad (\text{policy: FLUSH, HOLD, or CARRY\_FORWARD})$$

### 4.2 Sponsor Binary Income
$$\text{sponsorBonus} = \text{downlineBinaryCommission} \times \text{sponsorBinaryRate} \quad (20\%)$$

### 4.3 Self Purchase Bonus (Repurchase Only)
$$\text{selfPurchaseBonus} = \text{qualifyingBase} \times 8\% \quad (\text{base: BV or Purchase Value})$$

### 4.4 Team Volume Bonus Tiers
| Left Volume (BV) | Right Volume (BV) | Tier Rate |
| :--- | :--- | :--- |
| 1,000 | 1,000 | 15% |
| 2,500 | 2,500 | 10% |
| 7,500 | 7,500 | 7% |
| 25,000 | 25,000 | 6% |
| 35,000 | 35,000 | 5% |
| 70,000 | 70,000 | 4% |
| 150,000 | 150,000 | 3% |
| 300,000 | 300,000 | 2% |

### 4.5 Franchise / Stockist Incentives
- ₹50,000 bulk stock purchase $\rightarrow 5\%$ incentive
- ₹100,000 bulk stock purchase $\rightarrow 8\%$ incentive
- ₹500,000 bulk stock purchase $\rightarrow 10\%$ incentive
- ₹1,000,000 bulk stock purchase $\rightarrow 12\%$ incentive
- Plus 2% Upline Bonus to direct sponsor.

### 4.6 Lifetime Milestone Rewards
- 5:5 pairs $\rightarrow$ ₹1,000 (Bronze Achiever)
- 10:10 pairs $\rightarrow$ ₹2,000 (Silver Achiever)
- Subsequent tiers (50:50, 100:100, etc.) are configurable with amounts set to null until confirmed.

---

## 5. Binary Algorithm Explanation

1. **Placement Validation**:
   - Checks if the target parent exists.
   - Validates that the requested `binaryPosition` (`LEFT` or `RIGHT`) is not already occupied.
   - Prevents self-parenting and circular descendants.
2. **Volume Rollup**:
   - When a purchase completes under member $M$, the engine walks up binary parents to root.
   - At each ancestor, it detects whether $M$ belongs to the ancestor's `LEFT` or `RIGHT` branch.
   - Increments `leftTotalBV` and `leftAvailableBV` (or right equivalent).
   - Generates an immutable `BVLedger` entry for the ancestor.
3. **Matching & Carry-Forward**:
   - Evaluates $\min(\text{leftAvailableBV}, \text{rightAvailableBV})$.
   - Deducts matched volume from both legs.
   - Carries forward unmatched balance if `volumeCarryForwardMode == 'CARRY_FORWARD'`.

---

## 6. Sponsor-Tree Algorithm Explanation

- The sponsor relationship records who directly introduced each distributor to the business.
- Independent of binary placement ($A$ can sponsor $B$, but $B$ can be placed under $X$ in the binary tree).
- `SponsorTreeService.getSponsorUplineChain` traverses up through `sponsorId` up to $N$ levels to distribute Sponsor Binary Bonuses and Upline Bonuses.

---

## 7. Commission Ledger & Wallet Flow

```
1. Qualifying Purchase Event (e.g. PURCHASE-001)
     │
2. Idempotency Check (CompensationEvent)
     │
3. Calculate Commission (Raw Amount)
     │
4. Apply Daily Capping (CapService) -> Payable vs. Excess
     │
5. Deductions: 5% TDS + 5% Admin Fee
     │
6. Write to CommissionLedger (Immutable entry with full calculation breakdown)
     │
7. Update Wallet:
     - Available Balance += Net Payable
     - Total Earned += Net Payable
     - Write to WalletTransaction (balanceBefore, balanceAfter, referenceId)
```

---

## 8. Remaining Business-Rule Questions for Stakeholder Alignment

The following items are implemented as configurable rules with `TODO` annotations:
1. **Welcome Bonus 4:1**: Exact formula for "Company turns 4:1" and whether it is pool-based or transaction-based.
2. **20% vs. 25% Binary Rate**: The exact business conditions required for the special 25% binary rate.
3. **Consultancy Bonus**: Confirmation of product criteria for "₹2500 per product, 3 months, 4th month free".
4. **Team Performance Bonus**: Confirmation of payout formula for 10:10, 100:100, 1000:1000 thresholds.
5. **Reward Amounts After 10:10**: Rupee reward amounts for 50:50 up to 40,000:40,000.
6. **Royalty Pool Formula**: Company turnover pool share, qualification reset cadence, and rank eligibility.
7. **Franchise Classification**: Confirmation whether percentages represent discounts, retail margins, or wallet commissions.

---

## 9. Instructions to Run the Project

### Prerequisites
- Node.js (v18+)
- MongoDB Atlas or local MongoDB instance (`MONGODB_URI` in `backend/.env`)

### Backend Setup
```bash
cd backend
npm install
npm run build   # Verifies TypeScript compilation
npm run dev     # Runs server with tsx watch on http://localhost:5000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run build   # Verifies production build
npm run dev     # Starts Vite dev server on http://localhost:5173
```
