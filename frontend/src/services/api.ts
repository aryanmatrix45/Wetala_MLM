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

  async addMember(data: any): Promise<ApiMember> {
    const res = await fetch(`${API_BASE_URL}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create member: ${res.statusText}`);
    return res.json();
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
};
