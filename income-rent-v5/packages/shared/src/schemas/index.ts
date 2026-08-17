// Shared Zod schemas for validation
import { z } from 'zod';

// ── User Schemas ──
export const loginSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '当前密码不能为空'),
  newPassword: z.string().min(6, '新密码至少 6 位'),
});

// ── Property Schemas ──
export const propertySchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  address: z.string().optional(),
  areaSqm: z.number().positive().optional(),
  notes: z.string().optional(),
});

// ── Tenant Schemas ──
export const tenantSchema = z.object({
  name: z.string().min(1, '姓名不能为空'),
  phone: z.string().optional(),
  idCard: z.string().optional(),
  propertyId: z.string().optional(),
  roomLabel: z.string().optional(),
  depositAmount: z.number().min(0).default(0),
  leaseStart: z.string().optional(),
  leaseEnd: z.string().optional(),
});

// ── Record Schemas ──
export const recordSchema = z.object({
  tenantId: z.string().min(1, '租客不能为空'),
  cycle: z.string().min(1, '账期不能为空'),
  receivable: z.number().min(0, '金额不能为负'),
  received: z.number().min(0).default(0),
  status: z.enum(['unpaid', 'partial', 'paid']).default('unpaid'),
  dueDate: z.string().optional(),
  method: z.string().optional(),
});

// ── Contract Schemas ──
export const contractSchema = z.object({
  tenantId: z.string().min(1, '租客不能为空'),
  propertyId: z.string().optional(),
  rent: z.number().min(0),
  deposit: z.number().min(0).default(0),
  payCycle: z.enum(['monthly', 'quarterly', 'yearly']).default('monthly'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().optional(),
});

// ── Expense Schemas ──
export const expenseSchema = z.object({
  date: z.string().min(1, '日期不能为空'),
  category: z.string().min(1, '分类不能为空'),
  amount: z.number().positive('金额必须大于 0'),
  propertyId: z.string().optional(),
  roomLabel: z.string().optional(),
  payee: z.string().optional(),
  paymentMethod: z.string().optional(),
  note: z.string().optional(),
  invoiceNo: z.string().optional(),
});

// ── Work Order Schemas ──
export const workOrderSchema = z.object({
  title: z.string().min(1, '标题不能为空'),
  description: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'completed', 'cancelled']).default('open'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  propertyId: z.string().optional(),
  roomLabel: z.string().optional(),
  assignedTo: z.string().optional(),
  costEstimate: z.number().min(0).default(0),
  amount: z.number().min(0).default(0),
});

// ── Export Types ──
export type LoginInput = z.infer<typeof loginSchema>;
export type PropertyInput = z.infer<typeof propertySchema>;
export type TenantInput = z.infer<typeof tenantSchema>;
export type RecordInput = z.infer<typeof recordSchema>;
export type ContractInput = z.infer<typeof contractSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type WorkOrderInput = z.infer<typeof workOrderSchema>;
