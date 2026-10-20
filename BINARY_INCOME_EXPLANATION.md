# Binary Income: Rules and How It Works

Binary income is matched **once per day** (India Standard Time). Team BV builds up on each leg during the day, and after midnight IST the daily settlement matches it, applies the daily cap, and credits the wallet.

## 1. Quick reference

| Rule | Value |
|---|---|
| Activation | 100 BV from any source (orders, packages, BV received). 100 BV is locked once |
| Qualification | A member you sponsored in your left team **and** one in your right team, at any depth |
| 1st payout | 2,500 : 1,250 (either side) pays ₹250. The 1,250 is used; the 2,500 is kept |
| 2nd payout | The kept 2,500 plus 1,250 new BV on the other side pays ₹250 |
| 3rd payout onwards | Every 1,250 : 1,250 pays ₹250, with no limit |
| Carry forward | Unused BV carries to the next day and never expires |
| Daily cap | The member's package cap (highest package bought), or ₹4,000 without a package |
| Who earns | Only members. The Super Admin account has no member ID and earns no income |
| Above the cap | Flushed: the ₹ is lost, and the BV that produced it is still used up |
| Deductions | None. No TDS and no admin fee on any income |
| Payout | One wallet credit per member per day, after the IST day ends |
| Sponsor binary bonus | Switched off for now |

## 2. Activation and the 100 BV lock

When a member's personal BV plus BV Wallet balance reaches 100, binary income is activated and **100 BV is locked**, once and permanently:

1. It is taken from **personal BV first** (BV from approved orders). That BV has already been added to the upline legs, so it is only marked as locked.
2. Any shortfall is **debited from the BV Wallet** (transaction type `BINARY_ACTIVATION`) and credited once to every upline leg as `ACTIVATION` BV, so it is used in binary matching like any other team BV.
3. The locked BV is deducted from the member's Total BV and can never be sent or spent.

Members activated before the lock existed are locked the next time their BV is checked (dashboard, wallet, an order or a transfer), provided they have 100 BV available.

Code: `BVWalletService.activateFromWalletIfEligible`.

## 3. How team BV reaches the legs

When the Super Admin approves an order, its BV is added to every upline (`BVService.distributeVolumeToAncestors`). Each upline gets a `BVLedger` row on the leg the BV arrived on, with:

- `businessDate`: the IST day it belongs to
- `settlementStatus: PENDING`: waiting for that day's settlement

Lifetime leg totals (`BinaryVolume.leftTotalBV` / `rightTotalBV`) update immediately. Refunds add a PENDING reversal row that the next settlement subtracts.

BV held in the BV Wallet does not count as team volume, apart from the activation lock. It counts once it is spent on an order and the order is approved.

## 4. The daily settlement

`DailyBinarySettlementService` runs 5 minutes after midnight IST for the previous day. On startup it also settles any days it missed (up to 31). For each member with waiting BV or unmatched carry forward:

```
available = carry forward + that day's new BV (net of reversals)
matches   = computeMatches(available)        only if activated and sponsor-qualified
earned    = matches × ₹250
credited  = min(earned, daily cap)
flushed   = earned − credited
```

It writes one `BinaryDailyClosing` per member per day, holding:

- opening and closing carry forward
- new left/right BV
- matches
- earned, cap, credited and flushed amounts

The closing, the carry forward, the settled ledger rows and the commission are written in one transaction, then the wallet is credited.

- **Safe to re-run.** The unique `(memberId, businessDate)` index means a day is never paid twice. Re-running a day only settles members that are missing and retries failed wallet credits.
- **Safe across PM2 cluster workers.** `BinarySettlementRun` holds one lock per date.
- **Not qualified:** the BV stays as carry forward. Nothing is paid and nothing is flushed.

The pure matching rules are in `BinaryMatchingEngine.ts`.

## 5. Worked example

| Day | New BV | Result | Credited | Carry forward after |
|---|---|---|---|---|
| 1 | L 2,700 · R 1,250 | 1st payout (2,500 L kept, 1,250 R used) | ₹250 | L 200 · R 0 · kept 2,500 L |
| 2 | R 1,300 | 2nd payout (kept 2,500 L + 1,250 R) | ₹250 | L 200 · R 50 |
| 3 | L 1,100 · R 1,250 | 1 : 1 (1,300 : 1,300) | ₹250 | L 50 · R 50 |
| 4 | L 21,250 · R 21,250 | 17 matches = ₹4,250, cap ₹4,000 | ₹4,000 (₹250 flushed) | L 50 · R 50 |

## 6. API

| Endpoint | Who | What |
|---|---|---|
| `GET /api/binary/today/:memberId` | Member (self/downline), Super Admin | Live estimate for today (read only) |
| `GET /api/binary/daily/:memberId` | Same | Daily history with totals |
| `GET /api/binary/volume/:memberId` | Same | Dashboard summary |
| `GET /api/binary/ledger/:memberId` | Same | BV movements |
| `GET /api/binary/leaderboard?period=day\|week\|month` | Any member | Top earners (names masked for members) |
| `GET /api/binary/settlements[/:date]` | Super Admin | Settlement runs and per-member closings |
| `POST /api/binary/settle-daily { date }` | Super Admin | Settle or retry a finished day |

## 7. Tests

- `npm run test:binary`: matching rules, cap and IST dates (no database)
- `npm run test:binary-settlement`: end-to-end settlement against a local replica set (`MONGODB_URI=mongodb://127.0.0.1:27027/wetala_binary_test?replicaSet=rs0`)
