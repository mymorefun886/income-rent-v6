// Records (Billing) page - V4 Complete
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recordsApi, wechatApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Checkbox } from '@/components/ui/Checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import { AlertDialog } from '@/components/ui/AlertDialog';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/stores/toast';
import {
  Receipt, Plus, Search, Filter, CheckCircle2, Clock, AlertCircle,
  Pencil, Trash2, X, Save, Send, DollarSign, Droplets, Zap,
  ChevronDown, ChevronUp, Eye, MessageCircle
} from 'lucide-react';

// ── Fee Item Type ──
interface FeeItem {
  name: string;
  amount: number;
}

// Helper: Sort rooms naturally (101, 102, 201, 301...), then by cycle descending
function sortRooms(records: Record[]): Record[] {
  return [...records].sort((a, b) => {
    // First: sort by room number
    const numA = parseInt(a.room?.match(/\d+/)?.[0] || '0');
    const numB = parseInt(b.room?.match(/\d+/)?.[0] || '0');
    if (numA !== numB) return numA - numB;

    // Same room: sort by cycle descending (newest first)
    if (a.cycle !== b.cycle) return (b.cycle || '').localeCompare(a.cycle || '');

    return (a.room || '').localeCompare(b.room || '');
  });
}

// ── Record Type ──
interface Record {
  id: string;
  tenantId?: string;
  tenantName?: string;
  building?: string;
  room?: string;
  roomNo?: string;
  cycle: string;
  rentPart: number;
  receivable: number;
  received: number;
  status: string;
  sentStatus: string;
  sentAt?: string;
  dueDate?: string;
  paidAt?: string;
  method?: string;
  note?: string;
  electricPrev?: string;
  electricNow?: string;
  electricUsage?: string;
  electricPrice?: string;
  electricCost?: number;
  waterPrev?: string;
  waterNow?: string;
  waterUsage?: string;
  waterPrice?: string;
  waterMinimumCharge?: string;
  waterCost?: number;
  noWaterMeter?: boolean;
  propertyFee?: string;
  networkFee?: string;
  garbageFee?: string;
  otherFee?: string;
  depositAdjustment?: string;
  depositAmount?: number;
  depositRefund?: number;
  depositDeduct?: number;
  checkout?: boolean;
  payments?: string;
}

// ── Detail Modal ──
function RecordDetailModal({ record, onClose }: { record: Record; onClose: () => void }) {
  const payments = record.payments ? JSON.parse(record.payments) : [];
  const fees: FeeItem[] = [
    { name: '租金', amount: record.rentPart || 0 },
    ...(record.electricCost ? [{ name: '电费', amount: record.electricCost }] : []),
    ...(record.waterCost ? [{ name: '水费', amount: record.waterCost }] : []),
    ...(record.propertyFee && parseFloat(record.propertyFee) > 0 ? [{ name: '物业费', amount: parseFloat(record.propertyFee) }] : []),
    ...(record.networkFee && parseFloat(record.networkFee) > 0 ? [{ name: '网费', amount: parseFloat(record.networkFee) }] : []),
    ...(record.garbageFee && parseFloat(record.garbageFee) > 0 ? [{ name: '垃圾费', amount: parseFloat(record.garbageFee) }] : []),
    ...(record.otherFee && parseFloat(record.otherFee) > 0 ? [{ name: '其他', amount: parseFloat(record.otherFee) }] : []),
  ];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>账单详情 - {record.cycle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tenant Info */}
          <div className="bg-muted/30 p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">租客：</span>
                <span className="font-medium">{record.tenantName || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">房间：</span>
                <span className="font-medium">{record.room || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">建筑：</span>
                <span>{record.building || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">到期日：</span>
                <span>{record.dueDate || '-'}</span>
              </div>
            </div>
          </div>

          {/* Fee Breakdown */}
          <div>
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              费用明细
            </h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left">項目</th>
                    <th className="px-3 py-2 text-right">金額</th>
                  </tr>
                </thead>
                <tbody>
                  {fees.map((fee, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2">{fee.name}</td>
                      <td className="px-3 py-2 text-right">¥{fee.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="border-t bg-muted/30 font-medium">
                    <td className="px-3 py-2">应收合計</td>
                    <td className="px-3 py-2 text-right">¥{record.receivable?.toFixed(2)}</td>
                  </tr>
                  <tr className="border-t">
                    <td className="px-3 py-2">已收</td>
                    <td className="px-3 py-2 text-right text-green-600">¥{record.received?.toFixed(2)}</td>
                  </tr>
                  <tr className="border-t">
                    <td className="px-3 py-2">未收</td>
                    <td className="px-3 py-2 text-right text-red-600">
                      ¥{((record.receivable || 0) - (record.received || 0)).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Meter Readings */}
          <div className="grid grid-cols-2 gap-4">
            <div className="border rounded-lg p-3">
              <h4 className="font-medium mb-2 flex items-center gap-2 text-yellow-600">
                <Zap className="h-4 w-4" />
                电表
              </h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">上月：</span>
                  <span>{record.electricPrev || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">本月：</span>
                  <span>{record.electricNow || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">用量：</span>
                  <span>{record.electricUsage || '-'} 度</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">單價：</span>
                  <span>¥{record.electricPrice || '0.8'}/度</span>
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-3">
              <h4 className="font-medium mb-2 flex items-center gap-2 text-blue-600">
                <Droplets className="h-4 w-4" />
                水表
              </h4>
              <div className="text-sm space-y-1">
                {record.noWaterMeter ? (
                  <div className="text-muted-foreground">无水表</div>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">上月：</span>
                      <span>{record.waterPrev || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">本月：</span>
                      <span>{record.waterNow || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">用量：</span>
                      <span>{record.waterUsage || '-'} 噸</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">單價：</span>
                      <span>¥{record.waterPrice || '5.5'}/噸</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Payments */}
          {payments.length > 0 && (
            <div>
              <h3 className="font-medium mb-2">收款记录</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left">日期</th>
                      <th className="px-3 py-2 text-left">方式</th>
                      <th className="px-3 py-2 text-right">金額</th>
                      <th className="px-3 py-2 text-left">备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((pay: any, i: number) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2">{pay.paidAt}</td>
                        <td className="px-3 py-2">{pay.method}</td>
                        <td className="px-3 py-2 text-right">¥{pay.amount?.toFixed(2)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{pay.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Status */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">状态：</span>
                <Badge variant={
                  record.status === '已收' ? 'success' :
                  record.status === '部分收款' ? 'warning' : 'destructive'
                }>
                  {record.status}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">发送：</span>
                <Badge variant={record.sentStatus === 'sent' ? 'success' : 'outline'}>
                  {record.sentStatus === 'sent' ? '已发送' : '未发送'}
                </Badge>
              </div>
            </div>
            {record.note && (
              <div className="text-sm text-muted-foreground">
                备注：{record.note}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Modal ──
function RecordEditModal({ record, onClose, onSave }: { record: Record; onClose: () => void; onSave: (data: any) => void }) {
  const [formData, setFormData] = useState({
    tenantName: record.tenantName || '',
    building: record.building || '',
    room: record.room || '',
    cycle: record.cycle || '',
    rentPart: record.rentPart || 0,
    receivable: record.receivable || 0,
    received: record.received || 0,
    status: record.status || '未收',
    dueDate: record.dueDate || '',
    paidAt: record.paidAt || '',
    method: record.method || '微信',
    note: record.note || '',
    // Electric
    electricPrev: record.electricPrev || '',
    electricNow: record.electricNow || '',
    electricPrice: record.electricPrice || '0.8',
    // Water
    waterPrev: record.waterPrev || '',
    waterNow: record.waterNow || '',
    waterPrice: record.waterPrice || '5.5',
    noWaterMeter: record.noWaterMeter || false,
    // Other fees
    propertyFee: record.propertyFee || '0',
    networkFee: record.networkFee || '0',
    garbageFee: record.garbageFee || '0',
    otherFee: record.otherFee || '0',
    // Deposit
    depositAdjustment: record.depositAdjustment || '0',
    checkout: record.checkout || false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  // Calculate usage
  const electricUsage = (parseFloat(formData.electricNow) || 0) - (parseFloat(formData.electricPrev) || 0);
  const waterUsage = (parseFloat(formData.waterNow) || 0) - (parseFloat(formData.waterPrev) || 0);
  const electricCost = electricUsage * (parseFloat(formData.electricPrice) || 0);
  const waterCost = formData.noWaterMeter ? 0 : waterUsage * (parseFloat(formData.waterPrice) || 0);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑账单 - {record.cycle}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Info */}
          <div className="border-b pb-4">
            <h3 className="font-medium mb-3">基本信息</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">租客</label>
                <Input
                  value={formData.tenantName}
                  onChange={(e) => setFormData({ ...formData, tenantName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">建筑</label>
                <Input
                  value={formData.building}
                  onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">房间</label>
                <Input
                  value={formData.room}
                  onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium mb-1">账期</label>
                <Input
                  value={formData.cycle}
                  onChange={(e) => setFormData({ ...formData, cycle: e.target.value })}
                  placeholder="YYYY-MM"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">到期日</label>
                <Input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">状态</label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="未收">未收</SelectItem>
                    <SelectItem value="部分收款">部分收款</SelectItem>
                    <SelectItem value="已收">已收</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Rent & Fees */}
          <div className="border-b pb-4">
            <h3 className="font-medium mb-3">租金 & 费用</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">租金</label>
                <Input
                  type="number"
                  value={formData.rentPart}
                  onChange={(e) => setFormData({ ...formData, rentPart: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">物业费</label>
                <Input
                  type="number"
                  value={formData.propertyFee}
                  onChange={(e) => setFormData({ ...formData, propertyFee: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">网费</label>
                <Input
                  type="number"
                  value={formData.networkFee}
                  onChange={(e) => setFormData({ ...formData, networkFee: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium mb-1">垃圾费</label>
                <Input
                  type="number"
                  value={formData.garbageFee}
                  onChange={(e) => setFormData({ ...formData, garbageFee: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">其他费用</label>
                <Input
                  type="number"
                  value={formData.otherFee}
                  onChange={(e) => setFormData({ ...formData, otherFee: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">应收合計</label>
                <Input
                  type="number"
                  value={formData.receivable}
                  onChange={(e) => setFormData({ ...formData, receivable: parseFloat(e.target.value) || 0 })}
                  className="font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Electric Meter */}
          <div className="border-b pb-4">
            <h3 className="font-medium mb-3 flex items-center gap-2 text-yellow-600">
              <Zap className="h-4 w-4" />
              电表
            </h3>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">上月讀數</label>
                <Input
                  value={formData.electricPrev}
                  onChange={(e) => setFormData({ ...formData, electricPrev: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">本月讀數</label>
                <Input
                  value={formData.electricNow}
                  onChange={(e) => setFormData({ ...formData, electricNow: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">用量 (度)</label>
                <Input
                  value={electricUsage}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">單價</label>
                <Input
                  value={formData.electricPrice}
                  onChange={(e) => setFormData({ ...formData, electricPrice: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              电费：¥{electricCost.toFixed(2)}
            </div>
          </div>

          {/* Water Meter */}
          <div className="border-b pb-4">
            <h3 className="font-medium mb-3 flex items-center gap-2 text-blue-600">
              <Droplets className="h-4 w-4" />
              水表
            </h3>
            <div className="flex items-center gap-2 mb-3">
              <Checkbox
                id="noWaterMeter"
                checked={formData.noWaterMeter}
                onCheckedChange={(checked) => setFormData({ ...formData, noWaterMeter: !!checked })}
              />
              <label htmlFor="noWaterMeter" className="text-sm">无水表</label>
            </div>
            {!formData.noWaterMeter && (
              <>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">上月讀數</label>
                    <Input
                      value={formData.waterPrev}
                      onChange={(e) => setFormData({ ...formData, waterPrev: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">本月讀數</label>
                    <Input
                      value={formData.waterNow}
                      onChange={(e) => setFormData({ ...formData, waterNow: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">用量 (噸)</label>
                    <Input
                      value={waterUsage}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">單價</label>
                    <Input
                      value={formData.waterPrice}
                      onChange={(e) => setFormData({ ...formData, waterPrice: e.target.value })}
                    />
                  </div>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  水费：¥{waterCost.toFixed(2)}
                </div>
              </>
            )}
          </div>

          {/* Payment */}
          <div className="border-b pb-4">
            <h3 className="font-medium mb-3">收款</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">已收金额</label>
                <Input
                  type="number"
                  value={formData.received}
                  onChange={(e) => setFormData({ ...formData, received: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">收款日期</label>
                <Input
                  type="date"
                  value={formData.paidAt}
                  onChange={(e) => setFormData({ ...formData, paidAt: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">收款方式</label>
                <Select
                  value={formData.method}
                  onValueChange={(value) => setFormData({ ...formData, method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="微信">微信</SelectItem>
                    <SelectItem value="支付寶">支付寶</SelectItem>
                    <SelectItem value="银行转账">银行转账</SelectItem>
                    <SelectItem value="現金">現金</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Deposit */}
          <div className="border-b pb-4">
            <h3 className="font-medium mb-3">押金</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">押金調整</label>
                <Input
                  value={formData.depositAdjustment}
                  onChange={(e) => setFormData({ ...formData, depositAdjustment: e.target.value })}
                  placeholder="正數增加，負數減少"
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox
                  id="checkout"
                  checked={formData.checkout}
                  onCheckedChange={(checked) => setFormData({ ...formData, checkout: !!checked })}
                />
                <label htmlFor="checkout" className="text-sm">退房结账</label>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="pb-4">
            <h3 className="font-medium mb-3">备注</h3>
            <Textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="备注信息..."
              className="min-h-[60px]"
            />
          </div>

          {/* Actions */}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit">
              <Save className="mr-2 h-4 w-4" />
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Quick Receive Modal ──
function QuickReceiveModal({ record, onClose, onSave }: { record: Record; onClose: () => void; onSave: (data: any) => void }) {
  const today = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState({
    amount: (record.receivable || 0) - (record.received || 0),
    method: record.method || '微信',
    note: '快速收款',
    paidAt: record.paidAt || today,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>快速收款</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-muted/30 p-3 rounded-lg space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">租客：</span>
              <span className="font-medium">{record.tenantName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">房间：</span>
              <span>{record.room}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">账期：</span>
              <span>{record.cycle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">应收：</span>
              <span>¥{record.receivable?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">已收：</span>
              <span className="text-green-600">¥{record.received?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 mt-1">
              <span className="text-muted-foreground">未收：</span>
              <span className="text-red-600 font-semibold">
                ¥{((record.receivable || 0) - (record.received || 0)).toFixed(2)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">收款金额</label>
            <Input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
              className="text-lg font-semibold"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">收款日期</label>
            <Input
              type="date"
              value={formData.paidAt}
              onChange={(e) => setFormData({ ...formData, paidAt: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">收款方式</label>
            <Select
              value={formData.method}
              onValueChange={(value) => setFormData({ ...formData, method: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="微信">微信</SelectItem>
                <SelectItem value="支付寶">支付寶</SelectItem>
                <SelectItem value="银行转账">银行转账</SelectItem>
                <SelectItem value="現金">現金</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">备註</label>
            <Input
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit">
              <DollarSign className="mr-2 h-4 w-4" />
              确认收款
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RecordsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCycle, setFilterCycle] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterBuilding, setFilterBuilding] = useState('');
  const [editingRecord, setEditingRecord] = useState<Record | null>(null);
  const [viewingRecord, setViewingRecord] = useState<Record | null>(null);
  const [receiveRecord, setReceiveRecord] = useState<Record | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<Record | null>(null);
  const [expandedBuildings, setExpandedBuildings] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['records', filterCycle, filterStatus, filterBuilding],
    queryFn: () => recordsApi.list({
      cycle: filterCycle || undefined,
      status: filterStatus || undefined,
      building: filterBuilding || undefined,
      pageSize: 100,
    }),
  });

  const records: Record[] = data?.data?.items || [];

  // ── Mutations ──
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => recordsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] });
      setEditingRecord(null);
      toast({ title: '保存成功', description: '账单已更新', variant: 'success' });
    },
    onError: () => {
      toast({ title: '保存失败', description: '请稍后重试', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => recordsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] });
      setDeletingRecord(null);
      toast({ title: '删除成功', description: '账单已删除', variant: 'success' });
    },
    onError: () => {
      toast({ title: '删除失败', description: '请稍后重试', variant: 'destructive' });
    },
  });

  const markSentMutation = useMutation({
    mutationFn: (ids: string[]) => recordsApi.markSent(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] });
      setSelectedIds(new Set());
      toast({ title: '发送成功', description: '账单已标记为已发送', variant: 'success' });
    },
    onError: () => {
      toast({ title: '发送失败', description: '请稍后重试', variant: 'destructive' });
    },
  });

  // 发送账单到微信群
  const sendToWeChatMutation = useMutation({
    mutationFn: (record: Record) => {
      const chatId = prompt('请输入微信群 ID（如：xxxxx@chatroom）');
      if (!chatId) return Promise.resolve({ cancelled: true });
      return wechatApi.sendBill({
        chatId,
        tenantName: record.tenantName || '',
        building: record.building || '',
        room: record.room || record.roomNo || '',
        cycle: record.cycle,
        rent: record.rentPart || 0,
        electricCost: record.electricCost || 0,
        waterCost: record.waterCost || 0,
        total: record.receivable,
        dueDate: record.dueDate,
      });
    },
    onSuccess: (data) => {
      if (data && 'cancelled' in data && data.cancelled) return;
      toast({ title: '发送成功', description: '账单已发送到微信群', variant: 'success' });
    },
    onError: (error) => {
      toast({ title: '发送失败', description: error instanceof Error ? error.message : '未知错误', variant: 'destructive' });
    },
  });

  // Get unique cycles and buildings
  const cycles = [...new Set(records.map(r => r.cycle).filter(Boolean))].sort().reverse();
  const buildings = [...new Set(records.map(r => r.building).filter(Boolean))];

  // Filter by search query locally
  const filteredRecords = searchQuery
    ? records.filter(r =>
        r.tenantName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.room?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.building?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : records;

  // Group by building
  const groupedByBuilding = filteredRecords.reduce((acc: Record<string, Record[]>, record) => {
    const building = record.building || '其他';
    if (!acc[building]) acc[building] = [];
    acc[building].push(record);
    return acc;
  }, {});

  const toggleBuilding = (building: string) => {
    const newExpanded = new Set(expandedBuildings);
    if (newExpanded.has(building)) {
      newExpanded.delete(building);
    } else {
      newExpanded.add(building);
    }
    setExpandedBuildings(newExpanded);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRecords.map(r => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Calculate summary stats
  const totalReceivable = filteredRecords.reduce((sum, r) => sum + (r.receivable || 0), 0);
  const totalReceived = filteredRecords.reduce((sum, r) => sum + (r.received || 0), 0);
  const totalUnpaid = totalReceivable - totalReceived;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">账单管理</h1>
          <p className="text-muted-foreground">
            共 {records.length} 笔账单 | 应收 ¥{totalReceivable.toLocaleString()} | 已收 ¥{totalReceived.toLocaleString()} |{' '}
            <span className="text-red-600 font-medium">未收 ¥{totalUnpaid.toLocaleString()}</span>
          </p>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <Button onClick={() => markSentMutation.mutate(Array.from(selectedIds))}>
              <Send className="mr-2 h-4 w-4" />
              批量发送 ({selectedIds.size})
            </Button>
          )}
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            添加账单
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索租客或房间..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-md bg-background"
          />
        </div>
        <Select value={filterCycle} onValueChange={setFilterCycle}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="所有账期" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">所有账期</SelectItem>
            {cycles.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterBuilding} onValueChange={setFilterBuilding}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="所有建筑" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">所有建筑</SelectItem>
            {buildings.map(b => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="所有状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">所有状态</SelectItem>
            <SelectItem value="未收">未收</SelectItem>
            <SelectItem value="部分收款">部分收款</SelectItem>
            <SelectItem value="已收">已收</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Select All */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={selectedIds.size === filteredRecords.length && filteredRecords.length > 0}
          onChange={toggleSelectAll}
          className="w-4 h-4 rounded border-gray-300"
        />
        <span className="text-sm text-muted-foreground">全选</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="h-16 animate-pulse bg-muted" />
          ))}
        </div>
      ) : filteredRecords.length === 0 ? (
        <Card className="flex h-64 flex-col items-center justify-center text-muted-foreground">
          <Receipt className="mb-4 h-12 w-12" />
          <p>暂无账单</p>
          <Button variant="link">添加第一笔账单</Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedByBuilding).map(([building, buildingRecords]) => (
            <div key={building} className="border rounded-lg overflow-hidden">
              <div
                className="bg-muted/50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-muted/70"
                onClick={() => toggleBuilding(building)}
              >
                <div className="flex items-center gap-2">
                  {expandedBuildings.has(building) ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  <span className="font-medium">{building}</span>
                  <Badge variant="secondary">{buildingRecords.length}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  应收 ¥{buildingRecords.reduce((s, r) => s + (r.receivable || 0), 0).toLocaleString()} |
                  未收 ¥{buildingRecords.reduce((s, r) => s + ((r.receivable || 0) - (r.received || 0)), 0).toLocaleString()}
                </div>
              </div>

              {expandedBuildings.has(building) && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b bg-muted/30">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium w-8"></th>
                        <th className="px-4 py-2 text-left text-sm font-medium">租客</th>
                        <th className="px-4 py-2 text-left text-sm font-medium">房间</th>
                        <th className="px-4 py-2 text-left text-sm font-medium">账期</th>
                        <th className="px-4 py-2 text-right text-sm font-medium">应收</th>
                        <th className="px-4 py-2 text-right text-sm font-medium">已收</th>
                        <th className="px-4 py-2 text-right text-sm font-medium">未收</th>
                        <th className="px-4 py-2 text-center text-sm font-medium">状态</th>
                        <th className="px-4 py-2 text-center text-sm font-medium">发送</th>
                        <th className="px-4 py-2 text-left text-sm font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortRooms(buildingRecords).map((record) => {
                        const unpaid = (record.receivable || 0) - (record.received || 0);
                        return (
                          <tr key={record.id} className="border-b hover:bg-muted/30">
                            <td className="px-4 py-2">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(record.id)}
                                onChange={() => toggleSelect(record.id)}
                                className="w-4 h-4 rounded border-gray-300"
                              />
                            </td>
                            <td className="px-4 py-2 text-sm font-medium">{record.tenantName || '-'}</td>
                            <td className="px-4 py-2 text-sm">{record.room || '-'}</td>
                            <td className="px-4 py-2 text-sm">{record.cycle}</td>
                            <td className="px-4 py-2 text-sm text-right">¥{record.receivable?.toLocaleString()}</td>
                            <td className="px-4 py-2 text-sm text-right text-green-600">¥{record.received?.toLocaleString()}</td>
                            <td className="px-4 py-2 text-sm text-right text-red-600 font-medium">
                              {unpaid > 0 ? `¥${unpaid.toLocaleString()}` : '-'}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <Badge
                                variant={
                                  record.status === '已收' ? 'default' :
                                  record.status === '部分收款' ? 'secondary' : 'destructive'
                                }
                                className={
                                  record.status === '已收' ? 'bg-green-100 text-green-700' :
                                  record.status === '部分收款' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-red-100 text-red-700'
                                }
                              >
                                {record.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-2 text-center">
                              {record.sentStatus === 'sent' ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                              ) : (
                                <Clock className="h-4 w-4 text-muted-foreground mx-auto" />
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setViewingRecord(record)}
                                  title="查看详情"
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingRecord(record)}
                                  title="编辑"
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                {record.status !== '已收' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setReceiveRecord(record)}
                                    title="快速收款"
                                    className="text-green-600"
                                  >
                                    <DollarSign className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => sendToWeChatMutation.mutate(record)}
                                  title="发送到微信群"
                                  className="text-blue-600"
                                  disabled={sendToWeChatMutation.isPending}
                                >
                                  <MessageCircle className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeletingRecord(record)}
                                  title="刪除"
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {viewingRecord && (
        <RecordDetailModal
          record={viewingRecord}
          onClose={() => setViewingRecord(null)}
        />
      )}

      {editingRecord && (
        <RecordEditModal
          record={editingRecord}
          onClose={() => setEditingRecord(null)}
          onSave={(data) => updateMutation.mutate({ id: editingRecord.id, data })}
        />
      )}

      {receiveRecord && (
        <QuickReceiveModal
          record={receiveRecord}
          onClose={() => setReceiveRecord(null)}
          onSave={(data) => {
            // Call quick-receive API
            fetch(`/api/records/quick-receive`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
              },
              body: JSON.stringify({ recordId: receiveRecord.id, ...data }),
            }).then(() => {
              queryClient.invalidateQueries({ queryKey: ['records'] });
              setReceiveRecord(null);
            });
          }}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingRecord}
        onOpenChange={(open) => !open && setDeletingRecord(null)}
        title="删除账单"
        description={deletingRecord ? `确定要删除这笔账单吗？此操作不可撤销。` : undefined}
        confirmText="删除"
        cancelText="取消"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => deletingRecord && deleteMutation.mutate(deletingRecord.id)}
      />
    </div>
  );
}
