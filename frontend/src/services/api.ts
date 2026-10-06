/**
 * Centralized API client for Wetala MLM Admin Portal
 * Reads base URL from import.meta.env.VITE_API_BASE_URL (configured via frontend/.env)
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export interface DashboardStats {
  status?: boolean;
  totalMembers: number;
  newRegistrations: number;
  registrationsToday: number;
  totalIncomeMonth: number;
  totalPayoutMonth: number;
  totalPackagePrice: number;
  totalJoiningRevenue: number;
  totalGrossValue?: number;
  totalBusinessVolume?: number;
  totalBV?: number;
  weeklyGrossBusinessVolume?: number;
  weeklyGrossRevenue?: number;
  weeklyGrossValue?: number;
  pendingPayouts: number;
  recentMembers?: Array<{
    id: string;
    name: string;
    package: string;
    packagePrice?: number;
    bv: string;
    date: string;
    status: string;
    leg: string;
  }>;
  quickStats: {
    activeMembers: number;
    activePercent: number;
    inactiveMembers: number;
    totalBusinessVolume?: number;
    repurchaseBv: number;
    repurchasePercent: number;
    activeFranchises: number;
    franchisePercent: number;
    pendingPayouts: number;
  };
}

export interface ApiMember {
  id: string;
  memberId: string;
  name: string;
  email: string;
  mobile: string;
  sponsorId: string;
  placementId: string;
  position: 'left' | 'right';
  packageName: string;
  joinDate: string;
  status: 'active' | 'inactive';
  leftBv: number;
  rightBv: number;
  matchedPairs: number;
  totalIncome: number;
  walletBalance: number;
}

export interface ApiPayout {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  tdsDeduction: number;
  adminFee: number;
  netPayable: number;
  requestDate: string;
  status: 'pending' | 'paid' | 'rejected';
}

export interface WithdrawalRequestItem {
  _id: string;
  requestId: string;
  memberId: string;
  memberName?: string;
  requestedAmount: number;
  approvedAmount?: number;
  paidAmount?: number;
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED';
  note?: string;
  adminNote?: string;
  paymentReference?: string;
  requestedAt: string;
  approvedAt?: string;
  paidAt?: string;
  rejectedAt?: string;
  processedBy?: string;
  statusHistory?: Array<{
    status: string;
    changedAt: string;
    changedBy: string;
    note?: string;
  }>;
}

export interface WithdrawalSummary {
  availablePayout: number;
  totalPayout: number;
  totalWithdrawn: number;
  totalPending: number;
  requestsCount: number;
  pendingCount: number;
  approvedCount: number;
  paidCount: number;
  rejectedCount: number;
}

export interface PackageItem {
  _id?: string;
  packageId: string;
  packageNumber: number;
  name: string;
  badge?: string;
  price: number;
  priceInPaise?: number;
  bv: number;
  rp: number;
  dailyCapping: number;
  description?: string;
  features?: string[];
  isPopular?: boolean;
  isActive: boolean;
}

export const api = {
  // Authentication & SuperAdmin Setup
  async getSuperAdminStatus(): Promise<{ status: boolean; isInitialized: boolean }> {
    const res = await fetch(`${API_BASE_URL}/auth/superadmin-status`);
    return res.json();
  },

  async setupSuperAdmin(data: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    password: string;
  }) {
    const res = await fetch(`${API_BASE_URL}/auth/setup-superadmin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async login(credentials: { email: string; password: string }) {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    return res.json();
  },

  async register(data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword?: string;
    sponsorId?: string;
  }) {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async getProfile(token: string) {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  },

  async updateProfile(
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      email?: string;
      currentPassword?: string;
      newPassword?: string;
    },
    token: string
  ) {
    const res = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // Health check
  async getHealth() {
    const res = await fetch(`${API_BASE_URL}/health`);
    return res.json();
  },

  // Dashboard Stats
  async getDashboardStats(): Promise<DashboardStats> {
    const res = await fetch(`${API_BASE_URL}/dashboard/stats`);
    if (!res.ok) throw new Error(`Failed to fetch stats: ${res.statusText}`);
    return res.json();
  },

  // Binary Volume & Live Matching Stats
  async getBinaryVolume(memberId: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/binary/volume/${memberId}`);
    if (!res.ok) throw new Error(`Failed to fetch binary volume: ${res.statusText}`);
    return res.json();
  },

  // Members
  async getMembers(): Promise<ApiMember[]> {
    const res = await fetch(`${API_BASE_URL}/members`);
    if (!res.ok) throw new Error(`Failed to fetch members: ${res.statusText}`);
    return res.json();
  },

  async addMember(data: any): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.message || `Failed to create member: ${res.statusText}`);
    }
    return result;
  },

  // Genealogy Tree
  async getGenealogyTree() {
    const res = await fetch(`${API_BASE_URL}/genealogy/tree`);
    if (!res.ok) throw new Error(`Failed to fetch genealogy tree: ${res.statusText}`);
    return res.json();
  },

  // Packages
  async getPackages(): Promise<{ status: boolean; data: PackageItem[] }> {
    const res = await fetch(`${API_BASE_URL}/packages`);
    if (!res.ok) throw new Error(`Failed to fetch packages: ${res.statusText}`);
    return res.json();
  },

  async createPackage(data: Partial<PackageItem>, token: string) {
    const res = await fetch(`${API_BASE_URL}/packages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || 'Failed to create package');
    return result;
  },

  async updatePackage(packageId: string, data: Partial<PackageItem>, token: string) {
    const res = await fetch(`${API_BASE_URL}/packages/${packageId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || 'Failed to update package');
    return result;
  },

  async deletePackage(packageId: string, token: string, hard: boolean = false) {
    const res = await fetch(`${API_BASE_URL}/packages/${packageId}?hard=${hard}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || 'Failed to delete package');
    return result;
  },

  async buyPackage(packageId: string, token: string) {
    const res = await fetch(`${API_BASE_URL}/packages/buy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ packageId }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || 'Failed to buy package');
    return result;
  },

  // Payouts
  async getPayouts(): Promise<ApiPayout[]> {
    const res = await fetch(`${API_BASE_URL}/payouts`);
    if (!res.ok) throw new Error(`Failed to fetch payouts: ${res.statusText}`);
    return res.json();
  },

  async processPayout(id: string, action: 'pay' | 'reject') {
    const res = await fetch(`${API_BASE_URL}/payouts/${id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) throw new Error(`Failed to process payout: ${res.statusText}`);
    return res.json();
  },

  // Binary Tree
  async getBinaryTree(root?: string, depth?: number | string, token?: string) {
    const params = new URLSearchParams();
    if (root) params.append('root', root);
    if (depth !== undefined && depth !== null) params.append('depth', String(depth));
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE_URL}/binary/tree?${params.toString()}`, { headers });
    return res.json();
  },

  async getBinaryExtremes(root?: string, token?: string) {
    const params = new URLSearchParams();
    if (root) params.append('root', root);
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE_URL}/binary/extremes?${params.toString()}`, { headers });
    return res.json();
  },

  async validatePlacement(parentId: string, position: string, candidateMemberId?: string) {
    const res = await fetch(`${API_BASE_URL}/binary/validate-placement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId, position, candidateMemberId }),
    });
    return res.json();
  },

  // Sponsor Tree
  async getSponsorTree(root?: string, depth?: number, token?: string) {
    const params = new URLSearchParams();
    if (root) params.append('root', root);
    if (depth) params.append('depth', String(depth));
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE_URL}/sponsor/tree?${params.toString()}`, { headers });
    return res.json();
  },

  // Compensation Rules & Simulator
  async getCompensationRules(token?: string) {
    const headers: Record<string, string> = {};
    const savedToken = token || localStorage.getItem('wetala_token');
    if (savedToken) {
      headers['Authorization'] = `Bearer ${savedToken}`;
    }
    const res = await fetch(`${API_BASE_URL}/compensation/rules`, { headers });
    return res.json();
  },

  async updateCompensationRules(rules: any, token?: string) {
    const savedToken = token || localStorage.getItem('wetala_token');
    const res = await fetch(`${API_BASE_URL}/compensation/rules`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${savedToken}`,
      },
      body: JSON.stringify(rules),
    });
    return res.json();
  },

  async simulateCompensation(data: any, token?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const savedToken = token || localStorage.getItem('wetala_token');
    if (savedToken) {
      headers['Authorization'] = `Bearer ${savedToken}`;
    }
    const res = await fetch(`${API_BASE_URL}/compensation/simulate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async getCommissionExplanation(commissionId: string) {
    const res = await fetch(`${API_BASE_URL}/compensation/commission/${commissionId}`);
    return res.json();
  },

  async getCommissions(params?: any) {
    const searchParams = new URLSearchParams(params || {});
    const res = await fetch(`${API_BASE_URL}/compensation/commissions?${searchParams.toString()}`);
    return res.json();
  },

  // Products
  async getProducts() {
    const res = await fetch(`${API_BASE_URL}/products`);
    return res.json();
  },

  // Purchases
  async getPurchases(params?: any) {
    const searchParams = new URLSearchParams(params || {});
    const res = await fetch(`${API_BASE_URL}/purchases?${searchParams.toString()}`);
    return res.json();
  },

  async createPurchase(data: any) {
    const res = await fetch(`${API_BASE_URL}/purchases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // Wallet
  async getWallet(memberId: string) {
    const res = await fetch(`${API_BASE_URL}/wallet/${memberId}`);
    return res.json();
  },

  async getWalletTransactions(memberId: string) {
    const res = await fetch(`${API_BASE_URL}/wallet/transactions/${memberId}`);
    return res.json();
  },

  async requestWithdrawal(data: any, token: string) {
    const res = await fetch(`${API_BASE_URL}/wallet/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // Standalone Welcome Bonus System
  async getWelcomeBonusPreview(overrideGBV?: number) {
    const query = typeof overrideGBV === 'number' ? `?overrideGBV=${overrideGBV}` : '';
    const res = await fetch(`${API_BASE_URL}/welcome-bonus/preview${query}`);
    return res.json();
  },

  async settleWelcomeBonus(data?: { overrideGBV?: number; settlementId?: string }) {
    const res = await fetch(`${API_BASE_URL}/welcome-bonus/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {}),
    });
    return res.json();
  },

  async getWelcomeBonusSettlements() {
    const res = await fetch(`${API_BASE_URL}/welcome-bonus/settlements`);
    return res.json();
  },

  async getWelcomeBonusMemberStatus(memberId?: string) {
    const path = memberId ? `/${memberId}` : '';
    const res = await fetch(`${API_BASE_URL}/welcome-bonus/member-status${path}`);
    return res.json();
  },

  // Withdrawal Request System
  async submitWithdrawalRequest(data: { amount: number; note?: string; memberId?: string }, token?: string) {
    const savedToken = token || localStorage.getItem('wetala_token') || '';
    const res = await fetch(`${API_BASE_URL}/withdrawals/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${savedToken}`,
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async getMyWithdrawals(token?: string, memberId?: string) {
    const savedToken = token || localStorage.getItem('wetala_token') || '';
    const query = memberId ? `?memberId=${memberId}` : '';
    const res = await fetch(`${API_BASE_URL}/withdrawals/my-requests${query}`, {
      headers: { Authorization: `Bearer ${savedToken}` },
    });
    return res.json();
  },

  async getWithdrawalBalanceSummary(memberId?: string, token?: string) {
    const savedToken = token || localStorage.getItem('wetala_token') || '';
    const path = memberId ? `/${memberId}` : '';
    const res = await fetch(`${API_BASE_URL}/withdrawals/balance-summary${path}`, {
      headers: { Authorization: `Bearer ${savedToken}` },
    });
    return res.json();
  },

  async getAllWithdrawalsAdmin(params?: { status?: string; search?: string; page?: number; limit?: number }, token?: string) {
    const savedToken = token || localStorage.getItem('wetala_token') || '';
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));

    const res = await fetch(`${API_BASE_URL}/withdrawals/admin/all?${searchParams.toString()}`, {
      headers: { Authorization: `Bearer ${savedToken}` },
    });
    return res.json();
  },

  async approveWithdrawal(id: string, data?: { approvedAmount?: number; adminNote?: string }, token?: string) {
    const savedToken = token || localStorage.getItem('wetala_token') || '';
    const res = await fetch(`${API_BASE_URL}/withdrawals/admin/${id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${savedToken}`,
      },
      body: JSON.stringify(data || {}),
    });
    return res.json();
  },

  async rejectWithdrawal(id: string, data: { adminNote: string }, token?: string) {
    const savedToken = token || localStorage.getItem('wetala_token') || '';
    const res = await fetch(`${API_BASE_URL}/withdrawals/admin/${id}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${savedToken}`,
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async markWithdrawalAsPaid(id: string, data: { paidAmount?: number; paymentReference: string; adminNote?: string }, token?: string) {
    const savedToken = token || localStorage.getItem('wetala_token') || '';
    const res = await fetch(`${API_BASE_URL}/withdrawals/admin/${id}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${savedToken}`,
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async getAdminNotifications(token?: string) {
    const savedToken = token || localStorage.getItem('wetala_token') || '';
    const res = await fetch(`${API_BASE_URL}/withdrawals/notifications/admin`, {
      headers: { Authorization: `Bearer ${savedToken}` },
    });
    return res.json();
  },

  async getMemberNotifications(memberId?: string, token?: string) {
    const savedToken = token || localStorage.getItem('wetala_token') || '';
    const path = memberId ? `/${memberId}` : '';
    const res = await fetch(`${API_BASE_URL}/withdrawals/notifications/member${path}`, {
      headers: { Authorization: `Bearer ${savedToken}` },
    });
    return res.json();
  },

  async markNotificationRead(id: string, token?: string) {
    const savedToken = token || localStorage.getItem('wetala_token') || '';
    const res = await fetch(`${API_BASE_URL}/withdrawals/notifications/${id}/read`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${savedToken}` },
    });
    return res.json();
  },
};

