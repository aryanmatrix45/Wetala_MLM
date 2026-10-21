import { BV_WALLET } from '../config/constants';

/** The member fields the rule reads. Any Member document or lean object with these fields works. */
export interface BinaryEligibilityFields {
  isActive?: boolean;
  status?: string;
  isBinaryActive?: boolean;
  personalBv?: number;
  parentId?: string;
  sponsorId?: string;
}

/**
 * Binary active: the 100 BV activation has been reached. Uses the flag, or personal BV for records
 * written before the flag was kept in step.
 */
export const isBinaryActive = (member: BinaryEligibilityFields): boolean =>
  Boolean(member.isBinaryActive) || (member.personalBv || 0) >= BV_WALLET.ACTIVATION_BV;

/**
 * In the binary tree: placed under a binary parent, or the root (the only member with no sponsor).
 * Members stay out of the tree until they become binary active.
 */
export const isInBinaryTree = (member: BinaryEligibilityFields): boolean => Boolean(member.parentId) || !member.sponsorId;

/**
 * Other income (team performance, rank rewards, team, upline, self purchase, sponsor, franchise,
 * welcome bonus) is paid only to members who are active, not blocked, binary active and in the tree.
 * Binary income has the same requirement enforced in its own services.
 */
export const canEarnBonus = <T extends BinaryEligibilityFields>(member: T | null | undefined): member is T =>
  Boolean(member) &&
  member!.isActive === true &&
  member!.status !== 'blocked' &&
  isBinaryActive(member!) &&
  isInBinaryTree(member!);
