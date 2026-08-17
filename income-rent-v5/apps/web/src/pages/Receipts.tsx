// Receipts (收据单) page - rent8 兼容
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { receiptsApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  Receipt, Plus, Search, Filter, CheckCircle2, Clock, AlertCircle,
  Pencil, Trash2, X, Save, Eye, FileText, DollarSign, Droplets, Zap,
  Printer, Share2
} from 'lucide-react';

// ── Receipt Type ──
interface ReceiptType {
  id: string;
  recordId?: string;
  building?: string;
  room?: string;
  propertyId?: string;
  tenantId?: string;
  cycle?: string;
  startTime?: string;
  endTime?: string;
  meterReadingTime?: string;
  electricThisMonth?: number;
  electricLastMonth?: number;
  electricUsage?: number;
  electricPrice?: number;
  electricCost?: number;
  waterThisMonth?: number;
  waterLastMonth?: number;
  waterUsage?: number;
  waterPrice?: number;
  waterCost?: number;
  ratio?: number;
  rental?: number;
  deposit?: number;
  fees1?: number;
  fees2?: number;
  fees3?: number;
  fees4?: number;
  totalMoney?: number;
  note?: string;
  accountingDate?: string;
  paymentDate?: string;
  createdAt: string;
}

// ── Detail Modal ──
function ReceiptDetailModal({ receipt, onClose }: { receipt: ReceiptType; onClose: () => void }) {
  const fees: { name: string; amount: number }[] = [
    { name: '租金', amount: receipt.rental || 0 },
    ...(receipt.electricCost ? [{ name: '电费', amount: receipt.electricCost }] : []),
    ...(receipt.waterCost ? [{ name: '水费', amount: receipt.waterCost }] : []),
    ...(receipt.fees1 ? [{ name: '物业费', amount: receipt.fees1 }] : []),
    ...(receipt.fees2 ? [{ name: '网费', amount: receipt.fees2 }] : []),
    ...(receipt.fees3 ? [{ name: '垃圾费', amount: receipt.fees3 }] : []),
    ...(receipt.fees4 ? [{ name: '其他', amount: receipt.fees4 }] : []),
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">收据单详情</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="bg-primary/5 p-4 rounded-lg text-center">
            <h3 className="text-xl font-bold">房租收据</h3>
            <p className="text-muted-foreground">{receipt.building} - {receipt.room}</p>
            <p className="text-sm text-muted-foreground">{receipt.cycle}</p>
          </div>

          {/* Period */}
          <div className="bg-muted/30 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">账单周期</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">開始日期：</span>
                <span className="font-medium">{receipt.startTime || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">結束日期：</span>
                <span className="font-medium">{receipt.endTime || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">抄表时间：</span>
                <span className="font-medium">{receipt.meterReadingTime?.split('T')[0] || '-'}</span>
              </div>
            </div>
          </div>

          {/* Electric */}
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-600" />
              电费
            </h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">上月读数：</span>
                <span className="font-medium">{receipt.electricLastMonth || 0}</span>
              </div>
              <div>
                <span className="text-muted-foreground">本月读数：</span>
                <span className="font-medium">{receipt.electricThisMonth || 0}</span>
              </div>
              <div>
                <span className="text-muted-foreground">用量：</span>
                <span className="font-medium">{receipt.electricUsage || 0} 度</span>
              </div>
              <div>
                <span className="text-muted-foreground">单价：</span>
                <span className="font-medium">¥{receipt.electricPrice || 0}</span>
              </div>
              <div>
                <span className="text-muted-foreground">倍率：</span>
                <span className="font-medium">{receipt.ratio || 1}</span>
              </div>
              <div>
                <span className="text-muted-foreground">电费：</span>
                <span className="font-medium text-yellow-600">¥{receipt.electricCost?.toFixed(2) || '0.00'}</span>
              </div>
            </div>
          </div>

          {/* Water */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Droplets className="h-4 w-4 text-blue-600" />
              水费
            </h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">上月读数：</span>
                <span className="font-medium">{receipt.waterLastMonth || 0}</span>
              </div>
              <div>
                <span className="text-muted-foreground">本月读数：</span>
                <span className="font-medium">{receipt.waterThisMonth || 0}</span>
              </div>
              <div>
                <span className="text-muted-foreground">用量：</span>
                <span className="font-medium">{receipt.waterUsage || 0} 方</span>
              </div>
              <div>
                <span className="text-muted-foreground">单价：</span>
                <span className="font-medium">¥{receipt.waterPrice || 0}</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">水费：</span>
                <span className="font-medium text-blue-600">¥{receipt.waterCost?.toFixed(2) || '0.00'}</span>
              </div>
            </div>
          </div>

          {/* Fees Summary */}
          <div className="bg-muted/30 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">费用明细</h4>
            <div className="space-y-2">
              {fees.map((fee, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>{fee.name}</span>
                  <span>¥{fee.amount.toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                <span>總計</span>
                <span className="text-primary">¥{receipt.totalMoney?.toFixed(2) || '0.00'}</span>
              </div>
            </div>
          </div>

          {/* Payment Status */}
          <div className={`p-4 rounded-lg ${receipt.accountingDate ? 'bg-green-50' : 'bg-orange-50'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {receipt.accountingDate ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="text-green-600 font-medium">已收款</span>
                  </>
                ) : (
                  <>
                    <Clock className="h-5 w-5 text-orange-600" />
                    <span className="text-orange-600 font-medium">未收款</span>
                  </>
                )}
              </div>
              {receipt.accountingDate && (
                <span className="text-sm text-muted-foreground">
                  到账日期：{receipt.accountingDate.split('T')[0]}
                </span>
              )}
            </div>
          </div>

          {/* Note */}
          {receipt.note && (
            <div className="bg-muted/30 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">备注</h4>
              <p className="text-sm text-muted-foreground">{receipt.note}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" />
              打印
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              分享
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Create/Edit Modal ──
function ReceiptFormModal({ receipt, onClose }: { receipt?: ReceiptType; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    building: receipt?.building || '',
    room: receipt?.room || '',
    cycle: receipt?.cycle || new Date().toISOString().slice(0, 7),
    startTime: receipt?.startTime || '',
    endTime: receipt?.endTime || '',
    electricThisMonth: receipt?.electricThisMonth || 0,
    electricLastMonth: receipt?.electricLastMonth || 0,
    electricPrice: receipt?.electricPrice || 1.0,
    waterThisMonth: receipt?.waterThisMonth || 0,
    waterLastMonth: receipt?.waterLastMonth || 0,
    waterPrice: receipt?.waterPrice || 5.0,
    ratio: receipt?.ratio || 1,
    rental: receipt?.rental || 0,
    deposit: receipt?.deposit || 0,
    fees1: receipt?.fees1 || 0,
    fees2: receipt?.fees2 || 0,
    fees3: receipt?.fees3 || 0,
    fees4: receipt?.fees4 || 0,
    note: receipt?.note || '',
  });

  const createMutation = useMutation({
    mutationFn: () => receiptsApi.create(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => receiptsApi.update(receipt!.id, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      onClose();
    },
  });

  // Auto-calculate
  const electricUsage = form.electricThisMonth - form.electricLastMonth;
  const electricCost = electricUsage * form.electricPrice * form.ratio;
  const waterUsage = form.waterThisMonth - form.waterLastMonth;
  const waterCost = waterUsage * form.waterPrice * form.ratio;
  const totalMoney = form.rental + form.deposit + electricCost + waterCost + form.fees1 + form.fees2 + form.fees3 + form.fees4;

  const handleSubmit = () => {
    if (receipt) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{receipt ? '编辑收据单' : '新增收据单'}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">樓棟</label>
              <Input value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">房間</label>
              <Input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">账单月份</label>
              <Input type="month" value={form.cycle} onChange={(e) => setForm({ ...form, cycle: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">水電倍率</label>
              <Input type="number" value={form.ratio} onChange={(e) => setForm({ ...form, ratio: parseFloat(e.target.value) || 1 })} />
            </div>
          </div>

          {/* Electric */}
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-600" />
              电费
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">上月读数</label>
                <Input type="number" value={form.electricLastMonth} onChange={(e) => setForm({ ...form, electricLastMonth: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-sm font-medium">本月读数</label>
                <Input type="number" value={form.electricThisMonth} onChange={(e) => setForm({ ...form, electricThisMonth: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-sm font-medium">单价</label>
                <Input type="number" step="0.01" value={form.electricPrice} onChange={(e) => setForm({ ...form, electricPrice: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              用量：{electricUsage} 度 | 电费：¥{electricCost.toFixed(2)}
            </div>
          </div>

          {/* Water */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Droplets className="h-4 w-4 text-blue-600" />
              水费
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">上月读数</label>
                <Input type="number" value={form.waterLastMonth} onChange={(e) => setForm({ ...form, waterLastMonth: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-sm font-medium">本月读数</label>
                <Input type="number" value={form.waterThisMonth} onChange={(e) => setForm({ ...form, waterThisMonth: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-sm font-medium">单价</label>
                <Input type="number" step="0.01" value={form.waterPrice} onChange={(e) => setForm({ ...form, waterPrice: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              用量：{waterUsage} 方 | 水费：¥{waterCost.toFixed(2)}
            </div>
          </div>

          {/* Fees */}
          <div className="bg-muted/30 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">其他费用</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">租金</label>
                <Input type="number" value={form.rental} onChange={(e) => setForm({ ...form, rental: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-sm font-medium">押金</label>
                <Input type="number" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-sm font-medium">物业费</label>
                <Input type="number" value={form.fees1} onChange={(e) => setForm({ ...form, fees1: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-sm font-medium">网费</label>
                <Input type="number" value={form.fees2} onChange={(e) => setForm({ ...form, fees2: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-sm font-medium">垃圾费</label>
                <Input type="number" value={form.fees3} onChange={(e) => setForm({ ...form, fees3: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-sm font-medium">其他</label>
                <Input type="number" value={form.fees4} onChange={(e) => setForm({ ...form, fees4: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
          </div>

          {/* Total */}
          <div className="bg-primary/10 p-4 rounded-lg flex justify-between items-center">
            <span className="font-semibold">總計</span>
            <span className="text-2xl font-bold text-primary">¥{totalMoney.toFixed(2)}</span>
          </div>

          {/* Note */}
          <div>
            <label className="text-sm font-medium">备注</label>
            <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {receipt ? '更新' : '創建'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──
export function ReceiptsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptType | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<ReceiptType | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ['receipts'],
    queryFn: () => receiptsApi.list(),
  });

  const receipts: ReceiptType[] = data?.data || [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => receiptsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => receiptsApi.confirm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
    },
  });

  const filteredReceipts = receipts.filter((r: ReceiptType) =>
    (r.building || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.room || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.cycle || '').includes(search)
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">收据单管理</h1>
          <p className="text-muted-foreground">管理租户收据单，记录抄表数据和费用明细</p>
        </div>
        <Button onClick={() => { setEditingReceipt(undefined); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          新增收据单
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索楼栋、房间或月份..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-4 font-medium">楼栋/房间</th>
                  <th className="text-left p-4 font-medium">账单月份</th>
                  <th className="text-right p-4 font-medium">电费</th>
                  <th className="text-right p-4 font-medium">水费</th>
                  <th className="text-right p-4 font-medium">租金</th>
                  <th className="text-right p-4 font-medium">总计</th>
                  <th className="text-center p-4 font-medium">状态</th>
                  <th className="text-right p-4 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} className="text-center p-8">加载中...</td></tr>
                ) : filteredReceipts.length === 0 ? (
                  <tr><td colSpan={8} className="text-center p-8 text-muted-foreground">暂无数据</td></tr>
                ) : (
                  filteredReceipts.map((receipt: ReceiptType) => (
                    <tr key={receipt.id} className="border-t hover:bg-muted/30">
                      <td className="p-4">
                        <div className="font-medium">{receipt.building || '-'}</div>
                        <div className="text-sm text-muted-foreground">{receipt.room || '-'}</div>
                      </td>
                      <td className="p-4">{receipt.cycle || '-'}</td>
                      <td className="p-4 text-right">¥{receipt.electricCost?.toFixed(2) || '0.00'}</td>
                      <td className="p-4 text-right">¥{receipt.waterCost?.toFixed(2) || '0.00'}</td>
                      <td className="p-4 text-right">¥{receipt.rental?.toFixed(2) || '0.00'}</td>
                      <td className="p-4 text-right font-bold">¥{receipt.totalMoney?.toFixed(2) || '0.00'}</td>
                      <td className="p-4 text-center">
                        {receipt.accountingDate ? (
                          <Badge variant="success" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            已收款
                          </Badge>
                        ) : (
                          <Badge variant="warning" className="gap-1">
                            <Clock className="h-3 w-3" />
                            未收款
                          </Badge>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedReceipt(receipt)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setEditingReceipt(receipt); setShowForm(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {!receipt.accountingDate && (
                            <Button variant="ghost" size="sm" onClick={() => confirmMutation.mutate(receipt.id)}>
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(receipt.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Modal */}
      {selectedReceipt && (
        <ReceiptDetailModal receipt={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
      )}

      {/* Form Modal */}
      {showForm && (
        <ReceiptFormModal receipt={editingReceipt} onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}
