// Shared types

export type Role = 'admin' | 'manager' | 'staff' | 'viewer';

export interface User {
  id: string;
  username: string;
  role: Role;
  createdAt: Date;
  lastLogin?: Date;
}

export interface Property {
  id: string;
  name: string;
  address?: string;
  areaSqm?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tenant {
  id: string;
  name: string;
  phone?: string;
  idCard?: string;
  propertyId?: string;
  roomLabel?: string;
  depositAmount: number;
  leaseStart?: Date;
  leaseEnd?: Date;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Record {
  id: string;
  tenantId: string;
  cycle: string;
  receivable: number;
  received: number;
  status: 'unpaid' | 'partial' | 'paid';
  sentStatus: 'unsent' | 'sent';
  dueDate?: Date;
  paidAt?: Date;
  method?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Contract {
  id: string;
  tenantId: string;
  propertyId?: string;
  rent: number;
  deposit: number;
  payCycle: 'monthly' | 'quarterly' | 'yearly';
  startDate?: Date;
  endDate?: Date;
  status: 'active' | 'expired' | 'terminated';
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id: string;
  recordId: string;
  tenantId?: string;
  amount: number;
  method: string;
  memo?: string;
  paidAt?: Date;
  createdAt: Date;
}

export interface Expense {
  id: string;
  date: Date;
  period?: string;
  propertyId?: string;
  roomLabel?: string;
  category: string;
  amount: number;
  payee?: string;
  paymentMethod?: string;
  note?: string;
  workOrderId?: string;
  invoiceNo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkOrder {
  id: string;
  title: string;
  description?: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  propertyId?: string;
  roomLabel?: string;
  assignedTo?: string;
  costEstimate: number;
  amount: number;
  expenseId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DashboardStats {
  tenantCount: number;
  vacantCount: number;
  totalReceivable: number;
  totalReceived: number;
  unpaid: number;
  monthReceivable: number;
  monthExpenses: number;
  expiringContracts: number;
  openWorkOrders: number;
  occupancyRate: number;
}
