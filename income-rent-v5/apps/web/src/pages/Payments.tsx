// Payments page
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { paymentsApi, recordsApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Payment {
  id: string;
  recordId: string;
  tenantId?: string;
  amount: number;
  method: string;
  memo?: string;
  paidAt?: string;
}

interface Record {
  id: string;
  cycle: string;
  receivable: number;
  tenant?: { name: string };
}

const METHOD_LABELS: Record<string, string> = {
  cash: '现金',
  transfer: '转账',
  wechat: '微信',
  alipay: '支付宝',
  fps: 'FPS',
};

export function PaymentsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const queryClient = useQueryClient();

  const { data: payments, isLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: () => paymentsApi.list({ limit: 100 }),
  });

  const { data: records } = useQuery({
    queryKey: ['records-for-payment'],
    queryFn: () => recordsApi.list({ status: 'unpaid' }),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => paymentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['records'] });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: function (params: { id: string; data: Record<string, unknown> }) {
      return paymentsApi.update(params.id, params.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setEditingPayment(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => paymentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      recordId: formData.get('recordId'),
      amount: Number(formData.get('amount')),
      method: formData.get('method'),
      memo: formData.get('memo') || undefined,
      paidAt: formData.get('paidAt') || undefined,
    };

    if (editingPayment) {
      updateMutation.mutate({ id: editingPayment.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">收款记录</h1>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新增收款
        </Button>
      </div>

      {/* Form */}
      {(showForm || editingPayment) && (
        <Card>
          <CardHeader>
            <CardTitle>{editingPayment ? '编辑收款' : '新增收款'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">账单</label>
                  <select
                    name="recordId"
                    required
                    defaultValue={editingPayment?.recordId}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    disabled={!!editingPayment}
                  >
                    <option value="">选择账单</option>
                    {records?.data?.items?.map((r: Record) => (
                      <option key={r.id} value={r.id}>
                        {r.tenant?.name || '-'} - {r.cycle} - {formatCurrency(r.receivable)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">金额</label>
                  <input
                    name="amount"
                    type="number"
                    required
                    defaultValue={editingPayment?.amount}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">付款方式</label>
                  <select
                    name="method"
                    required
                    defaultValue={editingPayment?.method || 'transfer'}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  >
                    <option value="cash">现金</option>
                    <option value="transfer">转账</option>
                    <option value="wechat">微信</option>
                    <option value="alipay">支付宝</option>
                    <option value="fps">FPS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">付款日期</label>
                  <input
                    name="paidAt"
                    type="date"
                    defaultValue={editingPayment?.paidAt}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">备注</label>
                  <input
                    name="memo"
                    type="text"
                    defaultValue={editingPayment?.memo}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingPayment ? '更新' : '创建'}
                </Button>
                <Button type="button" variant="outline" onClick={() => {
                  setShowForm(false);
                  setEditingPayment(null);
                }}>
                  取消
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4">加载中...</div>
          ) : payments?.data?.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">暂无收款记录</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">日期</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">金额</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">方式</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">备注</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {payments?.data?.map((payment: Payment) => (
                    <tr key={payment.id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3">{formatDate(payment.paidAt)}</td>
                      <td className="px-4 py-3">{formatCurrency(payment.amount)}</td>
                      <td className="px-4 py-3">{METHOD_LABELS[payment.method] || payment.method}</td>
                      <td className="px-4 py-3">{payment.memo || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingPayment(payment)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm('确定删除此收款记录？')) {
                                deleteMutation.mutate(payment.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
