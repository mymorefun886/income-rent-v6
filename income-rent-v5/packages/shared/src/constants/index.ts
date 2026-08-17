// Shared constants

export const APP_NAME = '收租佬系统';
export const APP_VERSION = '5.0.0';

export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  STAFF: 'staff',
  VIEWER: 'viewer',
} as const;

export const ROLE_LABELS: Record<string, string> = {
  admin: '管理员',
  manager: '经理',
  staff: '员工',
  viewer: '只读',
};

export const RECORD_STATUS = {
  UNPAID: 'unpaid',
  PARTIAL: 'partial',
  PAID: 'paid',
} as const;

export const RECORD_STATUS_LABELS: Record<string, string> = {
  unpaid: '未收',
  partial: '部分',
  paid: '已收',
};

export const CONTRACT_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  TERMINATED: 'terminated',
} as const;

export const PAYMENT_METHODS = ['cash', 'transfer', 'wechat', 'alipay', 'fps'] as const;
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: '现金',
  transfer: '转账',
  wechat: '微信',
  alipay: '支付宝',
  fps: '转数快',
};

export const EXPENSE_CATEGORIES = [
  '维修',
  '水电',
  '清洁',
  '装修',
  '税费',
  '保险',
  '其他',
] as const;

export const WORK_ORDER_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const WORK_ORDER_STATUS_LABELS: Record<string, string> = {
  open: '待处理',
  in_progress: '处理中',
  completed: '已完成',
  cancelled: '已取消',
};

export const WORK_ORDER_PRIORITY = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export const WORK_ORDER_PRIORITY_LABELS: Record<string, string> = {
  low: '低',
  normal: '中',
  high: '高',
  urgent: '紧急',
};

export const PAY_CYCLES = {
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly',
} as const;

export const PAY_CYCLE_LABELS: Record<string, string> = {
  monthly: '月付',
  quarterly: '季付',
  yearly: '年付',
};
