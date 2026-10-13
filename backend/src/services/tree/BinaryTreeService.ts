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
  isBinaryActive: boolean;
  personalBv: number;
  status: string;
  joinedAt: Date;
  sponsorId?: string;
  parentId?: string;
  position?: BinaryPosition;
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
   * 3. Position is not already occupied (Never allow two LEFT or two RIGHT children under the same parent)
   * 4. Candidate is not own parent
   * 5. No circular relationship (parent is not a descendant of candidate)
   */
  static async validatePlacement(
    parentMemberId: string,
    position: BinaryPosition | string,
    candidateMemberId?: string
  ): Promise<{ isValid: boolean; error?: string; parent?: IMember }> {
    const cleanParentId = (parentMemberId || '').toUpperCase().trim();
    if (!cleanParentId) {
      return { isValid: false, error: 'Parent member ID is required for binary placement.' };
    }

    // 1. Verify parent exists
    const parent = await Member.findOne({ memberId: cleanParentId });
    if (!parent) {
      return { isValid: false, error: `Parent member ${cleanParentId} does not exist.` };
    }

    // 2. Validate position enum
    const rawPos = (position || '').toUpperCase().trim();
    if (rawPos !== BINARY_POSITION.LEFT && rawPos !== BINARY_POSITION.RIGHT) {
      return { isValid: false, error: 'Binary position must be either LEFT or RIGHT.' };
    }
    const normalizedPos: BinaryPosition = rawPos === BINARY_POSITION.RIGHT ? BINARY_POSITION.RIGHT : BINARY_POSITION.LEFT;

    // 3. Candidate cannot be own parent
    if (candidateMemberId && candidateMemberId.toUpperCase().trim() === cleanParentId) {
      return { isValid: false, error: 'A member cannot be their own binary parent.' };
    }

    // 4. Check if position is already occupied under this parent
    const existingChild = await Member.findOne({
      $or: [
        { parentId: parent.memberId, position: normalizedPos },
        { parentId: parent.memberId, binaryPosition: normalizedPos },
        { binaryParentId: parent.memberId, position: normalizedPos },
        { binaryParentId: parent.memberId, binaryPosition: normalizedPos },
      ],
    });

    if (existingChild) {
      if (!candidateMemberId || existingChild.memberId !== candidateMemberId.toUpperCase().trim()) {
        return {
          isValid: false,
          error: `Position ${normalizedPos} under parent ${cleanParentId} is already occupied by ${existingChild.name} (${existingChild.memberId}).`,
        };
      }
    }

    // 5. Prevent circular relationship
    if (candidateMemberId) {
      const isDescendant = await this.isDescendantOf(cleanParentId, candidateMemberId);
      if (isDescendant) {
        return {
          isValid: false,
          error: `Circular relationship detected: ${cleanParentId} is already downline of ${candidateMemberId}.`,
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

      const member = await Member.findOne({ memberId: currentId }).select('parentId binaryParentId placementId');
      const parentId = (member?.parentId || member?.binaryParentId || member?.placementId || '').toUpperCase().trim();
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
   * Find binary ancestors walking up the binary tree from a starting member.
   * Traverses actual binary parentId / binaryParentId (NOT sponsorId).
   * Returns list of { ancestorMemberId, legOfOrigin ('LEFT' | 'RIGHT') }
   * This is used to pass new volume up the correct legs to all ancestors.
   */
  static async getBinaryAncestors(startMemberId: string): Promise<Array<{ memberId: string; leg: BinaryPosition }>> {
    const ancestors: Array<{ memberId: string; leg: BinaryPosition }> = [];
    let currentMember = await Member.findOne({ memberId: startMemberId }).select(
      'parentId position binaryParentId binaryPosition placementId memberId'
    );

    const visited = new Set<string>();

    while (currentMember) {
      const parentId = (currentMember.parentId || currentMember.binaryParentId || currentMember.placementId || '').toUpperCase().trim();
      if (!parentId || parentId === currentMember.memberId) {
        break;
      }

      if (visited.has(currentMember.memberId)) {
        break;
      }
      visited.add(currentMember.memberId);

      const rawLeg = (currentMember.position || currentMember.binaryPosition || '').toUpperCase();
      const leg: BinaryPosition = rawLeg === 'RIGHT' ? BINARY_POSITION.RIGHT : BINARY_POSITION.LEFT;

      ancestors.push({
        memberId: parentId,
        leg,
      });

      currentMember = await Member.findOne({ memberId: parentId }).select(
        'parentId position binaryParentId binaryPosition placementId memberId'
      );
    }

    return ancestors;
  }

  /**
   * Build binary tree hierarchy up to a specified depth for visual rendering.
   * Tree visualization uses parentId + position, NOT sponsorId.
   */
  static async getBinaryTree(rootMemberId: string, maxDepth: number = 10): Promise<BinaryNodeDTO | null> {
    const root = await Member.findOne({ memberId: rootMemberId.toUpperCase().trim() });
    if (!root) return null;

    const visited = new Set<string>();
    return this.buildTreeNode(root, 1, maxDepth, visited);
  }

  private static async buildTreeNode(
    member: IMember,
    currentDepth: number,
    maxDepth: number,
    visited: Set<string> = new Set<string>()
  ): Promise<BinaryNodeDTO> {
    if (visited.has(member.memberId)) {
      return {
        memberId: member.memberId,
        name: member.name,
        email: member.email,
        mobile: member.mobile,
        rank: member.rank || 'Distributor',
        packageName: member.packageName || 'Basic',
        isActive: member.isActive,
        isBinaryActive: member.isBinaryActive || (member.personalBv || 0) >= 100,
        personalBv: member.personalBv || 0,
        status: member.status,
        joinedAt: member.joinedAt || member.createdAt,
        leftBv: 0,
        rightBv: 0,
        matchedPairs: 0,
        leftNode: null,
        rightNode: null,
      };
    }
    visited.add(member.memberId);

    // Fetch live binary volumes
    const vol = await BinaryVolume.findOne({ memberId: member.memberId });

    const rawPos = (member.position || member.binaryPosition || '').toUpperCase();
    const resolvedPos: BinaryPosition | undefined =
      rawPos === 'RIGHT' ? BINARY_POSITION.RIGHT : rawPos === 'LEFT' ? BINARY_POSITION.LEFT : undefined;

    const node: BinaryNodeDTO = {
      memberId: member.memberId,
      name: member.name,
      email: member.email,
      mobile: member.mobile,
      rank: member.rank || 'Distributor',
      packageName: member.packageName || 'Basic',
      isActive: member.isActive,
      isBinaryActive: member.isBinaryActive || (member.personalBv || 0) >= 100,
      personalBv: member.personalBv || 0,
      status: member.status,
      joinedAt: member.joinedAt || member.createdAt,
      sponsorId: member.sponsorId,
      parentId: member.parentId || member.binaryParentId || undefined,
      position: resolvedPos,
      binaryPosition: resolvedPos,
      leftBv: vol ? vol.leftTotalBV : member.leftBv || 0,
      rightBv: vol ? vol.rightTotalBV : member.rightBv || 0,
      matchedPairs: member.matchedPairs || 0,
      leftNode: null,
      rightNode: null,
    };

    // Query LEFT and RIGHT children based on binary parentId + position (NOT sponsorId)
    const [leftChild, rightChild] = await Promise.all([
      Member.findOne({
        $or: [
          { parentId: member.memberId, position: BINARY_POSITION.LEFT },
          { parentId: member.memberId, binaryPosition: BINARY_POSITION.LEFT },
          { binaryParentId: member.memberId, position: BINARY_POSITION.LEFT },
          { binaryParentId: member.memberId, binaryPosition: BINARY_POSITION.LEFT },
        ],
        status: { $ne: 'rejected' },
      }),
      Member.findOne({
        $or: [
          { parentId: member.memberId, position: BINARY_POSITION.RIGHT },
          { parentId: member.memberId, binaryPosition: BINARY_POSITION.RIGHT },
          { binaryParentId: member.memberId, position: BINARY_POSITION.RIGHT },
          { binaryParentId: member.memberId, binaryPosition: BINARY_POSITION.RIGHT },
        ],
        status: { $ne: 'rejected' },
      }),
    ]);

    if (currentDepth >= maxDepth) {
      if (leftChild || rightChild) {
        (node as any).hasMoreDownline = true;
      }
      return node;
    }

    if (leftChild) {
      node.leftNode = await this.buildTreeNode(leftChild as IMember, currentDepth + 1, maxDepth, visited);
    }
    if (rightChild) {
      node.rightNode = await this.buildTreeNode(rightChild as IMember, currentDepth + 1, maxDepth, visited);
    }

    return node;
  }

  /**
   * Find extreme nodes (Bottom Left, Bottom Right) starting from a root member
   */
  static async getTreeExtremes(rootMemberId: string): Promise<{
    rootMemberId: string;
    bottomLeft: { memberId: string; name: string; depth: number } | null;
    bottomRight: { memberId: string; name: string; depth: number } | null;
  }> {
    const root = await Member.findOne({ memberId: rootMemberId.toUpperCase().trim() });
    if (!root) {
      return { rootMemberId, bottomLeft: null, bottomRight: null };
    }

    // 1. Traverse extreme Left leg
    let currentLeft: IMember | null = root;
    let leftDepth = 1;
    const visitedLeft = new Set<string>([root.memberId]);

    while (currentLeft) {
      const nextLeft: IMember | null = await Member.findOne({
        $or: [
          { parentId: currentLeft.memberId, position: BINARY_POSITION.LEFT },
          { parentId: currentLeft.memberId, binaryPosition: BINARY_POSITION.LEFT },
          { binaryParentId: currentLeft.memberId, position: BINARY_POSITION.LEFT },
          { binaryParentId: currentLeft.memberId, binaryPosition: BINARY_POSITION.LEFT },
        ],
      });
      if (nextLeft && !visitedLeft.has(nextLeft.memberId)) {
        visitedLeft.add(nextLeft.memberId);
        currentLeft = nextLeft;
        leftDepth++;
      } else {
        break;
      }
    }

    // 2. Traverse extreme Right leg
    let currentRight: IMember | null = root;
    let rightDepth = 1;
    const visitedRight = new Set<string>([root.memberId]);

    while (currentRight) {
      const nextRight: IMember | null = await Member.findOne({
        $or: [
          { parentId: currentRight.memberId, position: BINARY_POSITION.RIGHT },
          { parentId: currentRight.memberId, binaryPosition: BINARY_POSITION.RIGHT },
          { binaryParentId: currentRight.memberId, position: BINARY_POSITION.RIGHT },
          { binaryParentId: currentRight.memberId, binaryPosition: BINARY_POSITION.RIGHT },
        ],
      });
      if (nextRight && !visitedRight.has(nextRight.memberId)) {
        visitedRight.add(nextRight.memberId);
        currentRight = nextRight;
        rightDepth++;
      } else {
        break;
      }
    }

    return {
      rootMemberId: root.memberId,
      bottomLeft: currentLeft ? { memberId: currentLeft.memberId, name: currentLeft.name, depth: leftDepth } : null,
      bottomRight: currentRight ? { memberId: currentRight.memberId, name: currentRight.name, depth: rightDepth } : null,
    };
  }

  /**
   * Balanced Level-Order (Breadth-First Search - BFS) Binary Auto-Placement:
   * Systematically fills each level from Left to Right:
   * 1. 1st member under root -> root's LEFT
   * 2. 2nd member under root -> root's RIGHT
   * 3. 3rd member under Left child -> Left child's LEFT
   * 4. 4th member under Left child -> Left child's RIGHT
   * 5. 5th member under Right child -> Right child's LEFT
   * 6. 6th member under Right child -> Right child's RIGHT
   * ...and continues down level by level, left-to-right.
   * Determines:
   * - parentId
   * - position (LEFT / RIGHT)
   */
  static async findNextAutoPlacement(
    startMemberId: string
  ): Promise<{ parentId: string; position: BinaryPosition }> {
    let cleanStartId = (startMemberId || '').toUpperCase().trim();

    // If start node is missing or ADMIN or ROOT, locate root company member
    if (!cleanStartId || cleanStartId === 'ADMIN' || cleanStartId === 'ROOT') {
      const root = await Member.findOne().sort({ createdAt: 1 }).select('memberId');
      if (root) {
        cleanStartId = (root as IMember).memberId;
      } else {
        return { parentId: '', position: BINARY_POSITION.LEFT };
      }
    } else {
      const memberExists = await Member.findOne({ memberId: cleanStartId }).select('memberId');
      if (!memberExists) {
        const root = await Member.findOne().sort({ createdAt: 1 }).select('memberId');
        cleanStartId = root ? (root as IMember).memberId : cleanStartId;
      }
    }

    const queue: string[] = [cleanStartId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentParentId = queue.shift()!;
      if (visited.has(currentParentId)) continue;
      visited.add(currentParentId);

      // Check left and right child of currentParentId using binary parentId and position
      const [leftChild, rightChild] = await Promise.all([
        Member.findOne({
          $or: [
            { parentId: currentParentId, position: BINARY_POSITION.LEFT },
            { parentId: currentParentId, binaryPosition: BINARY_POSITION.LEFT },
            { binaryParentId: currentParentId, binaryPosition: BINARY_POSITION.LEFT },
          ],
        }).select('memberId'),
        Member.findOne({
          $or: [
            { parentId: currentParentId, position: BINARY_POSITION.RIGHT },
            { parentId: currentParentId, binaryPosition: BINARY_POSITION.RIGHT },
            { binaryParentId: currentParentId, binaryPosition: BINARY_POSITION.RIGHT },
          ],
        }).select('memberId'),
      ]);

      const leftMember = leftChild as IMember | null;
      const rightMember = rightChild as IMember | null;

      // If Left slot is vacant, place here first
      if (!leftMember) {
        return { parentId: currentParentId, position: BINARY_POSITION.LEFT };
      }

      // If Right slot is vacant, place here next
      if (!rightMember) {
        return { parentId: currentParentId, position: BINARY_POSITION.RIGHT };
      }

      // Both filled: enqueue left child, then right child (level-order BFS)
      if (leftMember.memberId && !visited.has(leftMember.memberId)) {
        queue.push(leftMember.memberId);
      }
      if (rightMember.memberId && !visited.has(rightMember.memberId)) {
        queue.push(rightMember.memberId);
      }
    }

    return { parentId: cleanStartId, position: BINARY_POSITION.LEFT };
  }

  /**
   * Sponsor-Driven Directional Extreme Leg Placement:
   * Starting from sponsor member, continuously step down the selected leg
   * (LEFT -> leftChild -> leftChild... or RIGHT -> rightChild -> rightChild...)
   * until a node with an empty slot on that leg is reached.
   * Returns:
   * - parentId
   * - parentName
   * - position (the requested leg)
   * - traversalPath: array of member IDs traversed
   */
  static async findExtremeLegPlacement(
    sponsorMemberId: string,
    leg: BinaryPosition | string
  ): Promise<{
    parentId: string;
    parentName: string;
    position: BinaryPosition;
    traversalPath: string[];
  }> {
    const rawLeg = (leg || '').toUpperCase().trim();
    const normalizedLeg: BinaryPosition =
      rawLeg === BINARY_POSITION.RIGHT || rawLeg === 'RIGHT'
        ? BINARY_POSITION.RIGHT
        : BINARY_POSITION.LEFT;

    let cleanSponsorId = (sponsorMemberId || '').toUpperCase().trim();

    const totalMemberCount = await Member.countDocuments();
    if (totalMemberCount === 0 || !cleanSponsorId) {
      // Tree is empty; the member being placed is the Root node
      return {
        parentId: '',
        parentName: 'Root',
        position: normalizedLeg,
        traversalPath: [],
      };
    }

    const sponsor: IMember | null = await Member.findOne({ memberId: cleanSponsorId });
    if (!sponsor) {
      throw new Error(`Sponsor ID "${cleanSponsorId}" does not exist in our system.`);
    }

    let currentNode = sponsor;
    const traversalPath: string[] = [currentNode.memberId];
    const visited = new Set<string>([currentNode.memberId]);

    // Traverse down along the chosen leg until an empty slot is encountered
    while (currentNode) {
      const child: IMember | null = await Member.findOne({
        $or: [
          { parentId: currentNode.memberId, position: normalizedLeg },
          { parentId: currentNode.memberId, binaryPosition: normalizedLeg },
          { binaryParentId: currentNode.memberId, position: normalizedLeg },
          { binaryParentId: currentNode.memberId, binaryPosition: normalizedLeg },
        ],
        status: { $ne: 'rejected' },
      }).select('memberId name parentId position binaryParentId binaryPosition');

      if (!child) {
        // Found the node with an empty slot on this leg!
        return {
          parentId: currentNode.memberId,
          parentName: currentNode.name,
          position: normalizedLeg,
          traversalPath,
        };
      }

      // Loop guard
      if (visited.has(child.memberId)) {
        break;
      }
      visited.add(child.memberId);
      traversalPath.push(child.memberId);

      // Step down along the same leg
      currentNode = child;
    }

    return {
      parentId: currentNode.memberId,
      parentName: currentNode.name,
      position: normalizedLeg,
      traversalPath,
    };
  }

  /**
   * Find available placement slot under given member using directional extreme leg placement
   */
  static async findAvailablePlacement(
    startMemberId: string,
    preferredLeg?: BinaryPosition
  ): Promise<{ parentId: string; position: BinaryPosition }> {
    const leg = preferredLeg || BINARY_POSITION.LEFT;
    const res = await this.findExtremeLegPlacement(startMemberId, leg);
    return { parentId: res.parentId, position: res.position };
  }

  /**
   * Place an active member into the binary tree once they qualify (accumulate >= 100 BV).
   * Decoupled from registration: members are only placed when their binary participation starts.
   * Traverses down their sponsor's preferred leg (or default LEFT) to the extreme outer leaf node.
   * If sponsor has not been placed in the tree, traverses up sponsor chain to find the nearest placed upline/root.
   */
  static async placeMemberInBinaryTree(
    memberId: string,
    legOverride?: BinaryPosition
  ): Promise<{ parentId: string; position: BinaryPosition } | null> {
    const cleanId = (memberId || '').toUpperCase().trim();
    if (!cleanId) return null;

    const member = await Member.findOne({ memberId: cleanId });
    if (!member) return null;

    // If already placed, return existing parent and position
    if (member.parentId) {
      return {
        parentId: member.parentId,
        position: member.position,
      };
    }

    // Root member has no parent
    const totalCount = await Member.countDocuments();
    if (totalCount <= 1 || !member.sponsorId) {
      member.parentId = '';
      member.position = BINARY_POSITION.LEFT;
      member.binaryParentId = '';
      member.binaryPosition = BINARY_POSITION.LEFT;
      member.placementId = '';
      member.isBinaryActive = true;
      if (!member.binaryActivatedAt) {
        member.binaryActivatedAt = new Date();
      }
      await member.save();
      return { parentId: '', position: BINARY_POSITION.LEFT };
    }

    // Determine target leg
    const rawLeg = (legOverride || member.preferredLeg || member.position || BINARY_POSITION.LEFT).toUpperCase();
    const targetLeg: BinaryPosition = rawLeg === 'RIGHT' ? BINARY_POSITION.RIGHT : BINARY_POSITION.LEFT;

    // Find the closest sponsor who is already placed in the binary tree
    const rootMember = await Member.findOne().sort({ createdAt: 1 });
    const rootMemberId = rootMember ? rootMember.memberId : 'MEM0001';

    let placementSponsor = await Member.findOne({ memberId: member.sponsorId });
    const visited = new Set<string>();

    while (placementSponsor && !placementSponsor.parentId && placementSponsor.memberId !== rootMemberId) {
      if (!placementSponsor.sponsorId || visited.has(placementSponsor.memberId)) break;
      visited.add(placementSponsor.memberId);
      const nextSponsor = await Member.findOne({ memberId: placementSponsor.sponsorId });
      if (!nextSponsor) break;
      placementSponsor = nextSponsor;
    }

    const sponsorToUse = (placementSponsor && (placementSponsor.parentId || placementSponsor.memberId === rootMemberId))
      ? placementSponsor.memberId
      : rootMemberId;

    const placement = await this.findExtremeLegPlacement(sponsorToUse, targetLeg);

    member.parentId = placement.parentId;
    member.position = placement.position;
    member.binaryParentId = placement.parentId;
    member.binaryPosition = placement.position;
    member.placementId = placement.parentId;
    member.isBinaryActive = true;
    if (!member.binaryActivatedAt) {
      member.binaryActivatedAt = new Date();
    }
    await member.save();

    return {
      parentId: placement.parentId,
      position: placement.position,
    };
  }

  /**
   * Reorganize all existing members in database into balanced level-order binary tree
   */
  static async rebalanceEntireTree(): Promise<{ count: number; tree: any }> {
    const members = await Member.find().sort({ createdAt: 1 });
    if (members.length === 0) return { count: 0, tree: null };

    const rootMember = members[0];
    rootMember.parentId = '';
    rootMember.binaryParentId = '';
    rootMember.placementId = '';
    rootMember.position = undefined as any;
    rootMember.binaryPosition = undefined as any;
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

          currentMember.parentId = parentId;
          currentMember.binaryParentId = parentId;
          currentMember.placementId = parentId;
          currentMember.position = BINARY_POSITION.LEFT;
          currentMember.binaryPosition = BINARY_POSITION.LEFT;
          await currentMember.save();
          placed = true;
        } else if (!slot.right) {
          slot.right = currentMember.memberId;
          treeSlots.set(currentMember.memberId, {});
          queue.push(currentMember.memberId);
          queue.shift(); // Parent has both children

          currentMember.parentId = parentId;
          currentMember.binaryParentId = parentId;
          currentMember.placementId = parentId;
          currentMember.position = BINARY_POSITION.RIGHT;
          currentMember.binaryPosition = BINARY_POSITION.RIGHT;
          await currentMember.save();
          placed = true;
        }
      }
    }

    const updatedTree = await this.getBinaryTree(rootMember.memberId, 4);
    return { count: members.length, tree: updatedTree };
  }

  /**
   * Traverse a binary subtree starting from rootChildMemberId in level-order (BFS, top-to-bottom).
   * Returns list of member IDs in the exact placement hierarchy order.
   */
  static async getSubtreeMembersLevelOrder(rootChildMemberId: string): Promise<string[]> {
    const cleanId = (rootChildMemberId || '').toUpperCase().trim();
    if (!cleanId) return [];

    const result: string[] = [];
    const queue: string[] = [cleanId];
    const visited = new Set<string>([cleanId]);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const member = await Member.findOne({ memberId: currentId }).select('memberId isActive isBinaryActive personalBv status');
      // Only members with minimum 100 Business Volume participate in the binary income matching tree
      const isBinaryParticipating = member && member.isActive && member.status !== 'blocked' && (member.isBinaryActive || (member.personalBv || 0) >= 100);
      if (isBinaryParticipating) {
        result.push(member.memberId);
      }

      // Query binary left and right children of currentId (in LEFT then RIGHT order)
      const [left, right] = await Promise.all([
        Member.findOne({
          $or: [
            { parentId: currentId, position: BINARY_POSITION.LEFT },
            { parentId: currentId, binaryPosition: BINARY_POSITION.LEFT },
            { binaryParentId: currentId, position: BINARY_POSITION.LEFT },
            { binaryParentId: currentId, binaryPosition: BINARY_POSITION.LEFT },
          ],
        }).select('memberId'),
        Member.findOne({
          $or: [
            { parentId: currentId, position: BINARY_POSITION.RIGHT },
            { parentId: currentId, binaryPosition: BINARY_POSITION.RIGHT },
            { binaryParentId: currentId, position: BINARY_POSITION.RIGHT },
            { binaryParentId: currentId, binaryPosition: BINARY_POSITION.RIGHT },
          ],
        }).select('memberId'),
      ]);

      if (left && !visited.has(left.memberId)) {
        visited.add(left.memberId);
        queue.push(left.memberId);
      }
      if (right && !visited.has(right.memberId)) {
        visited.add(right.memberId);
        queue.push(right.memberId);
      }
    }

    return result;
  }

  /**
   * Get both Left leg and Right leg active members in level-order under a given member.
   */
  static async getMemberLegsLevelOrder(memberId: string): Promise<{ leftMemberIds: string[]; rightMemberIds: string[] }> {
    const cleanId = (memberId || '').toUpperCase().trim();
    const [leftChild, rightChild] = await Promise.all([
      Member.findOne({
        $or: [
          { parentId: cleanId, position: BINARY_POSITION.LEFT },
          { parentId: cleanId, binaryPosition: BINARY_POSITION.LEFT },
          { binaryParentId: cleanId, position: BINARY_POSITION.LEFT },
          { binaryParentId: cleanId, binaryPosition: BINARY_POSITION.LEFT },
        ],
      }).select('memberId'),
      Member.findOne({
        $or: [
          { parentId: cleanId, position: BINARY_POSITION.RIGHT },
          { parentId: cleanId, binaryPosition: BINARY_POSITION.RIGHT },
          { binaryParentId: cleanId, position: BINARY_POSITION.RIGHT },
          { binaryParentId: cleanId, binaryPosition: BINARY_POSITION.RIGHT },
        ],
      }).select('memberId'),
    ]);

    const [leftMemberIds, rightMemberIds] = await Promise.all([
      leftChild ? this.getSubtreeMembersLevelOrder(leftChild.memberId) : Promise.resolve([]),
      rightChild ? this.getSubtreeMembersLevelOrder(rightChild.memberId) : Promise.resolve([]),
    ]);

    return { leftMemberIds, rightMemberIds };
  }

  /**
   * Check whether the required sponsor/member condition is satisfied on both the LEFT and RIGHT
   * sides of a member's binary tree.
   *
   * Requirement:
   * 1. The member must have at least ONE personally sponsored member anywhere in their
   *    LEFT binary subtree (at any depth/level) who is BINARY ACTIVE (isBinaryActive: true or personalBv >= 100).
   * 2. The member must have at least ONE personally sponsored member anywhere in their
   *    RIGHT binary subtree (at any depth/level) who is BINARY ACTIVE (isBinaryActive: true or personalBv >= 100).
   * 3. Note: The immediate level-1 binary children (leftChild & rightChild) do NOT need to be sponsored
   *    by the member; they can be spillovers or sponsored by uplines.
   */
  static async checkSponsorLegEligibility(memberId: string): Promise<{
    isQualified: boolean;
    hasLeftSponsor: boolean;
    hasRightSponsor: boolean;
    leftSponsorMemberIds: string[];
    rightSponsorMemberIds: string[];
    leftSponsorMembers: Array<{ memberId: string; name: string; personalBv: number }>;
    rightSponsorMembers: Array<{ memberId: string; name: string; personalBv: number }>;
  }> {
    const cleanId = (memberId || '').toUpperCase().trim();
    if (!cleanId) {
      return {
        isQualified: false,
        hasLeftSponsor: false,
        hasRightSponsor: false,
        leftSponsorMemberIds: [],
        rightSponsorMemberIds: [],
        leftSponsorMembers: [],
        rightSponsorMembers: [],
      };
    }

    // 1. Fetch all direct referrals of this member who are active and BINARY ACTIVE (>= 100 Personal BV)
    const directSponsoredMembers = await Member.find({
      sponsorId: cleanId,
      isActive: true,
      status: { $nin: ['blocked', 'rejected'] },
    }).select('memberId name personalBv isBinaryActive');

    const binaryActiveDirects = directSponsoredMembers.filter(
      (m) => Boolean(m.isBinaryActive || (m.personalBv || 0) >= 100)
    );

    if (binaryActiveDirects.length === 0) {
      return {
        isQualified: false,
        hasLeftSponsor: false,
        hasRightSponsor: false,
        leftSponsorMemberIds: [],
        rightSponsorMemberIds: [],
        leftSponsorMembers: [],
        rightSponsorMembers: [],
      };
    }

    // Direct lookup map for quick matching
    const activeDirectMap = new Map<string, { memberId: string; name: string; personalBv: number }>();
    for (const d of binaryActiveDirects) {
      activeDirectMap.set(d.memberId.toUpperCase().trim(), {
        memberId: d.memberId,
        name: d.name || d.memberId,
        personalBv: d.personalBv || 0,
      });
    }

    // 2. Identify the root's immediate LEFT and RIGHT binary children
    const [leftChild, rightChild] = await Promise.all([
      Member.findOne({
        $or: [
          { parentId: cleanId, position: BINARY_POSITION.LEFT },
          { parentId: cleanId, binaryPosition: BINARY_POSITION.LEFT },
          { binaryParentId: cleanId, position: BINARY_POSITION.LEFT },
          { binaryParentId: cleanId, binaryPosition: BINARY_POSITION.LEFT },
        ],
      }).select('memberId'),
      Member.findOne({
        $or: [
          { parentId: cleanId, position: BINARY_POSITION.RIGHT },
          { parentId: cleanId, binaryPosition: BINARY_POSITION.RIGHT },
          { binaryParentId: cleanId, position: BINARY_POSITION.RIGHT },
          { binaryParentId: cleanId, binaryPosition: BINARY_POSITION.RIGHT },
        ],
      }).select('memberId'),
    ]);

    // 3. Helper to find all binary-active directs present in a binary subtree via BFS
    const findSponsoredInSubtree = async (
      rootChildId?: string
    ): Promise<Array<{ memberId: string; name: string; personalBv: number }>> => {
      if (!rootChildId) return [];
      const found: Array<{ memberId: string; name: string; personalBv: number }> = [];
      let currentLevel = [rootChildId.toUpperCase().trim()];
      const visited = new Set<string>(currentLevel);

      while (currentLevel.length > 0) {
        for (const id of currentLevel) {
          if (activeDirectMap.has(id)) {
            found.push(activeDirectMap.get(id)!);
          }
        }

        // Query binary children of currentLevel members
        const nextLevelChildren = await Member.find({
          $or: [
            { parentId: { $in: currentLevel } },
            { binaryParentId: { $in: currentLevel } },
          ],
        }).select('memberId');

        const nextLevel: string[] = [];
        for (const child of nextLevelChildren) {
          const childId = child.memberId.toUpperCase().trim();
          if (!visited.has(childId)) {
            visited.add(childId);
            nextLevel.push(childId);
          }
        }

        currentLevel = nextLevel;
      }

      return found;
    };

    const [leftSponsorMembers, rightSponsorMembers] = await Promise.all([
      leftChild ? findSponsoredInSubtree(leftChild.memberId) : Promise.resolve([]),
      rightChild ? findSponsoredInSubtree(rightChild.memberId) : Promise.resolve([]),
    ]);

    const leftSponsorMemberIds = leftSponsorMembers.map((m) => m.memberId);
    const rightSponsorMemberIds = rightSponsorMembers.map((m) => m.memberId);

    const hasLeftSponsor = leftSponsorMembers.length > 0;
    const hasRightSponsor = rightSponsorMembers.length > 0;
    const isQualified = hasLeftSponsor && hasRightSponsor;

    return {
      isQualified,
      hasLeftSponsor,
      hasRightSponsor,
      leftSponsorMemberIds,
      rightSponsorMemberIds,
      leftSponsorMembers,
      rightSponsorMembers,
    };
  }
}
