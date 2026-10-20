import { Purchase, IPurchase } from '../models/Purchase.model';
import { IMember } from '../models/Member.model';
import { BVWalletService, BVActor } from './BVWalletService';

export const PURCHASE_PAYMENT_METHOD = {
  BANK: 'BANK_TRANSFER',
  BV_WALLET: 'BV_WALLET',
} as const;

export type PurchasePaymentMethod = typeof PURCHASE_PAYMENT_METHOD[keyof typeof PURCHASE_PAYMENT_METHOD];

export const parsePaymentMethod = (value: unknown): PurchasePaymentMethod =>
  value === PURCHASE_PAYMENT_METHOD.BV_WALLET ? PURCHASE_PAYMENT_METHOD.BV_WALLET : PURCHASE_PAYMENT_METHOD.BANK;

/**
 * Creates a purchase request with the chosen payment method.
 *  - Bank transfer: the order starts at REQUESTED and follows the payment-instructions / UTR flow.
 *  - BV Wallet: the BV is debited now and the order waits at PAYMENT_SUBMITTED for Super Admin approval.
 */
export async function submitPurchaseRequest(input: {
  payload: Record<string, unknown> & { purchaseId: string; totalBV: number };
  member: Pick<IMember, 'memberId' | 'name'>;
  paymentMethod: PurchasePaymentMethod;
  requestKey?: unknown;
  actor: BVActor;
}): Promise<{ purchase: IPurchase; duplicate: boolean }> {
  if (input.paymentMethod === PURCHASE_PAYMENT_METHOD.BV_WALLET) {
    return BVWalletService.createPurchaseWithBV({
      purchase: input.payload,
      memberId: input.member.memberId,
      memberName: input.member.name,
      requestKey: input.requestKey,
      actor: input.actor,
    });
  }
  const purchase = await Purchase.create({ ...input.payload, paymentMethod: PURCHASE_PAYMENT_METHOD.BANK });
  return { purchase, duplicate: false };
}
