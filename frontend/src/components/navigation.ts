import type { LucideIcon } from 'lucide-react';
import {
  Home,
  LayoutDashboard,
  Users,
  UserCheck,
  GitFork,
  Gift,
  BarChart3,
  Handshake,
  Trophy,
  Wallet,
  Coins,
  ArrowDownToLine,
  ShoppingBag,
  Package,
  ShoppingCart,
  Landmark,
  Calculator,
  Users2,
  Medal,
  FolderTree,
  Layers,
  Images,
  Info,
  Video,
  Share2,
  LayoutTemplate,
  LayoutGrid,
  IndianRupee,
  UserRound,
} from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Count shown as a badge (hidden when 0) */
  count?: number;
}

export interface NavSection {
  id: string;
  title?: string;
  items: NavItem[];
}

export interface NavCounts {
  withdrawals?: number;
  memberRequests?: number;
  purchases?: number;
}

/* Single source for sidebar groups, labels and role visibility; the header reuses it for page context. */
export function getNavSections(user: any, counts: NavCounts = {}): NavSection[] {
  const isAdmin = user?.role?.toLowerCase() === 'superadmin';
  const hasPackage = Boolean(user?.packageName || user?.joiningPackageId);

  if (isAdmin) {
    return [
      { id: 'overview', items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
      {
        id: 'network',
        title: 'Network',
        items: [
          { id: 'members', label: 'All Members', icon: Users },
          { id: 'member-requests', label: 'Member Requests', icon: UserCheck, count: counts.memberRequests },
          { id: 'genealogy', label: 'Genealogy Tree', icon: GitFork },
        ],
      },
      {
        id: 'earnings',
        title: 'Earnings',
        items: [
          { id: 'welcome-bonus', label: 'Welcome Bonus', icon: Gift },
          { id: 'binary-ledger', label: 'Binary Income', icon: BarChart3 },
          { id: 'sponsor-income', label: 'Sponsor Income', icon: Handshake },
          { id: 'binary-leaderboard', label: 'Leaderboard', icon: Trophy },
        ],
      },
      {
        id: 'finance',
        title: 'Finance',
        items: [
          { id: 'withdrawals', label: 'Withdrawal Requests', icon: ArrowDownToLine, count: counts.withdrawals },
          { id: 'purchase-requests', label: 'Purchase Requests', icon: ShoppingCart, count: counts.purchases },
          { id: 'wallet-payouts', label: 'Wallet & Payouts', icon: Wallet },
          { id: 'bv-wallet', label: 'BV Wallet', icon: Coins },
          { id: 'company-earnings', label: 'Company Earnings', icon: IndianRupee },
          { id: 'company-account', label: 'Company Account', icon: Landmark },
        ],
      },
      {
        id: 'compensation',
        title: 'Compensation Plan',
        items: [
          { id: 'income-settings', label: 'Income Simulator', icon: Calculator },
          { id: 'team-bonus', label: 'Team Performance Slabs', icon: Users2 },
          { id: 'rank-rewards', label: 'Lifetime Rewards', icon: Medal },
        ],
      },
      {
        id: 'catalog',
        title: 'Catalog',
        items: [
          { id: 'packages', label: 'Packages', icon: Package },
          { id: 'manage-categories', label: 'Categories', icon: FolderTree },
          { id: 'manage-subcategories', label: 'Subcategories', icon: Layers },
          { id: 'manage-products', label: 'Products', icon: ShoppingBag },
        ],
      },
      {
        id: 'website',
        title: 'Website',
        items: [
          { id: 'manage-sliders', label: 'Home Sliders', icon: Images },
          { id: 'manage-highlights', label: 'Home Highlights', icon: LayoutGrid },
          { id: 'manage-about', label: 'About Us', icon: Info },
          { id: 'manage-videos', label: 'Videos', icon: Video },
          { id: 'manage-social-links', label: 'Social Links', icon: Share2 },
          { id: 'manage-footer', label: 'Footer & Company Info', icon: LayoutTemplate },
        ],
      },
      { id: 'account', title: 'Account', items: [{ id: 'profile', label: 'Profile & Referrals', icon: UserRound }] },
    ];
  }

  return [
    {
      id: 'overview',
      items: [
        { id: 'home', label: 'Home', icon: Home },
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      id: 'network',
      title: 'My Network',
      items: [
        { id: 'members', label: 'My Members', icon: Users },
        { id: 'genealogy', label: 'Genealogy Tree', icon: GitFork },
      ],
    },
    {
      id: 'earnings',
      title: 'Earnings',
      items: [
        { id: 'welcome-bonus', label: 'Welcome Bonus', icon: Gift },
        { id: 'binary-ledger', label: 'Binary Income', icon: BarChart3 },
        { id: 'sponsor-income', label: 'Sponsor Income', icon: Handshake },
        { id: 'binary-leaderboard', label: 'Leaderboard', icon: Trophy },
      ],
    },
    {
      id: 'wallet',
      title: 'Wallet',
      items: [
        { id: 'wallet-payouts', label: 'Wallet & Payouts', icon: Wallet },
        { id: 'bv-wallet', label: 'BV Wallet', icon: Coins },
        { id: 'withdrawals', label: 'My Withdrawals', icon: ArrowDownToLine, count: counts.withdrawals },
      ],
    },
    {
      id: 'shop',
      title: 'Shop',
      items: [
        { id: 'member-products', label: 'Products', icon: ShoppingBag },
        { id: 'packages', label: hasPackage ? 'Packages & Upgrade' : 'Buy Joining Package', icon: Package },
        { id: 'purchase-requests', label: 'My Orders', icon: ShoppingCart, count: counts.purchases },
        { id: 'company-account', label: 'Company Bank & QR', icon: Landmark },
      ],
    },
    {
      id: 'compensation',
      title: 'Compensation Plan',
      items: [
        { id: 'income-settings', label: 'Income Simulator', icon: Calculator },
        { id: 'team-bonus', label: 'Team Performance Slabs', icon: Users2 },
        { id: 'rank-rewards', label: 'Lifetime Rewards', icon: Medal },
      ],
    },
    { id: 'account', title: 'Account', items: [{ id: 'profile', label: 'Profile & KYC', icon: UserRound }] },
  ];
}

/** Section title and page label for a tab id, used for the header context */
export function findNavItem(user: any, tabId: string): { section?: string; label: string } | null {
  for (const section of getNavSections(user)) {
    const item = section.items.find((i) => i.id === tabId);
    if (item) return { section: section.title, label: item.label };
  }
  return null;
}
