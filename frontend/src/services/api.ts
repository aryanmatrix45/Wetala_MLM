/**
 * Centralized API client for Wetala MLM Admin Portal
 * Reads base URL from import.meta.env.VITE_API_BASE_URL (configured via frontend/.env)
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Resolves static asset URLs (e.g. /uploads/products/...) relative to the backend origin
 * or returns full URLs untouched.
 */
export const getAssetUrl = (url?: string): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  // If API_BASE_URL is an absolute URL (e.g. https://api.panchvedawellness.com/api), resolve against its origin
  if (API_BASE_URL.startsWith('http://') || API_BASE_URL.startsWith('https://')) {
    try {
      const u = new URL(API_BASE_URL);
      return `${u.origin}${url.startsWith('/') ? '' : '/'}${url}`;
    } catch {
      return url;
    }
  }
  return url;
};

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
  dob?: string;
  sponsorId: string;
  parentId?: string;
  placementId: string;
  position: 'left' | 'right' | 'LEFT' | 'RIGHT';
  packageName: string;
  packageBv?: number;
  joinDate: string;
  status: 'active' | 'inactive' | 'pending' | 'rejected';
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  addedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
  isActive?: boolean;
  personalBv?: number;
  isBinaryActive?: boolean;
  binaryActivatedAt?: string;
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

export interface CompanyAccountData {
  _id?: string;
  accountId: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
  accountType: string;
  upiId: string;
  upiHolderName: string;
  qrCodeUrl: string;
  qrCodeKey?: string;
  depositInstructions?: string;
  supportPhone?: string;
  supportEmail?: string;
  isActive: boolean;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
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

export interface ProductImage {
  url: string;
  key: string;
  alt?: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface CategoryItem {
  _id?: string;
  name: string;
  slug: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  subcategoryCount?: number;
  productCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubcategoryItem {
  _id?: string;
  name: string;
  slug: string;
  categoryId: string | CategoryItem;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  productCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductItem {
  _id?: string;
  productId: string;
  title: string;
  name?: string;
  slug: string;
  sku: string;
  shortDescription?: string;
  description?: string;
  categoryId?: string | CategoryItem;
  subcategoryId?: string | SubcategoryItem | null;
  category?: string;
  subcategory?: string;
  brand?: string;
  businessVolume: number;
  bv?: number;
  price: number;
  priceInPaise?: number;
  mrp?: number;
  mrpInPaise?: number;
  images: ProductImage[];
  stock: number;
  stockQuantity?: number;
  status: 'ACTIVE' | 'INACTIVE';
  isActive?: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
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
  async getMembers(token?: string): Promise<ApiMember[]> {
    const headers: Record<string, string> = {};
    const authToken = token || localStorage.getItem('wetala_token');
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    const res = await fetch(`${API_BASE_URL}/members`, { headers });
    if (!res.ok) throw new Error(`Failed to fetch members: ${res.statusText}`);
    return res.json();
  },

  async addMember(data: any, token?: string): Promise<any> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const authToken = token || localStorage.getItem('wetala_token');
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    const res = await fetch(`${API_BASE_URL}/members`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.message || `Failed to create member: ${res.statusText}`);
    }
    return result;
  },

  // Member Approval Requests for Super Admin
  async getMemberRequests(token?: string): Promise<{ status: boolean; totalPending: number; data: any[] }> {
    const headers: Record<string, string> = {};
    const authToken = token || localStorage.getItem('wetala_token');
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    const res = await fetch(`${API_BASE_URL}/admin/member-requests`, { headers });
    if (!res.ok) throw new Error(`Failed to fetch member requests: ${res.statusText}`);
    return res.json();
  },

  async approveMemberRequest(id: string, token?: string): Promise<any> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const authToken = token || localStorage.getItem('wetala_token');
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    const res = await fetch(`${API_BASE_URL}/admin/member-requests/${id}/approve`, {
      method: 'PUT',
      headers,
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || 'Failed to approve member request');
    return result;
  },

  async rejectMemberRequest(id: string, reason?: string, token?: string): Promise<any> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const authToken = token || localStorage.getItem('wetala_token');
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    const res = await fetch(`${API_BASE_URL}/admin/member-requests/${id}/reject`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ reason }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || 'Failed to reject member request');
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

  // Categories (Member & Public)
  async getCategories() {
    const res = await fetch(`${API_BASE_URL}/categories`);
    return res.json();
  },

  // Categories (SuperAdmin)
  async adminGetCategories(params?: any, token?: string) {
    const searchParams = new URLSearchParams(params || {});
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/admin/categories?${searchParams.toString()}`, { headers });
    return res.json();
  },

  async adminGetCategoryById(id: string, token?: string) {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/admin/categories/${encodeURIComponent(id)}`, { headers });
    return res.json();
  },

  async adminCreateCategory(data: any, token?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/admin/categories`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async adminUpdateCategory(id: string, data: any, token?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/admin/categories/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async adminDeleteCategory(id: string, token?: string) {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/admin/categories/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    });
    return res.json();
  },

  async adminUpdateCategoryStatus(id: string, status?: string, token?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/admin/categories/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(status ? { status } : {}),
    });
    return res.json();
  },

  // Subcategories (Member & Public)
  async getSubcategories(params?: { categoryId?: string }) {
    const searchParams = new URLSearchParams(params as any || {});
    const res = await fetch(`${API_BASE_URL}/subcategories?${searchParams.toString()}`);
    return res.json();
  },

  // Subcategories (SuperAdmin)
  async adminGetSubcategories(params?: any, token?: string) {
    const searchParams = new URLSearchParams(params || {});
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/admin/subcategories?${searchParams.toString()}`, { headers });
    return res.json();
  },

  async adminGetSubcategoryById(id: string, token?: string) {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/admin/subcategories/${encodeURIComponent(id)}`, { headers });
    return res.json();
  },

  async adminCreateSubcategory(data: any, token?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/admin/subcategories`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async adminUpdateSubcategory(id: string, data: any, token?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/admin/subcategories/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async adminDeleteSubcategory(id: string, token?: string) {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/admin/subcategories/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    });
    return res.json();
  },

  async adminUpdateSubcategoryStatus(id: string, status?: string, token?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/admin/subcategories/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(status ? { status } : {}),
    });
    return res.json();
  },

  // Products (Member & Public)
  async getProducts(params?: any) {
    const searchParams = new URLSearchParams(params || {});
    const res = await fetch(`${API_BASE_URL}/products?${searchParams.toString()}`);
    return res.json();
  },

  async getProductBySlug(slug: string) {
    const res = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(slug)}`);
    return res.json();
  },

  // Products (SuperAdmin Management)
  async adminGetProducts(params?: any, token?: string) {
    const searchParams = new URLSearchParams(params || {});
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/admin/products?${searchParams.toString()}`, { headers });
    return res.json();
  },

  async adminGetProductById(id: string, token?: string) {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/admin/products/${encodeURIComponent(id)}`, { headers });
    return res.json();
  },

  async adminCreateProduct(data: any, token?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/admin/products`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async adminUpdateProduct(id: string, data: any, token?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/admin/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async adminDeleteProduct(id: string, token?: string) {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/admin/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    });
    return res.json();
  },

  async adminUpdateProductStatus(id: string, status?: string, token?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/admin/products/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(status ? { status } : {}),
    });
    return res.json();
  },

  async adminUploadProductImage(data: { data: string; filename?: string; alt?: string }, token?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/admin/products/upload-image`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
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

  // Sponsor Binary Income APIs
  async getSponsorIncomeSummary(memberId: string, token?: string) {
    const savedToken = token || localStorage.getItem('wetala_token') || '';
    const res = await fetch(`${API_BASE_URL}/sponsor/income/summary/${memberId}`, {
      headers: savedToken ? { Authorization: `Bearer ${savedToken}` } : {},
    });
    if (!res.ok) throw new Error(`Failed to fetch sponsor income: ${res.statusText}`);
    return res.json();
  },

  async getSponsorIncomeHistory(memberId: string, page: number = 1, limit: number = 20, token?: string) {
    const savedToken = token || localStorage.getItem('wetala_token') || '';
    const res = await fetch(`${API_BASE_URL}/sponsor/income/history/${memberId}?page=${page}&limit=${limit}`, {
      headers: savedToken ? { Authorization: `Bearer ${savedToken}` } : {},
    });
    if (!res.ok) throw new Error(`Failed to fetch sponsor income history: ${res.statusText}`);
    return res.json();
  },

  // Company Payment Account & QR Code APIs
  async getCompanyAccount(token?: string): Promise<{ status: boolean; data: CompanyAccountData }> {
    const savedToken = token || localStorage.getItem('wetala_token') || '';
    const res = await fetch(`${API_BASE_URL}/company-account`, {
      headers: savedToken ? { Authorization: `Bearer ${savedToken}` } : {},
    });
    if (!res.ok) throw new Error(`Failed to fetch company account: ${res.statusText}`);
    return res.json();
  },

  async updateCompanyAccount(
    data: Partial<CompanyAccountData>,
    token?: string
  ): Promise<{ status: boolean; message: string; data: CompanyAccountData }> {
    const savedToken = token || localStorage.getItem('wetala_token') || '';
    const res = await fetch(`${API_BASE_URL}/company-account`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${savedToken}`,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to update company account details');
    }
    return res.json();
  },

  async uploadCompanyQR(
    base64Image: string,
    token?: string
  ): Promise<{ status: boolean; message: string; data: { qrCodeUrl: string; qrCodeKey: string; account: CompanyAccountData } }> {
    const savedToken = token || localStorage.getItem('wetala_token') || '';
    const res = await fetch(`${API_BASE_URL}/company-account/upload-qr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${savedToken}`,
      },
      body: JSON.stringify({ base64Image }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to upload QR code');
    }
    return res.json();
  },

  async removeCompanyQR(token?: string): Promise<{ status: boolean; message: string; data: CompanyAccountData }> {
    const savedToken = token || localStorage.getItem('wetala_token') || '';
    const res = await fetch(`${API_BASE_URL}/company-account/qr`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${savedToken}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to remove QR code');
    }
    return res.json();
  },
};


