import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ICompanyAccount extends Document {
  accountId: string;

  // 1. Bank Account Details
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
  accountType: string;

  // 2. UPI ID Details
  upiId: string;
  upiHolderName: string;

  // 3. QR Code Details
  qrCodeUrl: string;
  qrCodeKey?: string;

  // Additional Guidance & Support
  depositInstructions?: string;
  supportPhone?: string;
  supportEmail?: string;
  isActive: boolean;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICompanyAccountModel extends Model<ICompanyAccount> {
  getOrCreateDefault(): Promise<ICompanyAccount>;
}

const companyAccountSchema = new Schema<ICompanyAccount, ICompanyAccountModel>(
  {
    accountId: {
      type: String,
      required: true,
      unique: true,
      default: 'DEFAULT_COMPANY_ACCOUNT',
      index: true,
    },
    // 1. Bank Account Details
    bankName: {
      type: String,
      default: 'State Bank of India',
      trim: true,
    },
    accountHolderName: {
      type: String,
      default: 'Panchveda Wellness Pvt Ltd',
      trim: true,
    },
    accountNumber: {
      type: String,
      default: '9876543210123',
      trim: true,
    },
    ifscCode: {
      type: String,
      default: 'SBIN0001234',
      uppercase: true,
      trim: true,
    },
    branchName: {
      type: String,
      default: 'Connaught Place Branch, New Delhi',
      trim: true,
    },
    accountType: {
      type: String,
      default: 'Current Account',
      trim: true,
    },

    // 2. UPI ID Details
    upiId: {
      type: String,
      default: 'panchveda@sbi',
      trim: true,
      lowercase: true,
    },
    upiHolderName: {
      type: String,
      default: 'Panchveda Wellness Pvt Ltd',
      trim: true,
    },

    // 3. QR Code Details
    qrCodeUrl: {
      type: String,
      default: '',
      trim: true,
    },
    qrCodeKey: {
      type: String,
      default: '',
      trim: true,
    },

    depositInstructions: {
      type: String,
      default: 'Please enter your Member ID in the payment remarks/notes. After making the payment, take a screenshot of the transaction receipt and submit your request.',
      trim: true,
    },
    supportPhone: {
      type: String,
      default: '+91 98765 43210',
      trim: true,
    },
    supportEmail: {
      type: String,
      default: 'payments@panchvedawellness.com',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: String,
      default: 'ADMIN',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

companyAccountSchema.statics.getOrCreateDefault = async function (): Promise<ICompanyAccount> {
  let account = await this.findOne({ accountId: 'DEFAULT_COMPANY_ACCOUNT' });
  if (!account) {
    account = await this.create({
      accountId: 'DEFAULT_COMPANY_ACCOUNT',
      bankName: 'State Bank of India',
      accountHolderName: 'Panchveda Wellness Pvt Ltd',
      accountNumber: '9876543210123',
      ifscCode: 'SBIN0001234',
      branchName: 'Connaught Place Branch, New Delhi',
      accountType: 'Current Account',
      upiId: 'panchveda@sbi',
      upiHolderName: 'Panchveda Wellness Pvt Ltd',
      qrCodeUrl: '',
      depositInstructions: 'Please enter your Member ID in the payment remarks/notes. After making the payment, take a screenshot of the transaction receipt and submit your request.',
      isActive: true,
    });
  }
  return account;
};

export const CompanyAccount = mongoose.model<ICompanyAccount, ICompanyAccountModel>(
  'CompanyAccount',
  companyAccountSchema
);

export default CompanyAccount;
