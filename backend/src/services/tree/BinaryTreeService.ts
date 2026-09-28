import { Member, IMember } from '../../models/Member.model';
import { BinaryVolume } from '../../models/BinaryVolume.model';
import { BINARY_POSITION, BinaryPosition } from '../../config/constants';

export interface BinaryNodeDTO {
  memberId: string;
  name: string;
  email: string;
  mobile: string;
  rank: string;
  packageName: string;
  isActive: boolean;
  status: string;
  joinedAt: Date;
  binaryPosition?: BinaryPosition;
  leftBv: number;
  rightBv: number;
  matchedPairs: number;
  leftNode?: BinaryNodeDTO | null;
  rightNode?: BinaryNodeDTO | null;
}

export class BinaryTreeService {
  /**
   * Validate that a proposed binary placement is valid and does not violate any tree constraints:
   * 1. Parent exists
   * 2. Position is valid (LEFT or RIGHT)
   * 3. Position is not already occupied
   * 4. Candidate is not own parent
   * 5. No circular relationship (parent is not a descendant of candidate)
   */
  static async validatePlacement(
    parentMemberId: string,
    position: BinaryPosition,
    candidateMemberId?: string
  ): Promise<{ isValid: boolean; error?: string; parent?: IMember }> {
    // 1. Verify parent exists
    const parent = await Member.findOne({ memberId: parentMemberId.toUpperCase().trim() });
    if (!parent) {
      return { isValid: false, error: `Parent member ${parentMemberId} does not exist.` };
    }

    // 2. Validate position enum
    if (position !== BINARY_POSITION.LEFT && position !== BINARY_POSITION.RIGHT) {
      return { isValid: false, error: 'Binary position must be either LEFT or RIGHT.' };
    }

    // 3. Candidate cannot be own parent
    if (candidateMemberId && candidateMemberId.toUpperCase().trim() === parentMemberId.toUpperCase().trim()) {
      return { isValid: false, error: 'A member cannot be their own binary parent.' };
    }

    // 4. Check if position is already occupied
    const existingChild = await Member.findOne({
      binaryParentId: parent.memberId,
      binaryPosition: position,
    });

    if (existingChild) {
      if (!candidateMemberId || existingChild.memberId !== candidateMemberId.toUpperCase().trim()) {
        return {
          isValid: false,
          error: `Position ${position} under ${parentMemberId} is already occupied by ${existingChild.name} (${existingChild.memberId}).`,
        };
      }
    }

    // 5. Prevent circular relationship
    if (candidateMemberId) {
      const isDescendant = await this.isDescendantOf(parentMemberId, candidateMemberId);
      if (isDescendant) {
        return {
          isValid: false,
          error: `Circular relationship detected: ${parentMemberId} is already downline of ${candidateMemberId}.`,
        };
      }
    }

    return { isValid: true, parent };
  }

  /**
   * Check if checkMemberId is a binary descendant of ancestorMemberId
   */
  static async isDescendantOf(checkMemberId: string, ancestorMemberId: string): Promise<boolean> {
    let currentId = checkMemberId;
    const visited = new Set<string>();

    while (currentId) {
      if (visited.has(currentId)) {
        return false; // loop guard
      }
      visited.add(currentId);

      const member = await Member.findOne({ memberId: currentId }).select('binaryParentId placementId');
      const parentId = member?.binaryParentId || member?.placementId;
      if (!parentId || parentId === currentId) {
        return false;
      }

      if (parentId === ancestorMemberId) {
        return true;
      }

      currentId = parentId;
    }

    return false;
  }

  /**
   * Find binary ancestors walking up the tree from a starting member.
   * Returns list of { ancestorMemberId, legOfOrigin ('LEFT' | 'RIGHT') }
   * This is used to pass new volume up the correct legs to all ancestors.
   */
  static async getBinaryAncestors(startMemberId: string): Promise<Array<{ memberId: string; leg: BinaryPosition }>> {
    const ancestors: Array<{ memberId: string; leg: BinaryPosition }> = [];
    let currentMember = await Member.findOne({ memberId: startMemberId }).select('binaryParentId binaryPosition placementId position memberId');

    const visited = new Set<string>();

    while (currentMember) {
      const parentId = currentMember.binaryParentId || currentMember.placementId;
      if (!parentId || parentId === currentMember.memberId) {
        break;
      }

      if (visited.has(currentMember.memberId)) {
        break;
      }
      visited.add(currentMember.memberId);

      const leg = currentMember.binaryPosition || (currentMember.position?.toUpperCase() === 'RIGHT' ? BINARY_POSITION.RIGHT : BINARY_POSITION.LEFT);

      ancestors.push({
        memberId: parentId,
        leg,
      });

      currentMember = await Member.findOne({ memberId: parentId }).select('binaryParentId binaryPosition placementId position memberId');
    }

    return ancestors;
  }

  /**
   * Build binary tree hierarchy up to a specified depth for visual rendering.
   */
  static async getBinaryTree(rootMemberId: string, maxDepth: number = 4): Promise<BinaryNodeDTO | null> {
    const root = await Member.findOne({ memberId: rootMemberId });
    if (!root) return null;

    return this.buildTreeNode(root, 1, maxDepth);
  }

  private static async buildTreeNode(member: IMember, currentDepth: number, maxDepth: number): Promise<BinaryNodeDTO> {
    // Fetch live binary volumes
    const vol = await BinaryVolume.findOne({ memberId: member.memberId });

    const node: BinaryNodeDTO = {
      memberId: member.memberId,
      name: member.name,
      email: member.email,
      mobile: member.mobile,
      rank: member.rank || 'Distributor',
      packageName: member.packageName || 'Basic',
      isActive: member.isActive,
      status: member.status,
      joinedAt: member.joinedAt || member.createdAt,
      binaryPosition: member.binaryPosition,
      leftBv: vol ? vol.leftTotalBV : member.leftBv || 0,
      rightBv: vol ? vol.rightTotalBV : member.rightBv || 0,
      matchedPairs: member.matchedPairs || 0,
      leftNode: null,
      rightNode: null,
    };

    if (currentDepth >= maxDepth) {
      return node;
    }

    // Query LEFT and RIGHT children
    const [leftChild, rightChild] = await Promise.all([
      Member.findOne({
        binaryParentId: member.memberId,
        $or: [{ binaryPosition: BINARY_POSITION.LEFT }, { position: 'left' }],
      }),
      Member.findOne({
        binaryParentId: member.memberId,
        $or: [{ binaryPosition: BINARY_POSITION.RIGHT }, { position: 'right' }],
      }),
    ]);

    if (leftChild) {
      node.leftNode = await this.buildTreeNode(leftChild, currentDepth + 1, maxDepth);
    }
    if (rightChild) {
      node.rightNode = await this.buildTreeNode(rightChild, currentDepth + 1, maxDepth);
    }

    return node;
  }

  /**
   * Find next available spillover placement under a given node for extreme LEFT or extreme RIGHT
   */
  static async findAvailablePlacement(
    startMemberId: string,
    preferredLeg: BinaryPosition = BINARY_POSITION.LEFT
  ): Promise<{ parentId: string; position: BinaryPosition }> {
    let currentId = startMemberId;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);

      const child = await Member.findOne({
        binaryParentId: currentId,
        binaryPosition: preferredLeg,
      });

      if (!child || child.memberId === currentId) {
        return { parentId: currentId, position: preferredLeg };
      }

      currentId = child.memberId;
    }

    return { parentId: startMemberId, position: preferredLeg };
  }
}
