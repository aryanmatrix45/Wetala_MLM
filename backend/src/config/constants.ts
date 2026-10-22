export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export const ROLES = {
  SUPERADMIN: 'superadmin',
  MEMBER: 'member',
} as const;

export const BINARY_POSITION = {
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
} as const;

export type BinaryPosition = typeof BINARY_POSITION[keyof typeof BINARY_POSITION];

export const PURCHASE_TYPE = {
  JOINING: 'JOINING',
  REPURCHASE: 'REPURCHASE',
  RETAIL: 'RETAIL',
  OTHER: 'OTHER',
} as const;

export type PurchaseType = typeof PURCHASE_TYPE[keyof typeof PURCHASE_TYPE];

export const PURCHASE_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
} as const;

export type PurchaseStatus = typeof PURCHASE_STATUS[keyof typeof PURCHASE_STATUS];

export const COMMISSION_TYPE = {
  WELCOME_BONUS: 'WELCOME_BONUS',
  BINARY_BONUS: 'BINARY_BONUS',
  SPONSOR_BINARY_BONUS: 'SPONSOR_BINARY_BONUS',
  SELF_PURCHASE_BONUS: 'SELF_PURCHASE_BONUS',
  TEAM_PERFORMANCE_BONUS: 'TEAM_PERFORMANCE_BONUS',
  UPLINE_BONUS: 'UPLINE_BONUS',
  FRANCHISE_BONUS: 'FRANCHISE_BONUS',
  REWARD: 'REWARD',
  ADJUSTMENT: 'ADJUSTMENT',
  REVERSAL: 'REVERSAL',
} as const;

export type CommissionType = typeof COMMISSION_TYPE[keyof typeof COMMISSION_TYPE];

export const BV_SOURCE_TYPE = {
  JOINING_PACKAGE: 'JOINING_PACKAGE',
  REPURCHASE: 'REPURCHASE',
  RETAIL: 'RETAIL',
  ADJUSTMENT: 'ADJUSTMENT',
  MATCHED: 'MATCHED',
  FLUSHED: 'FLUSHED',
  REVERSAL: 'REVERSAL',
  ACTIVATION: 'ACTIVATION', // the 100 BV locked from a member's account at binary activation
} as const;

export type BVSourceType = typeof BV_SOURCE_TYPE[keyof typeof BV_SOURCE_TYPE];

export const EXCESS_CAP_POLICY = {
  FLUSH: 'FLUSH',
  HOLD: 'HOLD',
  CARRY_FORWARD: 'CARRY_FORWARD',
} as const;

export type ExcessCapPolicy = typeof EXCESS_CAP_POLICY[keyof typeof EXCESS_CAP_POLICY];

export const VOLUME_CARRY_FORWARD_MODE = {
  CARRY_FORWARD: 'CARRY_FORWARD',
  FLUSH: 'FLUSH',
} as const;

export type VolumeCarryForwardMode = typeof VOLUME_CARRY_FORWARD_MODE[keyof typeof VOLUME_CARRY_FORWARD_MODE];

export const COMPENSATION_EVENT_TYPE = {
  PURCHASE_COMPLETED: 'PURCHASE_COMPLETED',
  REPURCHASE_COMPLETED: 'REPURCHASE_COMPLETED',
  COMMISSION_REVERSED: 'COMMISSION_REVERSED',
  MANUAL_ADJUSTMENT: 'MANUAL_ADJUSTMENT',
} as const;

export type CompensationEventType = typeof COMPENSATION_EVENT_TYPE[keyof typeof COMPENSATION_EVENT_TYPE];

export const COMPENSATION_EVENT_STATUS = {
  PENDING: 'PENDING',
  PROCESSED: 'PROCESSED',
  FAILED: 'FAILED',
  REVERSED: 'REVERSED',
} as const;

export type CompensationEventStatus = typeof COMPENSATION_EVENT_STATUS[keyof typeof COMPENSATION_EVENT_STATUS];

// ---------------------------------------------------------------------------
// BV Wallet: transferable BV credit balances (separate from earned personal/binary BV)
// ---------------------------------------------------------------------------

export const BV_WALLET = {
  ADMIN_OWNER_ID: 'ADMIN',
  ADMIN_DISPLAY_NAME: 'Super Admin',
  // Counterparty for BV that enters or leaves wallets through the system (welcome bonus, order payments)
  SYSTEM_OWNER_ID: 'SYSTEM',
  // Personal BV + BV Wallet balance needed to activate binary tree participation. This much BV is
  // locked at activation (personal BV first, then wallet) and fed into the binary tree exactly once.
  ACTIVATION_BV: 100,
  MAX_GENERATE_BV: Number(process.env.BV_MAX_GENERATE) || 10_000_000,
  MAX_ADMIN_TRANSFER_BV: Number(process.env.BV_MAX_ADMIN_TRANSFER) || 10_000_000,
  MAX_MEMBER_TRANSFER_BV: Number(process.env.BV_MAX_MEMBER_TRANSFER) || 100_000,
  // A second identical transfer (same sender, recipient and amount) inside this window needs explicit confirmation
  REPEAT_WARNING_WINDOW_MS: 2 * 60 * 1000,
  TITLE_MAX_LENGTH: 100,
  NOTE_MAX_LENGTH: 500,
} as const;

export const BV_OWNER_TYPE = {
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  SYSTEM: 'SYSTEM', // no wallet: welcome bonus source, order payment sink
} as const;

export type BVOwnerType = typeof BV_OWNER_TYPE[keyof typeof BV_OWNER_TYPE];

export const BV_TXN_TYPE = {
  GENERATION: 'GENERATION',
  TRANSFER: 'TRANSFER',
  REVERSAL: 'REVERSAL', // admin-only correction that moves a transfer's BV back
  WELCOME_BONUS: 'WELCOME_BONUS', // weekly welcome bonus share credited as BV
  PURCHASE: 'PURCHASE', // BV spent on a product / package order
  PURCHASE_REFUND: 'PURCHASE_REFUND', // BV returned when a BV-paid order is rejected or refunded
  BINARY_ACTIVATION: 'BINARY_ACTIVATION', // wallet BV locked at binary activation and fed into the tree
  RETURN_REQUESTED: 'RETURN_REQUESTED', // member's BV held while a return to the company waits for approval
  RETURN_APPROVED: 'RETURN_APPROVED', // held BV handed to the Super Admin wallet
  RETURN_RELEASED: 'RETURN_RELEASED', // held BV given back (return rejected or cancelled)
} as const;

export type BVTxnType = typeof BV_TXN_TYPE[keyof typeof BV_TXN_TYPE];

export const BV_TXN_STATUS = {
  COMPLETED: 'COMPLETED',
  REVERSED: 'REVERSED', // a completed transfer that a later REVERSAL undid
} as const;

export type BVTxnStatus = typeof BV_TXN_STATUS[keyof typeof BV_TXN_STATUS];

export const BV_LEDGER_ENTRY = {
  GENERATE: 'GENERATE', // admin mints BV
  DEBIT_OUT: 'DEBIT_OUT', // BV leaves the sender's wallet
  CREDIT_IN: 'CREDIT_IN', // BV arrives in the recipient's wallet
} as const;

export type BVLedgerEntryType = typeof BV_LEDGER_ENTRY[keyof typeof BV_LEDGER_ENTRY];

export const BV_RETURN_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

export type BVReturnStatus = typeof BV_RETURN_STATUS[keyof typeof BV_RETURN_STATUS];

// ---------------------------------------------------------------------------
// Super Admin earnings: BV sold at the BV rate, plus package / product orders paid by bank / UPI
// ---------------------------------------------------------------------------

export const COMPANY_EARNING_TYPE = {
  BV_SALE: 'BV_SALE', // Super Admin sent BV to a member: + BV x rate
  BV_SALE_REVERSED: 'BV_SALE_REVERSED', // that transfer reversed: - the sale amount
  BV_RETURNED: 'BV_RETURNED', // a member's return approved: - BV x the member's average purchase price
  ORDER_PAID: 'ORDER_PAID', // bank / UPI order marked as paid: + order total
  ORDER_REFUNDED: 'ORDER_REFUNDED', // that order refunded: - order total
} as const;

export type CompanyEarningType = typeof COMPANY_EARNING_TYPE[keyof typeof COMPANY_EARNING_TYPE];

export const BV_RATE = {
  MAX_RUPEES_PER_BV: 100_000,
  NOTE_MAX_LENGTH: 300,
} as const;

// ---------------------------------------------------------------------------
// Welcome bonus: weekly pool paid as BV (defaults when the active rule set has no value)
// ---------------------------------------------------------------------------

/** Team Performance Bonus starting rules; SuperAdmin edits them in Team Performance Bonus settings */
export const TEAM_PERFORMANCE_BONUS_DEFAULTS = {
  RP_BV_UNIT: 1250, // 1250 BV = 1 reward point
  SLABS: [
    { slabId: 'TPB-10', leftRp: 10, rightRp: 10, percent: 3, lifetimeLimit: 10000, isActive: true },
    { slabId: 'TPB-100', leftRp: 100, rightRp: 100, percent: 3, lifetimeLimit: 30000, isActive: true },
    { slabId: 'TPB-400', leftRp: 400, rightRp: 400, percent: 2, lifetimeLimit: 100000, isActive: true },
    { slabId: 'TPB-1600', leftRp: 1600, rightRp: 1600, percent: 2, lifetimeLimit: 300000, isActive: true },
    { slabId: 'TPB-5000', leftRp: 5000, rightRp: 5000, percent: 1, lifetimeLimit: 500000, isActive: true },
    { slabId: 'TPB-25000', leftRp: 25000, rightRp: 25000, percent: 1, lifetimeLimit: 1500000, isActive: true },
  ],
};

export const WELCOME_BONUS_DEFAULTS = {
  RATE_PERCENT: 4, // share of the company's weekly gross BV that forms the pool
  MAX_MULTIPLIER: 2, // lifetime earnings stop at this many times the member's lifetime BV
  MIN_LIFETIME_BV: 1250, // BV the member must have received in its lifetime (orders + transfers in)
  MIN_SPONSORED_COUNT: 2, // directly sponsored binary-active members (100 BV+), placed anywhere in the tree
  // Finished weeks the admin can still pick for settlement
  SETTLEABLE_WEEKS: 8,
} as const;

// ---------------------------------------------------------------------------
// Binary income: daily matching and settlement
// ---------------------------------------------------------------------------

export const BINARY_SETTLEMENT = {
  // Business days follow India Standard Time (UTC+05:30, no daylight saving)
  TIMEZONE_OFFSET_MINUTES: 330,
  // Daily cap when the member has not bought a package with its own cap
  DEFAULT_DAILY_CAP: 4000,
  // The scheduler settles the previous day this long after IST midnight
  RUN_DELAY_MS: 5 * 60 * 1000,
  // A RUNNING settlement with no heartbeat for this long is treated as crashed and can be taken over
  STALE_RUN_MS: 15 * 60 * 1000,
  // How many missed days the scheduler settles on startup
  MAX_CATCH_UP_DAYS: 31,
} as const;

export const BV_SETTLEMENT_STATUS = {
  PENDING: 'PENDING', // team BV not yet included in a daily binary closing
  SETTLED: 'SETTLED',
} as const;

export type BVSettlementStatus = typeof BV_SETTLEMENT_STATUS[keyof typeof BV_SETTLEMENT_STATUS];
