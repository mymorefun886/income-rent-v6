// API client with automatic token refresh
import { useAuthStore } from '@/stores/auth';

const API_BASE = '/api';

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    // Set the prototype explicitly for instanceof to work
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export { ApiError };

export async function api(endpoint: string, options: ApiOptions = {}) {
  const { method = 'GET', body, headers = {} } = options;

  // Get token from store
  const { accessToken, refreshToken, clearAuth, updateAccessToken } = useAuthStore.getState();

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  let response = await fetch(`${API_BASE}${endpoint}`, config);

  // Handle 401 - try to refresh token
  if (response.status === 401 && refreshToken) {
    const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (refreshResponse.ok) {
      const data = await refreshResponse.json();
      updateAccessToken(data.data.accessToken);

      // Retry original request
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${data.data.accessToken}`,
      };
      response = await fetch(`${API_BASE}${endpoint}`, config);
    } else {
      clearAuth();
      window.location.href = '/login';
      throw new ApiError(401, 'Session expired');
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new ApiError(response.status, error.error || 'Request failed');
  }

  return response.json();
}

// Auth API
export const authApi = {
  login: (username: string, password: string) =>
    api('/auth/login', { method: 'POST', body: { username, password } }),

  logout: () => api('/auth/logout', { method: 'POST' }),

  me: () => api('/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    api('/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    }),
};

// Properties API
export const propertiesApi = {
  list: (params?: { status?: string; building?: string; usageType?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.building) query.set('building', params.building);
    if (params?.usageType) query.set('usageType', params.usageType);
    if (params?.search) query.set('search', params.search);
    return api(`/properties?${query}`);
  },
  get: (id: string) => api(`/properties/${id}`),
  create: (data: Record<string, unknown>) => api('/properties', { method: 'POST', body: data }),
  update: (id: string, data: Record<string, unknown>) =>
    api(`/properties/${id}`, { method: 'PUT', body: data }),
  delete: (id: string) => api(`/properties/${id}`, { method: 'DELETE' }),
  buildings: () => api('/properties/stats/buildings'),
};

// Tenants API
export const tenantsApi = {
  list: (params?: { archived?: boolean | string; propertyId?: string; building?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.archived) query.set('archived', String(params.archived));
    if (params?.propertyId) query.set('propertyId', params.propertyId);
    if (params?.building) query.set('building', params.building);
    if (params?.search) query.set('search', params.search);
    return api(`/tenants?${query}`);
  },
  get: (id: string) => api(`/tenants/${id}`),
  create: (data: Record<string, unknown>) => api('/tenants', { method: 'POST', body: data }),
  update: (id: string, data: Record<string, unknown>) =>
    api(`/tenants/${id}`, { method: 'PUT', body: data }),
  delete: (id: string) => api(`/tenants/${id}`, { method: 'DELETE' }),
  autoUpdateStatus: () => api('/tenants/auto-update-status', { method: 'POST' }),
  statusSummary: () => api('/tenants/status-summary'),
};

// Records API
export const recordsApi = {
  list: (params?: { cycle?: string; status?: string; page?: number; pageSize?: number }) => {
    const query = new URLSearchParams();
    if (params?.cycle) query.set('cycle', params.cycle);
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    return api(`/records?${query}`);
  },
  get: (id: string) => api(`/records/${id}`),
  create: (data: Record<string, unknown>) => api('/records', { method: 'POST', body: data }),
  update: (id: string, data: Record<string, unknown>) =>
    api(`/records/${id}`, { method: 'PUT', body: data }),
  delete: (id: string) => api(`/records/${id}`, { method: 'DELETE' }),
  markSent: (ids: string[]) => api('/records/mark-sent', { method: 'POST', body: { ids } }),
};

// Contracts API
export const contractsApi = {
  list: (params?: { status?: string; tenantId?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.tenantId) query.set('tenantId', params.tenantId);
    return api(`/contracts?${query}`);
  },
  get: (id: string) => api(`/contracts/${id}`),
  create: (data: Record<string, unknown>) => api('/contracts', { method: 'POST', body: data }),
  update: (id: string, data: Record<string, unknown>) =>
    api(`/contracts/${id}`, { method: 'PUT', body: data }),
  delete: (id: string) => api(`/contracts/${id}`, { method: 'DELETE' }),
  reminders: () => api('/contracts/reminders'),
  renew: (id: string, data: { endDate?: string; rent?: number; notes?: string }) =>
    api(`/contracts/${id}/renew`, { method: 'POST', body: data }),
  autoGenerateRecords: (period: string) =>
    api('/contracts/auto-generate-records', { method: 'POST', body: { period } }),
};

// Payments API
export const paymentsApi = {
  list: (params?: { recordId?: string; tenantId?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.recordId) query.set('recordId', params.recordId);
    if (params?.tenantId) query.set('tenantId', params.tenantId);
    if (params?.limit) query.set('limit', String(params.limit));
    return api(`/payments?${query}`);
  },
  get: (id: string) => api(`/payments/${id}`),
  create: (data: Record<string, unknown>) => api('/payments', { method: 'POST', body: data }),
  update: (id: string, data: Record<string, unknown>) =>
    api(`/payments/${id}`, { method: 'PUT', body: data }),
  delete: (id: string) => api(`/payments/${id}`, { method: 'DELETE' }),
};

// Expenses API
export const expensesApi = {
  list: (params?: { category?: string; propertyId?: string; from?: string; to?: string; page?: number; pageSize?: number }) => {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.propertyId) query.set('propertyId', params.propertyId);
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    return api(`/expenses?${query}`);
  },
  get: (id: string) => api(`/expenses/${id}`),
  create: (data: Record<string, unknown>) => api('/expenses', { method: 'POST', body: data }),
  update: (id: string, data: Record<string, unknown>) =>
    api(`/expenses/${id}`, { method: 'PUT', body: data }),
  delete: (id: string) => api(`/expenses/${id}`, { method: 'DELETE' }),
  summary: (year?: string) => api(`/expenses/summary${year ? `?year=${year}` : ''}`),
};

// Work Orders API
export const workOrdersApi = {
  list: (params?: { status?: string; priority?: string; propertyId?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.priority) query.set('priority', params.priority);
    if (params?.propertyId) query.set('propertyId', params.propertyId);
    return api(`/work-orders?${query}`);
  },
  get: (id: string) => api(`/work-orders/${id}`),
  create: (data: Record<string, unknown>) => api('/work-orders', { method: 'POST', body: data }),
  update: (id: string, data: Record<string, unknown>) =>
    api(`/work-orders/${id}`, { method: 'PUT', body: data }),
  delete: (id: string) => api(`/work-orders/${id}`, { method: 'DELETE' }),
  syncExpense: (id: string) => api(`/work-orders/${id}/sync-expense`, { method: 'POST' }),
};

// Dashboard API
export const dashboardApi = {
  getStats: () => api('/dashboard/stats'),
  getMonthly: (year?: number) => api(`/dashboard/monthly${year ? `?year=${year}` : ''}`),
  getExpenseBreakdown: (year?: number) => api(`/dashboard/expense-breakdown${year ? `?year=${year}` : ''}`),
  getRecent: () => api('/dashboard/recent'),
};

// Transactions API
export const transactionsApi = {
  list: (params?: { status?: string; tenantId?: string; search?: string; page?: number; pageSize?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.tenantId) query.set('tenantId', params.tenantId);
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    return api(`/transactions?${query}`);
  },
  get: (id: string) => api(`/transactions/${id}`),
  create: (data: Record<string, unknown>) => api('/transactions', { method: 'POST', body: data }),
  update: (id: string, data: Record<string, unknown>) =>
    api(`/transactions/${id}`, { method: 'PUT', body: data }),
  delete: (id: string) => api(`/transactions/${id}`, { method: 'DELETE' }),
  match: (transactionId: string, recordId: string) =>
    api('/transactions/match', { method: 'POST', body: { transactionId, recordId } }),
  autoMatch: () => api('/transactions/auto-match', { method: 'POST' }),
};

// Meter Drafts API
export const meterDraftsApi = {
  list: (params?: { cycle?: string; building?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.cycle) query.set('cycle', params.cycle);
    if (params?.building) query.set('building', params.building);
    if (params?.status) query.set('status', params.status);
    return api(`/meter-drafts?${query}`);
  },
  get: (id: string) => api(`/meter-drafts/${id}`),
  create: (data: Record<string, unknown>) => api('/meter-drafts', { method: 'POST', body: data }),
  update: (id: string, data: Record<string, unknown>) =>
    api(`/meter-drafts/${id}`, { method: 'PUT', body: data }),
  delete: (id: string) => api(`/meter-drafts/${id}`, { method: 'DELETE' }),
  generate: (building: string, cycle: string) =>
    api('/meter-drafts/generate', { method: 'POST', body: { building, cycle } }),
  batchUpdate: (drafts: Record<string, unknown>[]) =>
    api('/meter-drafts/batch', { method: 'POST', body: drafts }),
  sync: (building: string, cycle: string) =>
    api('/meter-drafts/sync', { method: 'POST', body: { building, cycle } }),
};

// Utility Bills API - 水电费盈亏对比
export const utilityBillsApi = {
  list: (params?: { billType?: string; building?: string; status?: string; period?: string }) => {
    const query = new URLSearchParams();
    if (params?.billType) query.set('billType', params.billType);
    if (params?.building) query.set('building', params.building);
    if (params?.status) query.set('status', params.status);
    if (params?.period) query.set('period', params.period);
    return api(`/utility-bills?${query}`);
  },
  get: (id: string) => api(`/utility-bills/${id}`),
  create: (data: Record<string, unknown>) => api('/utility-bills', { method: 'POST', body: data }),
  createWithItems: (bill: Record<string, unknown>, items: Record<string, unknown>[]) =>
    api('/utility-bills/with-items', { method: 'POST', body: { bill, items } }),
  update: (id: string, data: Record<string, unknown>) =>
    api(`/utility-bills/${id}`, { method: 'PUT', body: data }),
  delete: (id: string) => api(`/utility-bills/${id}`, { method: 'DELETE' }),
  profitLoss: (period: string) => api(`/utility-bills/profit-loss/${period}`),
};

// Message Logs API
export const messageLogsApi = {
  list: (params?: { recordId?: string; tenantId?: string; status?: string; page?: number; pageSize?: number }) => {
    const query = new URLSearchParams();
    if (params?.recordId) query.set('recordId', params.recordId);
    if (params?.tenantId) query.set('tenantId', params.tenantId);
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    return api(`/message-logs?${query}`);
  },
  get: (id: string) => api(`/message-logs/${id}`),
  create: (data: Record<string, unknown>) => api('/message-logs', { method: 'POST', body: data }),
  batchCreate: (logs: Record<string, unknown>[]) =>
    api('/message-logs/batch', { method: 'POST', body: { logs } }),
  delete: (id: string) => api(`/message-logs/${id}`, { method: 'DELETE' }),
};

// Reminders API
export const remindersApi = {
  list: (params?: { tenantId?: string; enabled?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.tenantId) query.set('tenantId', params.tenantId);
    if (params?.enabled !== undefined) query.set('enabled', String(params.enabled));
    return api(`/reminders?${query}`);
  },
  get: (id: string) => api(`/reminders/${id}`),
  create: (data: Record<string, unknown>) => api('/reminders', { method: 'POST', body: data }),
  update: (id: string, data: Record<string, unknown>) =>
    api(`/reminders/${id}`, { method: 'PUT', body: data }),
  delete: (id: string) => api(`/reminders/${id}`, { method: 'DELETE' }),
  upcoming: () => api('/reminders/upcoming'),
};

// Receipts API - 收據單管理
export const receiptsApi = {
  list: (params?: { building?: string; room?: string; cycle?: string }) => {
    const query = new URLSearchParams();
    if (params?.building) query.set('building', params.building);
    if (params?.room) query.set('room', params.room);
    if (params?.cycle) query.set('cycle', params.cycle);
    return api(`/receipts?${query}`);
  },
  get: (id: string) => api(`/receipts/${id}`),
  create: (data: Record<string, unknown>) => api('/receipts', { method: 'POST', body: data }),
  update: (id: string, data: Record<string, unknown>) =>
    api(`/receipts/${id}`, { method: 'PUT', body: data }),
  delete: (id: string) => api(`/receipts/${id}`, { method: 'DELETE' }),
  confirm: (id: string) => api(`/receipts/${id}/confirm`, { method: 'POST', body: {} }),
  generate: (recordId: string) => api('/receipts/generate', { method: 'POST', body: { recordId } }),
};

// Reports API
export const reportsApi = {
  getIncome: (year?: number) => api(`/reports/income${year ? `?year=${year}` : ''}`),
  getOccupancy: (year?: number) => api(`/reports/occupancy${year ? `?year=${year}` : ''}`),
  getTenants: () => api('/reports/tenants'),
  getWorkOrders: (year?: number) => api(`/reports/workorders${year ? `?year=${year}` : ''}`),
};

// WeChat Bot API - 微信 Bot
export const wechatApi = {
  status: () => api('/wechat/status'),
  init: () => api('/wechat/init', { method: 'POST', body: {} }),
  send: (data: { chatId: string; content: string; recordId?: string; tenantId?: string }) =>
    api('/wechat/send', { method: 'POST', body: data }),
  sendBill: (data: {
    chatId: string
    tenantName: string
    building: string
    room: string
    cycle: string
    rent: number
    electricCost: number
    waterCost: number
    total: number
    dueDate?: string
  }) => api('/wechat/send-bill', { method: 'POST', body: data }),
  sendReminder: (data: {
    chatId: string
    tenantName: string
    room: string
    cycle: string
    unpaid: number
    overdueDays: number
  }) => api('/wechat/send-reminder', { method: 'POST', body: data }),
};
