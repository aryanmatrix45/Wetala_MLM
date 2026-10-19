import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IFooterLink {
  label: string;
  url: string;
  openInNewTab: boolean;
  isActive: boolean;
  order: number;
}

export interface IFooterConfig extends Document {
  configId: string;
  // Brand & About Column
  brandName: string;
  brandTrademark?: string;
  tagline?: string;
  logoUrl?: string;
  aboutText?: string;

  // Navigational Link Columns
  helpTitle: string;
  helpLinks: IFooterLink[];
  customerCareTitle: string;
  customerCareLinks: IFooterLink[];

  // Contact Information Column
  contactTitle: string;
  operatingAddressTitle: string;
  operatingAddress: string;
  corporateAddressTitle?: string;
  corporateAddress?: string;
  emailTitle: string;
  emails: string[];
  phoneTitle: string;
  phoneNumbers: string[];
  businessHoursTitle: string;
  businessHoursWeekdays?: string;
  businessHoursWeekend?: string;

  // Social Links & Footer Bottom
  showSocialLinks: boolean;
  copyrightText: string;
  disclaimerText?: string;

  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFooterConfigModel extends Model<IFooterConfig> {
  getOrCreateDefault(): Promise<IFooterConfig>;
}

// Convert Google Drive view/share links or Dropbox links to direct image URLs
export function normalizeDirectImageUrl(url?: string): string {
  if (!url) return '';
  let trimmed = url.trim();

  // Google Drive
  const gDriveMatch = trimmed.match(
    /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?.*id=)([a-zA-Z0-9_-]+)/i
  );
  if (gDriveMatch && gDriveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${gDriveMatch[1]}=s0`;
  }

  // Dropbox
  if (trimmed.includes('dropbox.com')) {
    trimmed = trimmed.replace(/\?dl=0$/, '?raw=1').replace(/&dl=0$/, '&raw=1');
    if (!trimmed.includes('raw=1')) {
      trimmed += (trimmed.includes('?') ? '&' : '?') + 'raw=1';
    }
    return trimmed;
  }

  return trimmed;
}

const footerLinkSchema = new Schema<IFooterLink>(
  {
    label: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true, default: '#' },
    openInNewTab: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { _id: true }
);

const footerConfigSchema = new Schema<IFooterConfig, IFooterConfigModel>(
  {
    configId: {
      type: String,
      required: true,
      unique: true,
      default: 'DEFAULT_FOOTER_CONFIG',
      index: true,
    },
    brandName: {
      type: String,
      default: 'Treandora',
      trim: true,
    },
    brandTrademark: {
      type: String,
      default: 'TM',
      trim: true,
    },
    tagline: {
      type: String,
      default: 'Shop with the trend',
      trim: true,
    },
    logoUrl: {
      type: String,
      default: '/logo.png',
      trim: true,
    },
    aboutText: {
      type: String,
      default:
        "Treandora – Shop with the Trend, Earn with the Trend. Treandora is India's first Referral-Based E-commerce Platform, where every person can start their online business with zero investment. Our aim is to give people financial freedom by connecting Shopping with Earning. It is a trusted Indian Digital Commerce Ecosystem that connects Sellers, Resellers and Customers together. Treandora – Not just a Marketplace, it's a Revolution of Earning!",
      trim: true,
    },

    helpTitle: {
      type: String,
      default: 'Help',
      trim: true,
    },
    helpLinks: {
      type: [footerLinkSchema],
      default: [
        { label: 'About Us', url: '#about', openInNewTab: false, isActive: true, order: 1 },
        { label: 'Our Vision', url: '#vision', openInNewTab: false, isActive: true, order: 2 },
        { label: 'Legal Corner', url: '#legal', openInNewTab: false, isActive: true, order: 3 },
        { label: 'How to Shop Guide', url: '#shop-guide', openInNewTab: false, isActive: true, order: 4 },
        { label: 'Support Tickets', url: '#support', openInNewTab: false, isActive: true, order: 5 },
        { label: 'FAQs', url: '#faq', openInNewTab: false, isActive: true, order: 6 },
        { label: 'Blogs', url: '#blogs', openInNewTab: false, isActive: true, order: 7 },
        { label: 'Success Story', url: '#success-story', openInNewTab: false, isActive: true, order: 8 },
      ],
    },

    customerCareTitle: {
      type: String,
      default: 'Customer Care',
      trim: true,
    },
    customerCareLinks: {
      type: [footerLinkSchema],
      default: [
        { label: 'Return & Refund Policy', url: '#refund-policy', openInNewTab: false, isActive: true, order: 1 },
        { label: 'Terms & Conditions', url: '#terms', openInNewTab: false, isActive: true, order: 2 },
        { label: 'Privacy Policy', url: '#privacy-policy', openInNewTab: false, isActive: true, order: 3 },
        { label: 'Cancellation Policy', url: '#cancellation-policy', openInNewTab: false, isActive: true, order: 4 },
        { label: 'Shipping & Delivery Policy', url: '#shipping-policy', openInNewTab: false, isActive: true, order: 5 },
        { label: 'Income Disclaimer & Earnings Terms', url: '#income-disclaimer', openInNewTab: false, isActive: true, order: 6 },
        { label: 'Testimonials', url: '#testimonials', openInNewTab: false, isActive: true, order: 7 },
      ],
    },

    contactTitle: {
      type: String,
      default: 'Contact Us',
      trim: true,
    },
    operatingAddressTitle: {
      type: String,
      default: 'Operating Office Address :',
      trim: true,
    },
    operatingAddress: {
      type: String,
      default: 'F-9, Shivan Complex, Opp. Bajaj Showroom, Approach Road, Prantij - 383205, Gujarat, India',
      trim: true,
    },
    corporateAddressTitle: {
      type: String,
      default: 'Corporate Office Address :',
      trim: true,
    },
    corporateAddress: {
      type: String,
      default: 'Coming soon...',
      trim: true,
    },
    emailTitle: {
      type: String,
      default: 'Email:',
      trim: true,
    },
    emails: {
      type: [String],
      default: ['support@treandora.com', 'treandoramarketing@gmail.com'],
    },
    phoneTitle: {
      type: String,
      default: 'Phone:',
      trim: true,
    },
    phoneNumbers: {
      type: [String],
      default: ['+91 97375 43491', '+91 99989 20494'],
    },
    businessHoursTitle: {
      type: String,
      default: 'Business Hours:',
      trim: true,
    },
    businessHoursWeekdays: {
      type: String,
      default: 'Monday – Saturday: 10:00 AM – 7:00 PM',
      trim: true,
    },
    businessHoursWeekend: {
      type: String,
      default: 'Sunday: Closed',
      trim: true,
    },

    showSocialLinks: {
      type: Boolean,
      default: true,
    },
    copyrightText: {
      type: String,
      default: '© Treandora / Wetala. All Rights Reserved.',
      trim: true,
    },
    disclaimerText: {
      type: String,
      default: '',
      trim: true,
    },
    updatedBy: {
      type: String,
      default: 'System',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Normalize Google Drive image URL before save/validation
footerConfigSchema.pre('validate', function () {
  if (this.logoUrl) {
    this.logoUrl = normalizeDirectImageUrl(this.logoUrl);
  }
});

// Singleton helper: get or create default configuration
footerConfigSchema.statics.getOrCreateDefault = async function (): Promise<IFooterConfig> {
  let config = await this.findOne({ configId: 'DEFAULT_FOOTER_CONFIG' });
  if (!config) {
    config = await this.create({
      configId: 'DEFAULT_FOOTER_CONFIG',
      brandName: 'Treandora',
      brandTrademark: 'TM',
      tagline: 'Shop with the trend',
      logoUrl: '/logo.png',
      aboutText:
        "Treandora – Shop with the Trend, Earn with the Trend. Treandora is India's first Referral-Based E-commerce Platform, where every person can start their online business with zero investment. Our aim is to give people financial freedom by connecting Shopping with Earning. It is a trusted Indian Digital Commerce Ecosystem that connects Sellers, Resellers and Customers together. Treandora – Not just a Marketplace, it's a Revolution of Earning!",
      helpTitle: 'Help',
      customerCareTitle: 'Customer Care',
      contactTitle: 'Contact Us',
      operatingAddressTitle: 'Operating Office Address :',
      operatingAddress: 'F-9, Shivan Complex, Opp. Bajaj Showroom, Approach Road, Prantij - 383205, Gujarat, India',
      corporateAddressTitle: 'Corporate Office Address :',
      corporateAddress: 'Coming soon...',
      emailTitle: 'Email:',
      emails: ['support@treandora.com', 'treandoramarketing@gmail.com'],
      phoneTitle: 'Phone:',
      phoneNumbers: ['+91 97375 43491', '+91 99989 20494'],
      businessHoursTitle: 'Business Hours:',
      businessHoursWeekdays: 'Monday – Saturday: 10:00 AM – 7:00 PM',
      businessHoursWeekend: 'Sunday: Closed',
      showSocialLinks: true,
      copyrightText: `© ${new Date().getFullYear()} Treandora / Wetala. All Rights Reserved.`,
      updatedBy: 'System',
    });
  }
  return config;
};

export const FooterConfig = mongoose.model<IFooterConfig, IFooterConfigModel>(
  'FooterConfig',
  footerConfigSchema
);

export default FooterConfig;
