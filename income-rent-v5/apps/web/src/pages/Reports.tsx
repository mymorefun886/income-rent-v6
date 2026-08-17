// Reports page - 报表中心
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { FileText, Download, TrendingUp, TrendingDown, Users, Wrench } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function ReportsPage() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<'income' | 'occupancy' | 'tenants' | 'workorders'>('income');

  const { data: incomeData, isLoading: incomeLoading } = useQuery({
    queryKey: ['reports-income', selectedYear],
    queryFn: () => reportsApi.getIncomeStatement({ year: selectedYear }),
  });

  const { data: occupancyData, isLoading: occupancyLoading } = useQuery({
    queryKey: ['reports-occupancy'],
    queryFn: () => reportsApi.getOccupancy(),
  });

  const { data: tenantBalance, isLoading: tenantLoading } = useQuery({
    queryKey: ['reports-tenant-balance'],
    queryFn: () => reportsApi.getTenantBalance(),
  });

  const { data: workOrderSummary, isLoading: woLoading } = useQuery({
    queryKey: ['reports-work-order-summary'],
    queryFn: () => reportsApi.getWorkOrderSummary(),
  });

  const handleExport = async () => {
    const data = await reportsApi.exportData('all', selectedYear);
    if (data.success) {
      // 创建并下载 JSON 文件
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${selectedYear}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const tabs = [
    { id: 'income', label: '收支报表', icon: TrendingUp },
    { id: 'occupancy', label: '出租率', icon: Users },
    { id: 'tenants', label: '租客余额', icon: Users },
    { id: 'workorders', label: '工单统计', icon: Wrench },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">报表中心</h1>
        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 border rounded-md bg-background"
          >
            {[2024, 2025, 2026].map((y) => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
          <Button onClick={handleExport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'default' : 'ghost'}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
            >
              <Icon className="h-4 w-4 mr-2" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {/* Income Statement Tab */}
      {activeTab === 'income' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          {!incomeLoading && incomeData?.data?.summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">年度收入</p>
                  <p className="text-xl font-bold text-green-600">
                    {formatCurrency(incomeData.data.summary.totalIncome)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">年度支出</p>
                  <p className="text-xl font-bold text-red-600">
                    {formatCurrency(incomeData.data.summary.totalExpense)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">年度净收入</p>
                  <p className="text-xl font-bold text-blue-600">
                    {formatCurrency(incomeData.data.summary.totalNet)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">年度应收</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(incomeData.data.summary.totalReceivable)}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Monthly Chart */}
          <Card>
            <CardHeader>
              <CardTitle>月度收支对比</CardTitle>
            </CardHeader>
            <CardContent>
              {incomeLoading ? (
                <div className="h-64 animate-pulse bg-muted rounded" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={incomeData?.data?.monthly || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tickFormatter={(v) => v.split('-')[1] + '月'} />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="income" name="收入" fill="#10b981" />
                    <Bar dataKey="expense" name="支出" fill="#ef4444" />
                    <Bar dataKey="receivable" name="应收" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Occupancy Tab */}
      {activeTab === 'occupancy' && (
        <div className="space-y-6">
          {!occupancyLoading && occupancyData?.data && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">总房源</p>
                    <p className="text-2xl font-bold">{occupancyData.data.totalProperties}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">已出租</p>
                    <p className="text-2xl font-bold text-green-600">{occupancyData.data.occupiedProperties}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">空置</p>
                    <p className="text-2xl font-bold text-orange-600">{occupancyData.data.vacantProperties}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">出租率</p>
                    <p className="text-2xl font-bold text-blue-600">{occupancyData.data.occupancyRate}%</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>房源明细</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-medium">房源</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">地址</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">状态</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">月租</th>
                        </tr>
                      </thead>
                      <tbody>
                        {occupancyData.data.properties.map((prop: { id: string; name: string; address?: string; occupied: boolean; totalRent: number }) => (
                          <tr key={prop.id} className="border-b">
                            <td className="px-4 py-2">{prop.name}</td>
                            <td className="px-4 py-2 text-muted-foreground">{prop.address || '-'}</td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                prop.occupied
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-orange-100 text-orange-700'
                              }`}>
                                {prop.occupied ? '已出租' : '空置'}
                              </span>
                            </td>
                            <td className="px-4 py-2">{prop.occupied ? formatCurrency(prop.totalRent) : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Tenant Balance Tab */}
      {activeTab === 'tenants' && (
        <div className="space-y-6">
          {!tenantLoading && tenantBalance?.data && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">欠费总额</p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrency(tenantBalance.data.totalDebt)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">预存总额</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(tenantBalance.data.totalCredit)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Debtors */}
              {tenantBalance.data.debtors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-red-600">欠费租客</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {tenantBalance.data.debtors.map((t: { id: string; name: string; balance: number; roomLabel?: string }) => (
                        <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{t.name}</p>
                            <p className="text-sm text-muted-foreground">{t.roomLabel || '-'}</p>
                          </div>
                          <p className="text-lg font-bold text-red-600">{formatCurrency(Math.abs(t.balance))}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* Work Orders Tab */}
      {activeTab === 'workorders' && (
        <div className="space-y-6">
          {!woLoading && workOrderSummary?.data && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">工单总数</p>
                    <p className="text-2xl font-bold">{workOrderSummary.data.total}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">待处理</p>
                    <p className="text-2xl font-bold text-blue-600">{workOrderSummary.data.byStatus.open}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">进行中</p>
                    <p className="text-2xl font-bold text-yellow-600">{workOrderSummary.data.byStatus.in_progress}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">已完成</p>
                    <p className="text-2xl font-bold text-green-600">{workOrderSummary.data.byStatus.completed}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* By Priority */}
                <Card>
                  <CardHeader>
                    <CardTitle>按优先级</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: '紧急', value: workOrderSummary.data.byPriority.urgent },
                            { name: '高', value: workOrderSummary.data.byPriority.high },
                            { name: '普通', value: workOrderSummary.data.byPriority.normal },
                            { name: '低', value: workOrderSummary.data.byPriority.low },
                          ].filter((d) => d.value > 0)}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label
                        >
                          {['紧急', '高', '普通', '低'].map((_, index) => (
                            <Cell key={`cell-${index}`} fill={['#ef4444', '#f59e0b', '#3b82f6', '#6b7280'][index]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Cost Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle>费用统计</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">预估总费用</span>
                      <span className="font-bold">{formatCurrency(workOrderSummary.data.totalEstimated)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">实际总费用</span>
                      <span className="font-bold">{formatCurrency(workOrderSummary.data.totalActual)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-muted-foreground">差异</span>
                      <span className={`font-bold ${workOrderSummary.data.variance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(workOrderSummary.data.variance)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-muted-foreground">关联支出</span>
                      <span className="font-bold">{formatCurrency(workOrderSummary.data.totalExpensesFromWO)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
