// Contracts page
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, AlertCircle, RefreshCw, FileText } from 'lucide-react';
import { contractsApi, tenantsApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Contract {
  id: string;
  tenantId: string;
  tenant?: { name: string };
  propertyId?: string;
  rent: number;
  deposit: number;
  payCycle: string;
  startDate?: string;
  endDate?: string;
  status: string;
  notes?: string;
}

interface Tenant {
  id: string;
  name: string;
}

const PAY_CYCLE_LABELS: Record<string, string> = {
  monthly: '月付',
  quarterly: '季付',
  yearly: '年付',
};

const STATUS_LABELS: Record<string, string> = {
  active: '生效',
  expired: '过期',
  terminated: '终止',
};

export function ContractsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const queryClient = useQueryClient();

  const { data: contracts, isLoading } = useQuery({
    queryKey: ['contracts', statusFilter],
    queryFn: () => contractsApi.list(statusFilter ? { status: statusFilter } : undefined),
  });

  const { data: tenants } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => tenantsApi.list(),
  });

  const { data: reminders } = useQuery({
    queryKey: ['contract-reminders'],
    queryFn: () => contractsApi.reminders(),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => contractsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: function (params: { id: string; data: Record<string, unknown> }) {
      return contractsApi.update(params.id, params.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      setEditingContract(null);
    },
  });

  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [generatePeriod, setGeneratePeriod] = useState(
    new Date().toISOString().slice(0, 7)
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contractsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
  });

  const renewMutation = useMutation({
    mutationFn: function (params: { id: string; data: { endDate?: string; rent?: number; notes?: string } }) {
      return contractsApi.renew(params.id, params.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
  });

  const generateRecordsMutation = useMutation({
    mutationFn: (period: string) => contractsApi.autoGenerateRecords(period),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['records'] });
      alert(data.message || '生成成功');
      setShowGenerateForm(false);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      tenantId: formData.get('tenantId'),
      rent: Number(formData.get('rent')),
      deposit: Number(formData.get('deposit')) || 0,
      payCycle: formData.get('payCycle'),
      startDate: formData.get('startDate') || undefined,
      endDate: formData.get('endDate') || undefined,
      notes: formData.get('notes') || undefined,
      status: formData.get('status') || 'active',
    };

    if (editingContract) {
      updateMutation.mutate({ id: editingContract.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">合同管理</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowGenerateForm(true)}>
            <FileText className="h-4 w-4 mr-2" />
            生成账单
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            新增合同
          </Button>
        </div>
      </div>

      {/* Generate Records Modal */}
      {showGenerateForm && (
        <Card className="border-blue-500 bg-blue-50 dark:bg-blue-900/20">
          <CardHeader>
            <CardTitle className="text-blue-700 dark:text-blue-400">自动生成账单</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              系统将根据所有生效合同自动生成指定账期的账单
            </p>
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">账期</label>
                <input
                  type="month"
                  value={generatePeriod}
                  onChange={(e) => setGeneratePeriod(e.target.value)}
                  className="px-3 py-2 border rounded-md bg-background"
                />
              </div>
              <div className="flex gap-2 mt-6">
                <Button
                  onClick={() => generateRecordsMutation.mutate(generatePeriod)}
                  disabled={generateRecordsMutation.isPending}
                >
                  {generateRecordsMutation.isPending ? '生成中...' : '确认生成'}
                </Button>
                <Button variant="outline" onClick={() => setShowGenerateForm(false)}>
                  取消
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reminders */}
      {reminders?.data && reminders.data.length > 0 && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
              <AlertCircle className="h-5 w-5" />
              合同到期提醒
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {reminders.data.map((r: { contractId: string; tenantName: string; daysLeft: number; level: string }) => (
                <li key={r.contractId} className={r.level === 'critical' ? 'text-red-600' : 'text-yellow-600'}>
                  {r.tenantName} - 还剩 {r.daysLeft} 天到期
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-md bg-background"
        >
          <option value="">全部状态</option>
          <option value="active">生效</option>
          <option value="expired">过期</option>
          <option value="terminated">终止</option>
        </select>
      </div>

      {/* Form */}
      {(showForm || editingContract) && (
        <Card>
          <CardHeader>
            <CardTitle>{editingContract ? '编辑合同' : '新增合同'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">租客</label>
                  <select
                    name="tenantId"
                    required
                    defaultValue={editingContract?.tenantId}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  >
                    <option value="">选择租客</option>
                    {tenants?.data?.map((t: Tenant) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">租金</label>
                  <input
                    name="rent"
                    type="number"
                    required
                    defaultValue={editingContract?.rent}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">押金</label>
                  <input
                    name="deposit"
                    type="number"
                    defaultValue={editingContract?.deposit || 0}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">付款周期</label>
                  <select
                    name="payCycle"
                    required
                    defaultValue={editingContract?.payCycle || 'monthly'}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  >
                    <option value="monthly">月付</option>
                    <option value="quarterly">季付</option>
                    <option value="yearly">年付</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">开始日期</label>
                  <input
                    name="startDate"
                    type="date"
                    defaultValue={editingContract?.startDate}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">结束日期</label>
                  <input
                    name="endDate"
                    type="date"
                    defaultValue={editingContract?.endDate}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">状态</label>
                  <select
                    name="status"
                    required
                    defaultValue={editingContract?.status || 'active'}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  >
                    <option value="active">生效</option>
                    <option value="expired">过期</option>
                    <option value="terminated">终止</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">备注</label>
                  <input
                    name="notes"
                    type="text"
                    defaultValue={editingContract?.notes}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingContract ? '更新' : '创建'}
                </Button>
                <Button type="button" variant="outline" onClick={() => {
                  setShowForm(false);
                  setEditingContract(null);
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
          ) : contracts?.data?.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">暂无合同</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">租客</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">租金</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">押金</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">周期</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">开始日期</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">结束日期</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts?.data?.map((contract: Contract) => (
                    <tr key={contract.id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3">{contract.tenant?.name || '-'}</td>
                      <td className="px-4 py-3">{formatCurrency(contract.rent)}</td>
                      <td className="px-4 py-3">{formatCurrency(contract.deposit)}</td>
                      <td className="px-4 py-3">{PAY_CYCLE_LABELS[contract.payCycle] || contract.payCycle}</td>
                      <td className="px-4 py-3">{formatDate(contract.startDate)}</td>
                      <td className="px-4 py-3">{formatDate(contract.endDate)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          contract.status === 'active'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : contract.status === 'expired'
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        }`}>
                          {STATUS_LABELS[contract.status] || contract.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {contract.status === 'active' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              title="续签"
                              onClick={() => {
                                if (confirm('确定续签此合同？将创建新合同并标记旧合同为过期。')) {
                                  renewMutation.mutate({ id: contract.id, data: {} });
                                }
                              }}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            title="编辑"
                            onClick={() => setEditingContract(contract)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="删除"
                            onClick={() => {
                              if (confirm('确定删除此合同？')) {
                                deleteMutation.mutate(contract.id);
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
