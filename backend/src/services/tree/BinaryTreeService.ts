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
    const targetAncestor = (ancestorMemberId || '').toUpperCase().trim();
    let currentId = (checkMemberId || '').toUpperCase().trim();
    if (!currentId || !targetAncestor) return false;
    if (currentId === targetAncestor) return true;

    const visited = new Set<string>();

    while (currentId) {
      if (visited.has(currentId)) {
        return false; // loop guard
      }
      visited.add(currentId);

      const member = await Member.findOne({ memberId: currentId }).select('binaryParentId placementId');
      const parentId = (member?.binaryParentId || member?.placementId || '').toUpperCase().trim();
      if (!parentId || parentId === currentId) {
        return false;
      }

      if (parentId === targetAncestor) {
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
   * Balanced Level-Order (Breadth-First Search - BFS) Binary Auto-Placement:
   * Systematically fills each level from Left to Right:
   * 1. 1st member under Sponsor -> Sponsor's LEFT
   * 2. 2nd member under Sponsor -> Sponsor's RIGHT
   * 3. 3rd member under Left child -> Left child's LEFT
   * 4. 4th member under Left child -> Left child's RIGHT
   * 5. 5th member under Right child -> Right child's LEFT
   * 6. 6th member under Right child -> Right child's RIGHT
   * ...and continues down level by level, left-to-right.
   */
  static async findNextAutoPlacement(
    startMemberId: string
  ): Promise<{ parentId: string; position: BinaryPosition }> {
    let cleanStartId = (startMemberId || '').toUpperCase().trim();

    // If start node is missing or ADMIN or ROOT, locate root company member
    if (!cleanStartId || cleanStartId === 'ADMIN' || cleanStartId === 'ROOT') {
      const root = await Member.findOne().sort({ createdAt: 1 }).select('memberId');
      if (root) {
        cleanStartId = root.memberId;
      } else {
        return { parentId: '', position: BINARY_POSITION.LEFT };
      }
    } else {
      const memberExists = await Member.findOne({ memberId: cleanStartId }).select('memberId');
      if (!memberExists) {
        const root = await Member.findOne().sort({ createdAt: 1 }).select('memberId');
        cleanStartId = root ? root.memberId : cleanStartId;
      }
    }

    const queue: string[] = [cleanStartId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentParentId = queue.shift()!;
      if (visited.has(currentParentId)) continue;
      visited.add(currentParentId);

      // Check left and right child of currentParentId
      const [leftChild, rightChild] = await Promise.all([
        Member.findOne({
          binaryParentId: currentParentId,
          $or: [{ binaryPosition: BINARY_POSITION.LEFT }, { position: 'left' }],
        }).select('memberId'),
        Member.findOne({
          binaryParentId: currentParentId,
          $or: [{ binaryPosition: BINARY_POSITION.RIGHT }, { position: 'right' }],
        }).select('memberId'),
      ]);

      // If Left wing is vacant, place here first
      if (!leftChild) {
        return { parentId: currentParentId, position: BINARY_POSITION.LEFT };
      }

      // If Right wing is vacant, place here next
      if (!rightChild) {
        return { parentId: currentParentId, position: BINARY_POSITION.RIGHT };
      }

      // Both filled: enqueue left child, then right child (level-order BFS)
      if (leftChild.memberId && !visited.has(leftChild.memberId)) {
        queue.push(leftChild.memberId);
      }
      if (rightChild.memberId && !visited.has(rightChild.memberId)) {
        queue.push(rightChild.memberId);
      }
    }

    return { parentId: cleanStartId, position: BINARY_POSITION.LEFT };
  }

  /**
   * Find available placement slot under given member (defaults to balanced auto-placement)
   */
  static async findAvailablePlacement(
    startMemberId: string,
    preferredLeg?: BinaryPosition
  ): Promise<{ parentId: string; position: BinaryPosition }> {
    return this.findNextAutoPlacement(startMemberId);
  }

  /**
   * Reorganize all existing members in database into balanced level-order binary tree
   */
  static async rebalanceEntireTree(): Promise<{ count: number; tree: any }> {
    const members = await Member.find().sort({ createdAt: 1 });
    if (members.length === 0) return { count: 0, tree: null };

    const rootMember = members[0];
    rootMember.binaryParentId = '';
    rootMember.placementId = '';
    rootMember.binaryPosition = undefined as any;
    rootMember.position = undefined as any;
    await rootMember.save();

    const treeSlots = new Map<string, { left?: string; right?: string }>();
    treeSlots.set(rootMember.memberId, {});

    const queue: string[] = [rootMember.memberId];

    for (let i = 1; i < members.length; i++) {
      const currentMember = members[i];
      let placed = false;

      while (queue.length > 0 && !placed) {
        const parentId = queue[0];
        const slot = treeSlots.get(parentId)!;

        if (!slot.left) {
          slot.left = currentMember.memberId;
          treeSlots.set(currentMember.memberId, {});
          queue.push(currentMember.memberId);

          currentMember.binaryParentId = parentId;
          currentMember.placementId = parentId;
          currentMember.binaryPosition = BINARY_POSITION.LEFT;
          currentMember.position = 'left';
          await currentMember.save();
          placed = true;
        } else if (!slot.right) {
          slot.right = currentMember.memberId;
          treeSlots.set(currentMember.memberId, {});
          queue.push(currentMember.memberId);
          queue.shift(); // Parent has both children

          currentMember.binaryParentId = parentId;
          currentMember.placementId = parentId;
          currentMember.binaryPosition = BINARY_POSITION.RIGHT;
          currentMember.position = 'right';
          await currentMember.save();
          placed = true;
        }
      }
    }

    const updatedTree = await this.getBinaryTree(rootMember.memberId, 4);
    return { count: members.length, tree: updatedTree };
  }
}
