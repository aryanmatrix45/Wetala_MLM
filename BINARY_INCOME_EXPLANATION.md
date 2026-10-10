# Wetala Direct Selling MLM - Binary Income & Activation Blueprint

This document provides a comprehensive, client-ready guide explaining **how Member IDs become active in the binary tree**, **how Business Volume (BV) flows**, and **how Binary Matching Income is calculated and paid out**.

---

## 1. Quick Reference: Key Parameters

| Parameter | Value / Rule | Description |
| :--- | :--- | :--- |
| **ID Binary Activation** | **100 Personal BV** | Cumulative self-purchase of packages/products $\ge$ 100 BV activates binary participation. |
| **Direct Sponsor Rule** | **1 Left + 1 Right** | Must personally sponsor at least 1 active member on Left leg and 1 on Right leg. |
| **Matching Unit** | **1,250 BV** | 1 Pair / Cycle unit. |
| **Payout Rate** | **₹250 per Cycle** | Each completed binary match generates ₹250 gross. |
| **1st Payout Ratio** | **2:1 or 1:2** (2,500 BV : 1,250 BV) | 1,250 BV consumed from weaker leg; 2,500 BV on dominant leg is **reserved** for Payout 2. |
| **2nd Payout Ratio** | **Carried Forward + 1:1** | Consumes the 2,500 reserved BV + 1,250 new BV on the opposite leg. |
| **3rd+ Subsequent Payouts** | **1:1 Permanent** (1,250 BV : 1,250 BV) | Every 1,250 BV Left + 1,250 BV Right generates ₹250. |
| **Power Leg Carry-Forward** | **Indefinite (No Expiry)** | Unmatched excess Business Volume is never lost; carries forward to the next day. |
| **Daily Capping** | **Package-based** (e.g. ₹4,000 to ₹20,000/day) | Maximum binary income a member can earn in 24 hours. Admin/SuperAdmin is uncapped. |
| **Capped Volume Flush Rule** | **100% Flushed (No Carry Forward)** | All Business Volume matched and used to calculate pairs up to and beyond the daily cap is fully consumed and flushed. It does NOT carry forward. Only fresh volume from subsequent purchases counts for the next day. |
| **Direct Sponsor Bonus** | **20% Uncapped** | Direct sponsor earns 20% on all binary income earned by their personally sponsored downlines. |
| **Statutory Deductions** | **TDS (5%) + Admin Fee (5%)** | Configurable by company admin; net amount credited directly to Member Wallet. |

---

## 2. How an ID Becomes Active & Participates in the Tree

### Step 1: Account Registration
- When a user signs up or is added by an admin, their member record is created with a unique ID (e.g., `MEM0001`, `MEM0008`).
- The member is placed into the binary genealogy tree under a **Binary Parent** (`parentId`) on either the **LEFT** or **RIGHT** leg (`position`).

### Step 2: Binary Tree Participation Threshold (`isBinaryActive`)
- In Wetala MLM, simple registration does **not** qualify a member to participate in binary matching.
- **Activation Requirement**: The member must accumulate at least **100 Personal Business Volume (100 PBV)** through:
  1. Purchasing any joining/upgrade package, **OR**
  2. Repurchasing company wellness products.
- **Visual Status in Genealogy Tree**:
  - **`Needs 100 BV` (Inactive in Binary)**: The member appears with a yellow/gray indicator showing they need 100 BV. They hold their position in the tree, but cannot earn binary income.
  - **`Binary Active` (Green / Qualified)**: As soon as cumulative personal BV reaches $\ge 100$, `isBinaryActive` automatically becomes `true`, and `binaryActivatedAt` is timestamped.

---

## 3. How Business Volume (BV) Accumulates & Flows Up

1. **Purchases Generate BV**: Every package and product in the store has a defined Business Volume (BV) value.
   - Example: A product package worth ₹1,098 may carry **390 BV** or **1,250 BV**.
2. **Infinite Upline Flow**: When any member in your downline makes a verified purchase:
   - If that member is located in your **LEFT** subtree $\rightarrow$ the BV is added to your **Left Available BV** (`leftAvailableBV`) and **Left Total BV**.
   - If that member is located in your **RIGHT** subtree $\rightarrow$ the BV is added to your **Right Available BV** (`rightAvailableBV`) and **Right Total BV**.
3. **Spillover Benefit**: Even if a member was not sponsored by you (spillover placed under you by upline leaders), **100% of the BV generated below you counts toward your leg volume!**

---

## 4. Qualification Rules to Start Earning Binary Income

To receive binary payouts, a member must satisfy **two mandatory eligibility conditions**:

```
                              [ YOU ]
                     (Self Personal BV >= 100)
                            /         \
                           /           \
                 [ LEFT LEG ]         [ RIGHT LEG ]
               At least 1 Direct      At least 1 Direct
               Active Sponsor         Active Sponsor
```

1. **Personal ID Qualified**: Your own account must have $\ge 100$ Personal BV (`isBinaryActive = true`).
2. **Sponsor Leg Eligibility (1 Left + 1 Right)**:
   - You must have personally sponsored at least **1 active member** anywhere in your Left binary subtree.
   - AND you must have personally sponsored at least **1 active member** anywhere in your Right binary subtree.
   *(Note: They do not need to be your immediate children; they just need to be your direct sponsor referrals located anywhere in that leg's subtree).*

---

## 5. The Sequential Binary Payout Mechanism

Wetala uses a fair, sequential binary matching engine that protects company sustainability while rewarding leaders:

### Payout 1: The Initial Ratio (2:1 or 1:2)
- **Requirement**: **2,500 BV on one leg** and **1,250 BV on the opposite leg**.
- **Execution**:
  - The weaker leg consumes **1,250 BV**.
  - The dominant leg **reserves 2,500 BV** (this 2,500 BV is not flushed or lost; it is locked in reserve for your 2nd payout).
- **Earnings**: **₹250**.

### Payout 2: The Reserve Match
- **Requirement**: The **2,500 BV reserved** from Payout 1 + **1,250 NEW available BV** on the opposite leg.
- **Execution**:
  - 1,250 new BV is consumed on the weaker leg.
  - The 2,500 reserved BV is fully consumed.
  - Reserved balance resets to 0.
- **Earnings**: **₹250**.

### Payout 3 and All Subsequent Payouts: Permanent 1:1 Matching
- **Requirement**: **1,250 BV on Left** and **1,250 BV on Right** (1:1 Ratio).
- **Execution**:
  - Consumes 1,250 BV from Left and 1,250 BV from Right for each pair.
  - Any excess volume carries forward indefinitely.
- **Earnings**: **₹250 per pair**.

```
[ Payout #1 ] -> 2,500 BV : 1,250 BV (2:1 or 1:2)  ==> ₹250  (2,500 BV Reserved)
[ Payout #2 ] -> 2,500 BV (Reserved) + 1,250 BV New ==> ₹250  (Reserve Cleared)
[ Payout #3+] -> 1,250 BV : 1,250 BV (1:1 permanent) ==> ₹250 per pair forever
```

---

## 6. Daily Capping & Volume Flush Policy (Crucial Business Rule)

This is one of the most critical sustainability rules in the Wetala MLM compensation plan:

### 1. Excess Income is Flushed
- If a member generates more binary income than their package daily limit in a 24-hour cycle, the excess amount is **flushed out** and never paid.
- **Example**: If generated binary income is **₹8,000** and the daily cap is **₹4,000**, the member is paid **₹4,000**. The remaining **₹4,000 is completely flushed**.

### 2. Business Volume (BV) Used Beyond the Cap is ALSO Flushed (No Carry-Forward)
- **The Core Rule**: The Business Volume that was matched to generate that ₹8,000 (all 32 pairs = 40,000 BV Left & 40,000 BV Right) is **fully consumed and wiped out**.
- **It does NOT carry forward to the next day.**
- Members cannot "save" or carry forward capped volume to get paid tomorrow. Once pairs are matched, that volume is considered consumed.

### 3. What DOES Carry Forward?
- Only **unmatched excess volume** from an unequal leg carries forward.
- **Example**: If a member had **60,000 BV on Left** and **40,000 BV on Right**:
  - 40,000 BV on Left matches with 40,000 BV on Right (32 pairs = ₹8,000).
  - The 40,000 BV on Left and 40,000 BV on Right are **fully consumed and flushed** (paying ₹4,000 capped).
  - The leftover **20,000 BV on Left** (which had no partner on the Right) **carries forward indefinitely** to future days.

### 4. Fresh Volume for Next Day
- After the daily settlement runs and resets the matched volume:
  - If any member in the downline makes a new purchase (e.g., 2,500 BV Left and 2,500 BV Right), that **fresh BV is added to the available balance**.
  - That new BV will be calculated during the next day's settlement.

---

## 7. Live Tree Analysis: How Aryan Yadav (MEM0001) Generates Income

Looking at the current genealogy tree image:

```
                         [ Aryan Yadav (MEM0001) ]
                            Badge: BASIC | Needs 100 BV
                            Left BV: 2,390 BV | Right BV: 0 BV
                                /                \
                               /                  \
                     [ Left Wing ]              [ Right Wing ]
                   Test 12 (MEM0002)          Test 26 (MEM0003)
                 L: 2000 BV | R: 390 BV     L: 0 BV | R: 0 BV
```

### Why Aryan is Not Earning Right Now
1. **Self-BV Pending (`Needs 100 BV`)**: Aryan currently has less than 100 Personal BV. His ID must be activated with at least 100 BV.
2. **Right Leg Volume is 0 BV**: Aryan's Left leg has **2,390 BV**, but his Right leg has **0 BV**. Binary income requires matching volume from both legs.
3. **Sponsorship Check**: Aryan must ensure he has at least 1 direct referral active on the Left leg and 1 direct referral active on the Right leg.

---

### Step-by-Step Path for Aryan to Start Earning

#### Phase 1: ID Activation
- Aryan makes a package purchase or product repurchase of $\ge 100\text{ BV}$.
- The `Needs 100 BV` tag disappears, and Aryan becomes **Binary Active**.

#### Phase 2: Generating First Payout (₹250)
- **Left Leg**: Currently has **2,390 BV**. A member on the Left downline (e.g., Dynamic 1 or Ramesh) purchases products giving **110 BV**.
  $$\text{Left Leg Total} = 2,390 + 110 = \mathbf{2,500\text{ BV}}$$
- **Right Leg**: A member on the Right downline (e.g., Test 26, Test101, or Test102) purchases a package of **1,250 BV**.
  $$\text{Right Leg Total} = \mathbf{1,250\text{ BV}}$$
- **Matching Result**:
  - Stage 1 Ratio: 2,500 BV Left : 1,250 BV Right (2:1 match).
  - Right leg consumes 1,250 BV $\rightarrow$ Right balance = $0\text{ BV}$.
  - Left leg holds 2,500 BV in **Reserved Balance** for Payout 2.
  - **Aryan earns: ₹250 gross!**

#### Phase 3: Generating Second Payout (₹250)
- Aryan's Left leg still has the **2,500 BV Reserved**.
- Now, another member on the Right leg (e.g., Dynamic 5 or Dynamic 8) makes a purchase generating **1,250 BV**.
- **Matching Result**:
  - The 1,250 new BV on Right matches with the 2,500 reserved BV on Left.
  - Both are consumed $\rightarrow$ Reserved balance becomes 0.
  - **Aryan earns: ₹250 gross!**
  - Total earned so far = **₹500**.

#### Phase 4: Subsequent 1:1 Matching
- From this moment on, every time:
  - Left leg generates **1,250 BV**
  - Right leg generates **1,250 BV**
- **Aryan earns: ₹250 per pair continuously!**
- If Left leg generates 12,500 BV and Right leg generates 12,500 BV in a day:
  $$\text{Pairs} = \frac{12,500}{1,250} = 10\text{ pairs} \implies 10 \times ₹250 = \mathbf{₹2,500\text{ for the day!}}$$

---

## 8. Detailed Working Examples

### Example 1: Fresh Member with Balanced Legs
- **Member Rahul** activates with 100 BV and sponsors Priya (Left) and Amit (Right).
- **Day 1**: Left generates 2,500 BV; Right generates 1,250 BV.
  - **Payout #1 (2:1)**: ₹250 earned.
  - Left: 2,500 BV reserved. Right: 0 BV remaining.
- **Day 2**: Right generates 1,250 BV. Left generates 0 BV.
  - **Payout #2**: ₹250 earned (matches the reserved 2,500 BV).
  - Left: 0 BV remaining. Right: 0 BV remaining.
- **Day 3**: Left generates 2,500 BV; Right generates 2,500 BV.
  - **Payout #3 & #4 (1:1)**: 2 pairs matched ($2 \times ₹250$).
  - Rahul earns ₹500.

---

### Example 2: Massive Power Leg (Spillover Leg)
- **Member Sneha** has an active upline who places strong leaders on her Left leg.
- Her Left leg accumulates **50,000 BV** (Power Leg).
- Her Right leg is at **0 BV**.
- Because Wetala features **100% Volume Carry-Forward**, the 50,000 BV never expires!
- Sneha focuses on building her Right leg:
  - Right leg generates 1,250 BV $\rightarrow$ Payout #1 triggers (2:1 with Left's volume): Sneha earns **₹250**.
  - Right leg generates another 1,250 BV $\rightarrow$ Payout #2 triggers: Sneha earns **₹250**.
  - Over the month, Sneha's Right team generates 25,000 BV:
    $$\text{Pairs} = \frac{25,000}{1,250} = 20\text{ pairs} \implies 20 \times ₹250 = \mathbf{₹5,000\text{ earned!}}$$
  - Left leg still has $50,000 - \text{consumed BV}$ safely carried forward!

---

### Example 3: ₹8,000 Earned vs ₹4,000 Daily Cap (Flushed Volume Illustrated)
- **Member Vikram** holds an entry package with a Daily Capping of **₹4,000/day** (Maximum 16 pairs/day).
- **Today's Activity**:
  - Left leg generates: **40,000 BV**
  - Right leg generates: **40,000 BV**
- **Calculated Matching**:
  $$\text{Pairs Matched} = \frac{40,000\text{ BV}}{1,250\text{ BV}} = 32\text{ pairs}$$
  $$\text{Potential Income} = 32 \times ₹250 = \mathbf{₹8,000}$$
- **Applying the Daily Capping & Flush Rule**:
  1. **Paid Amount**: Vikram is paid **₹4,000** (capped at his package limit of 16 pairs).
  2. **Flushed Income**: The extra **₹4,000 is flushed out** (company surplus).
  3. **Flushed Business Volume**: All **40,000 BV on Left and 40,000 BV on Right** used to form those 32 pairs are **CONSUMED & FLUSHED**.
     - **None of the 40,000 BV carries forward to tomorrow.**
     - Left Available BV at end of day = **0 BV**.
     - Right Available BV at end of day = **0 BV**.
- **What Happens the Next Day?**:
  - Vikram starts the next day with **0 BV** on both legs.
  - During the new day, downline members purchase products generating:
    - Left Leg: **5,000 BV** (4 new pairs)
    - Right Leg: **5,000 BV** (4 new pairs)
  - This fresh volume is evaluated for the next day's settlement:
    $$4\text{ pairs} \times ₹250 = \mathbf{₹1,000\text{ earned for the new day!}}$$

---

### Example 4: The Sponsor Multiplier (20% Direct Referral Bonus)
- **Aryan** personally sponsors 4 active leaders: Rahul, Sneha, Vikram, and Pooja.
- This week, each of these 4 leaders earns binary income:
  - Rahul earns: ₹5,000 binary income
  - Sneha earns: ₹4,000 binary income
  - Vikram earns: ₹6,000 binary income
  - Pooja earns: ₹5,000 binary income
  - **Total Binary Earned by Aryan's Directs**: ₹20,000.
- **Aryan's 20% Direct Sponsor Bonus**:
  $$\text{Bonus} = 20\% \times ₹20,000 = \mathbf{₹4,000}$$
- **Key Advantage**: The 20% Sponsor Bonus is **100% Uncapped** and credited on top of Aryan's own binary matching income!

---

## 9. Summary Checklist for Any Member to Earn Binary Income

| Step | Action Required | Status Check |
| :---: | :--- | :--- |
| **1** | Self-activate ID with minimum **100 Personal BV**. | Removes `Needs 100 BV` badge. |
| **2** | Sponsor at least **1 active member on Left** and **1 active member on Right**. | Unlocks binary commission eligibility. |
| **3** | Support team to generate volume on both legs. | Accumulates BV. |
| **4** | First Payout triggers at **2,500 : 1,250 BV** (2:1 or 1:2). | Receives ₹250. |
| **5** | Second Payout triggers with **1,250 new BV** on weaker leg. | Receives ₹250. |
| **6** | All subsequent payouts trigger at **1,250 : 1,250 BV (1:1)**. | Receives ₹250 per pair continuously. |
| **7** | Daily midnight settlement credits net earnings directly to Member Wallet. | Ready for payout withdrawal. |
