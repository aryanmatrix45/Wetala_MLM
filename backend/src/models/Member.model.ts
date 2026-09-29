import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES, BINARY_POSITION, BinaryPosition } from '../config/constants';

export type MemberStatus = 'active' | 'inactive' | 'blocked';

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
  
  // Binary Placement Relationship (Binary Tree - NOT the same as sponsor)
  binaryParentId: string;
  binaryPosition: BinaryPosition;
  
  // Aliases for legacy compatibility
  placementId?: string;
  position?: 'left' | 'right';
  
  rank: string;
  status: MemberStatus;
  isActive: boolean;
  joiningPackageId?: string;
  packageName?: string;
  packageBv?: number;
  packageRp?: number;
  dailyCapping?: number;
  
  joinedAt: Date;
  joinDate: string;
  
  // High-level volume cache (detailed audit stored in BinaryVolume & BVLedger)
  leftBv: number;
  rightBv: number;
  matchedPairs: number;
  totalIncome: number;
  walletBalance: number;
  
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
    binaryParentId: {
      type: String,
      trim: true,
      index: true,
      default: '',
    },
    binaryPosition: {
      type: String,
      enum: [BINARY_POSITION.LEFT, BINARY_POSITION.RIGHT],
      default: BINARY_POSITION.LEFT,
      index: true,
    },
    
    // Legacy support
    placementId: {
      type: String,
      trim: true,
    },
    position: {
      type: String,
      enum: ['left', 'right'],
    },
    
    rank: {
      type: String,
      default: 'Distributor',
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'blocked'],
      default: 'active',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    joiningPackageId: {
      type: String,
      ref: 'Package',
    },
    packageName: {
      type: String,
      default: 'Package 1',
    },
    packageBv: {
      type: Number,
      default: 1250,
    },
    packageRp: {
      type: Number,
      default: 1,
    },
    dailyCapping: {
      type: Number,
      default: 4000,
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
  },
  {
    timestamps: true,
  }
);

// Compound index to guarantee uniqueness of binary leg under a parent
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

// Synchronize legacy fields with binaryParentId and binaryPosition
memberSchema.pre('save', async function () {
  if (this.mobile && !this.phone) {
    this.phone = this.mobile;
  }
  if (this.placementId && !this.binaryParentId) {
    this.binaryParentId = this.placementId;
  }
  if (!this.placementId && this.binaryParentId) {
    this.placementId = this.binaryParentId;
  }
  if (this.position && !this.binaryPosition) {
    this.binaryPosition = this.position.toUpperCase() === 'RIGHT' ? BINARY_POSITION.RIGHT : BINARY_POSITION.LEFT;
  }
  if (this.binaryPosition && !this.position) {
    this.position = this.binaryPosition.toLowerCase() as 'left' | 'right';
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
