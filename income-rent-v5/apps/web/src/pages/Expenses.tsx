// Expenses page - 支出管理（不含水电费，水电费统一在「水电费盈亏」模块管理）
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Building2, MapPin } from 'lucide-react';
import { expensesApi, propertiesApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Expense {
  id: string;
  date: string;
  period: string;
  category: string;
  amount: number;
  payee?: string;
  paymentMethod?: string;
  note?: string;
  propertyId?: string;
  propertyLabel?: string;
  room?: string;
  workOrderId?: string;
}

// 支出类别（不含水电费）
const CATEGORIES = [
  '电费', '水费', '维修', '清洁', '燃气', '网络', '管理费',
  '保险', '税费', '装修', '家具', '其他',
];

// 楼栋选项
interface BuildingOption {
  id: string;
  label: string;
  rooms: string[];
}

export function ExpensesPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const queryClient = useQueryClient();

  // 获取支出列表
  const { data: expenses, isLoading } = useQuery({
    queryKey: ['expenses', categoryFilter],
    queryFn: () => expensesApi.list(categoryFilter ? { category: categoryFilter } : undefined),
  });

  // 获取楼栋列表（用于下拉选择）
  const { data: buildingsData } = useQuery({
    queryKey: ['buildings-for-expense'],
    queryFn: async () => {
      const res = await propertiesApi.list({ status: '' });
      const properties = res?.data?.items || [];
      // 按楼栋分组
      const buildingMap: Record<string, BuildingOption> = {};
      properties.forEach((p: { id: string; building: string; room: string; title: string }) => {
        if (!p.building) return;
        if (!buildingMap[p.building]) {
          buildingMap[p.building] = {
            id: p.id,
            label: p.title || p.building,
            rooms: [],
          };
        }
        if (p.room && !buildingMap[p.building].rooms.includes(p.room)) {
          buildingMap[p.building].rooms.push(p.room);
        }
      });
      return Object.entries(buildingMap).map(([building, data]) => ({
        building,
        ...data,
      }));
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => expensesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: function (params: { id: string; data: Record<string, unknown> }) {
      return expensesApi.update(params.id, params.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setEditingExpense(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expensesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const propertyId = formData.get('propertyId') as string;
    const propertyLabel = formData.get('propertyLabel') as string;
    const room = formData.get('room') as string;
    const data = {
      date: formData.get('date'),
      category: formData.get('category'),
      amount: Number(formData.get('amount')),
      payee: formData.get('payee') || undefined,
      paymentMethod: formData.get('paymentMethod') || undefined,
      note: formData.get('note') || undefined,
      propertyId: propertyId || undefined,
      propertyLabel: propertyLabel || undefined,
      room: room || undefined,
    };

    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const totalAmount = expenses?.data?.items?.reduce((sum: number, e: Expense) => sum + e.amount, 0) || 0;

  // 获取选中楼栋的房间列表
  const selectedBuildingRooms = (() => {
    const formData = editingExpense || { propertyId: '' };
    const building = buildingsData?.find(b => b.id === formData.propertyId);
    return building?.rooms || [];
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">支出管理</h1>
          <p className="text-sm text-muted-foreground">
            总支出: {formatCurrency(totalAmount)}
          </p>
        </div>
        <Button onClick={() => { setEditingExpense(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          新增支出
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 border rounded-md bg-background"
        >
          <option value="">全部分类</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Form */}
      {(showForm || editingExpense) && (
        <Card>
          <CardHeader>
            <CardTitle>{editingExpense ? '编辑支出' : '新增支出'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 楼栋/房间选择 - 放在最前面 */}
              <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  关联房产（可选）
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">楼栋/房产</label>
                    <select
                      name="propertyId"
                      defaultValue={editingExpense?.propertyId || ''}
                      onChange={(e) => {
                        const selected = buildingsData?.find(b => b.id === e.target.value);
                        const labelInput = (e.target.form?.elements.namedItem('propertyLabel') as HTMLInputElement);
                        if (labelInput && selected) {
                          labelInput.value = selected.label;
                        }
                      }}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    >
                      <option value="">选择楼栋/房产</option>
                      {buildingsData?.map((b) => (
                        <option key={b.id} value={b.id}>{b.label}</option>
                      ))}
                    </select>
                    <input type="hidden" name="propertyLabel" defaultValue={editingExpense?.propertyLabel || ''} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">房间（可选）</label>
                    <input
                      name="room"
                      type="text"
                      placeholder="如: 104"
                      defaultValue={editingExpense?.room || ''}
                      list="room-options"
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    />
                    <datalist id="room-options">
                      {selectedBuildingRooms.map(r => (
                        <option key={r} value={r} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>

              {/* 基本信息 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">日期</label>
                  <input
                    name="date"
                    type="date"
                    required
                    defaultValue={editingExpense?.date || new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">分类</label>
                  <select
                    name="category"
                    required
                    defaultValue={editingExpense?.category}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  >
                    <option value="">选择分类</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">金额</label>
                  <input
                    name="amount"
                    type="number"
                    required
                    defaultValue={editingExpense?.amount}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">收款方</label>
                  <input
                    name="payee"
                    type="text"
                    defaultValue={editingExpense?.payee}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">付款方式</label>
                  <input
                    name="paymentMethod"
                    type="text"
                    defaultValue={editingExpense?.paymentMethod}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">备注</label>
                  <input
                    name="note"
                    type="text"
                    defaultValue={editingExpense?.note}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingExpense ? '更新' : '创建'}
                </Button>
                <Button type="button" variant="outline" onClick={() => {
                  setShowForm(false);
                  setEditingExpense(null);
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
          ) : expenses?.data?.items?.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">暂无支出记录</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">日期</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">楼栋/房间</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">分类</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">金额</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">收款方</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">备注</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses?.data?.items?.map((expense: Expense) => (
                    <tr key={expense.id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3">{formatDate(expense.date)}</td>
                      <td className="px-4 py-3">
                        {expense.propertyLabel || expense.propertyId ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            <span>{expense.propertyLabel || expense.propertyId}</span>
                            {expense.room && (
                              <span className="text-muted-foreground"> - {expense.room}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded-full text-xs bg-muted">
                          {expense.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">{formatCurrency(expense.amount)}</td>
                      <td className="px-4 py-3">{expense.payee || '-'}</td>
                      <td className="px-4 py-3">{expense.note || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingExpense(expense)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm('确定删除此支出记录？')) {
                                deleteMutation.mutate(expense.id);
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
