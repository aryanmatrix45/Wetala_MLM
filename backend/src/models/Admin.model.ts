import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES } from '../config/constants';

export interface IAdmin extends Document {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  password: string;
  role: 'superadmin' | 'admin';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface IAdminModel extends Model<IAdmin> {
  isSuperAdminInitialized(): Promise<boolean>;
}

const adminSchema = new Schema<IAdmin, IAdminModel>(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Don't return password in queries by default
    },
    role: {
      type: String,
      enum: [ROLES.SUPERADMIN, ROLES.ADMIN],
      default: ROLES.SUPERADMIN,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
adminSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
adminSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Static helper to check if a SuperAdmin already exists in DB
adminSchema.statics.isSuperAdminInitialized = async function (): Promise<boolean> {
  const count = await this.countDocuments({ role: ROLES.SUPERADMIN });
  return count > 0;
};

export const Admin = mongoose.model<IAdmin, IAdminModel>('Admin', adminSchema);
export default Admin;
