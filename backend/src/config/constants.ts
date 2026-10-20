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
  TEAM_BONUS: 'TEAM_BONUS',
  TEAM_PERFORMANCE_BONUS: 'TEAM_PERFORMANCE_BONUS',
  UPLINE_BONUS: 'UPLINE_BONUS',
  FRANCHISE_BONUS: 'FRANCHISE_BONUS',
  ROYALTY: 'ROYALTY',
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
} as const;

export type BVOwnerType = typeof BV_OWNER_TYPE[keyof typeof BV_OWNER_TYPE];

export const BV_TXN_TYPE = {
  GENERATION: 'GENERATION',
  TRANSFER: 'TRANSFER',
  REVERSAL: 'REVERSAL', // admin-only correction that moves a transfer's BV back
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
