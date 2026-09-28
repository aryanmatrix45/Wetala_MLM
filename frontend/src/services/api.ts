/**
 * Centralized API client for Wetala MLM Admin Portal
 * Reads base URL from import.meta.env.VITE_API_BASE_URL (configured via frontend/.env)
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export interface DashboardStats {
  totalMembers: number;
  newRegistrations: number;
  registrationsToday: number;
  totalIncomeMonth: number;
  totalPayoutMonth: number;
  quickStats: {
    activeMembers: number;
    activePercent: number;
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
  async getPackages() {
    const res = await fetch(`${API_BASE_URL}/packages`);
    if (!res.ok) throw new Error(`Failed to fetch packages: ${res.statusText}`);
    return res.json();
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
  async getBinaryTree(root?: string, depth?: number) {
    const params = new URLSearchParams();
    if (root) params.append('root', root);
    if (depth) params.append('depth', String(depth));
    const res = await fetch(`${API_BASE_URL}/binary/tree?${params.toString()}`);
    return res.json();
  },

  // Sponsor Tree
  async getSponsorTree(root?: string, depth?: number) {
    const params = new URLSearchParams();
    if (root) params.append('root', root);
    if (depth) params.append('depth', String(depth));
    const res = await fetch(`${API_BASE_URL}/sponsor/tree?${params.toString()}`);
    return res.json();
  },

  // Compensation Rules & Simulator
  async getCompensationRules() {
    const res = await fetch(`${API_BASE_URL}/compensation/rules`);
    return res.json();
  },

  async updateCompensationRules(rules: any, token: string) {
    const res = await fetch(`${API_BASE_URL}/compensation/rules`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(rules),
    });
    return res.json();
  },

  async simulateCompensation(data: any) {
    const res = await fetch(`${API_BASE_URL}/compensation/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  // Reports & Overview
  async getReportOverview() {
    const res = await fetch(`${API_BASE_URL}/reports/overview`);
    return res.json();
  },

  async getAuditLogs(token: string) {
    const res = await fetch(`${API_BASE_URL}/reports/audit-logs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  },
};
