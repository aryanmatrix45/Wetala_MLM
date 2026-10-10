import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES, BINARY_POSITION, BinaryPosition } from '../config/constants';

export type MemberStatus = 'active' | 'inactive' | 'blocked' | 'pending' | 'rejected';
export type MemberApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface IMember extends Document {
  memberId: string;
  name: string;
  email: string;
  mobile: string;
  phone?: string;
  dob?: string;
  password?: string;
  role: string;
  
  // Sponsor Relationship (Unilevel / Referral Tree)
  sponsorId: string;
  
  // Binary Tree Placement Relationship (Distinct from Sponsor)
  parentId: string;
  position: BinaryPosition;
  
  // Aliases for legacy compatibility
  binaryParentId: string;
  binaryPosition: BinaryPosition;
  placementId?: string;
  
  rank: string;
  status: MemberStatus;
  approvalStatus: MemberApprovalStatus;
  addedBy?: string;
  approvedAt?: Date;
  approvedBy?: string;
  rejectionReason?: string;
  isActive: boolean;
  joiningPackageId?: string | null;
  packageName?: string | null;
  packageBv?: number;
  packageRp?: number;
  dailyCapping?: number;
  
  joinedAt: Date;
  joinDate: string;
  
  // High-level volume cache (detailed audit stored in BinaryVolume & BVLedger)
  leftBv: number;
  rightBv: number;
  personalBv: number;
  isBinaryActive: boolean;
  binaryActivatedAt?: Date;
  matchedPairs: number;
  totalIncome: number;
  walletBalance: number;

  // Welcome Bonus 2x Capping Tracking
  qualifyingBv: number;
  welcomeBonusCap: number;
  welcomeBonusEarned: number;
  
  createdAt: Date;
  updatedAt: Date;
  
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface IMemberModel extends Model<IMember> {
  generateNextMemberId(): Promise<string>;
}

const memberSchema = new Schema<IMember, IMemberModel>(
  {
    memberId: {
      type: String,
      required: [true, 'Member ID is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
    },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      unique: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    dob: {
      type: String,
      trim: true,
      default: '',
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    role: {
      type: String,
      default: ROLES.MEMBER,
    },
    
    // Distinct Sponsor Relationship (Allows 'ADMIN' or any valid Member ID)
    sponsorId: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    
    // Distinct Binary Placement Relationship (Empty string for root member)
    parentId: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
      default: '',
    },
    position: {
      type: String,
      enum: [BINARY_POSITION.LEFT, BINARY_POSITION.RIGHT, 'left', 'right'],
      default: BINARY_POSITION.LEFT,
      index: true,
    },
    
    // Legacy support aliases
    binaryParentId: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
      default: '',
    },
    binaryPosition: {
      type: String,
      enum: [BINARY_POSITION.LEFT, BINARY_POSITION.RIGHT, 'left', 'right'],
      default: BINARY_POSITION.LEFT,
      index: true,
    },
    placementId: {
      type: String,
      trim: true,
      uppercase: true,
    },
    
    rank: {
      type: String,
      default: 'Distributor',
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'blocked', 'pending', 'rejected'],
      default: 'active',
      index: true,
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved',
      index: true,
    },
    addedBy: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
      default: 'ADMIN',
    },
    approvedAt: {
      type: Date,
    },
    approvedBy: {
      type: String,
      trim: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    joiningPackageId: {
      type: String,
      ref: 'Package',
      default: null,
    },
    packageName: {
      type: String,
      default: null,
    },
    packageBv: {
      type: Number,
      default: 0,
    },
    packageRp: {
      type: Number,
      default: 0,
    },
    dailyCapping: {
      type: Number,
      default: 0,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    joinDate: {
      type: String,
      default: () => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    },
    leftBv: {
      type: Number,
      default: 0,
    },
    rightBv: {
      type: Number,
      default: 0,
    },
    personalBv: {
      type: Number,
      default: 0,
      min: 0,
    },
    isBinaryActive: {
      type: Boolean,
      default: false,
      index: true,
    },
    binaryActivatedAt: {
      type: Date,
    },
    matchedPairs: {
      type: Number,
      default: 0,
    },
    totalIncome: {
      type: Number,
      default: 0,
    },
    walletBalance: {
      type: Number,
      default: 0,
    },
    qualifyingBv: {
      type: Number,
      default: 1250,
    },
    welcomeBonusCap: {
      type: Number,
      default: 2500,
    },
    welcomeBonusEarned: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to guarantee uniqueness of binary leg under a parent:
// Never allow two LEFT children or two RIGHT children under the same parent
memberSchema.index(
  { parentId: 1, position: 1 },
  {
    unique: true,
    partialFilterExpression: {
      parentId: { $type: 'string', $gt: '' },
      position: { $in: [BINARY_POSITION.LEFT, BINARY_POSITION.RIGHT] },
    },
  }
);

memberSchema.index(
  { binaryParentId: 1, binaryPosition: 1 },
  {
    unique: true,
    partialFilterExpression: {
      binaryParentId: { $type: 'string', $gt: '' },
      binaryPosition: { $in: [BINARY_POSITION.LEFT, BINARY_POSITION.RIGHT] },
    },
  }
);

// Synchronize parentId, binaryParentId, placementId and position, binaryPosition
memberSchema.pre('save', async function () {
  if (this.mobile && !this.phone) {
    this.phone = this.mobile;
  }

  // Resolve parentId across all parent fields
  const resolvedParent = (this.parentId || this.binaryParentId || this.placementId || '').trim().toUpperCase();
  this.parentId = resolvedParent;
  this.binaryParentId = resolvedParent;
  this.placementId = resolvedParent;

  // Resolve binary position ('LEFT' | 'RIGHT')
  const rawPos = String(this.position || this.binaryPosition || BINARY_POSITION.LEFT).toUpperCase();
  const normalizedPos = rawPos === 'RIGHT' ? BINARY_POSITION.RIGHT : BINARY_POSITION.LEFT;
  this.position = normalizedPos;
  this.binaryPosition = normalizedPos;

  // Minimum 100 Business Volume (BV) required to participate in Binary Income Tree
  if ((this.personalBv || 0) >= 100) {
    if (!this.isBinaryActive) {
      this.isBinaryActive = true;
      if (!this.binaryActivatedAt) {
        this.binaryActivatedAt = new Date();
      }
    }
  } else {
    this.isBinaryActive = false;
  }

  // Hash password if modified
  if (this.isModified('password') && this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
});

// Compare password method
memberSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Sequential ID generation
memberSchema.statics.generateNextMemberId = async function (): Promise<string> {
  const lastMember = await this.findOne({ memberId: { $regex: /^MEM\d+$/i } })
    .sort({ createdAt: -1 })
    .exec();

  if (!lastMember || !lastMember.memberId) {
    return 'MEM0001';
  }

  const numericPart = parseInt(lastMember.memberId.replace(/\D/g, ''), 10);
  const nextNumber = isNaN(numericPart) ? 1 : numericPart + 1;
  return `MEM${String(nextNumber).padStart(4, '0')}`;
};

export const Member = mongoose.model<IMember, IMemberModel>('Member', memberSchema);
export default Member;
