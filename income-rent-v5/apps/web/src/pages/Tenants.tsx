// Tenants page - V4 Compatible
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantsApi, propertiesApi } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Users, Plus, Search, Phone, Calendar, DollarSign, Pencil, Trash2, X, Save, RefreshCw, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';

// ── Fee Item Type ──
interface FeeItem {
  id?: string;
  name: string;
  billingMode: string;
  unitPrice?: number;
  unit?: string;
  initialReading?: number;
  hasMinimum: boolean;
  minimumCharge: number;
}

// ── Edit Modal ──
function TenantEditModal({ tenant, onClose, onSave }: { tenant: any; onClose: () => void; onSave: (data: any) => void }) {
  const [formData, setFormData] = useState({
    name: tenant.name || '',
    phone: tenant.phone || '',
    idNo: tenant.idNo || '',
    idCardFront: tenant.idCardFront || null,
    idCardBack: tenant.idCardBack || null,
    building: tenant.building || '',
    room: tenant.room || '',
    propertyId: tenant.propertyId || '',
    roomLabel: tenant.roomLabel || '',
    rent: tenant.rent || 0,
    deposit: tenant.deposit || 0,
    leaseStart: tenant.leaseStart || '',
    leaseEnd: tenant.leaseEnd || '',
    wechatRemark: tenant.wechatRemark || '',
    wechatGroupName: tenant.wechatGroupName || '',
    status: tenant.status || '正常',
    remind: tenant.remind !== undefined ? tenant.remind : true,
    notes: tenant.notes || '',
    feeItems: tenant.feeItems ? JSON.parse(tenant.feeItems) : [],
  });

  // Fetch all properties for dropdown
  const { data: propertiesData } = useQuery({
    queryKey: ['properties-for-tenant'],
    queryFn: () => propertiesApi.list({ pageSize: 100 }),
  });

  const allProperties = propertiesData?.data || [];
  const buildings = [...new Set(allProperties.map((p: any) => p.building).filter(Boolean))];

  // Get rooms for selected building (show all rooms, but highlight vacant ones)
  const selectedBuildingProperties = allProperties.filter((p: any) => p.building === formData.building);

  const [newFeeItem, setNewFeeItem] = useState<FeeItem>({
    name: '',
    billingMode: '固定金额',
    unitPrice: 0,
    unit: '',
    initialReading: 0,
    hasMinimum: false,
    minimumCharge: 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      feeItems: formData.feeItems.length > 0 ? formData.feeItems : undefined,
    });
  };

  const addFeeItem = () => {
    if (newFeeItem.name.trim()) {
      setFormData({
        ...formData,
        feeItems: [...formData.feeItems, { ...newFeeItem, id: crypto.randomUUID() }]
      });
      setNewFeeItem({
        name: '',
        billingMode: '固定金额',
        unitPrice: 0,
        unit: '',
        initialReading: 0,
        hasMinimum: false,
        minimumCharge: 0,
      });
    }
  };

  const removeFeeItem = (index: number) => {
    setFormData({
      ...formData,
      feeItems: formData.feeItems.filter((_: any, i: number) => i !== index)
    });
  };

  const updateFeeItem = (index: number, field: string, value: any) => {
    const updated = [...formData.feeItems];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, feeItems: updated });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{tenant.name ? `编辑租客 - ${tenant.name}` : '添加租客'}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Basic Info */}
          <div className="border-b pb-4">
            <h3 className="font-medium mb-3">基本信息</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">姓名 *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="租客姓名"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">电话</label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="联系电话"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">身份证号</label>
              <Input
                value={formData.idNo}
                onChange={(e) => setFormData({ ...formData, idNo: e.target.value })}
                placeholder="身份证号码"
              />
            </div>
            {/* ID Card Images */}
            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">身份证照片</label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">正面</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setFormData({ ...formData, idCardFront: reader.result as string });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="w-full text-sm"
                  />
                  {formData.idCardFront && (
                    <div className="mt-2 relative">
                      <img src={formData.idCardFront} alt="身份证正面" className="h-20 w-auto border rounded" />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, idCardFront: null })}
                        className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">反面</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setFormData({ ...formData, idCardBack: reader.result as string });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="w-full text-sm"
                  />
                  {formData.idCardBack && (
                    <div className="mt-2 relative">
                      <img src={formData.idCardBack} alt="身份证反面" className="h-20 w-auto border rounded" />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, idCardBack: null })}
                        className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Property Info */}
          <div className="border-b pb-4">
            <h3 className="font-medium mb-3">房源信息</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">建筑</label>
                <select
                  value={formData.building}
                  onChange={(e) => {
                    setFormData({ ...formData, building: e.target.value, room: '', propertyId: '' });
                  }}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  <option value="">请选择建筑</option>
                  {buildings.map((b: string) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">房间</label>
                <select
                  value={formData.room}
                  onChange={(e) => {
                    const selected = selectedBuildingProperties.find((p: any) => p.room === e.target.value);
                    if (selected) {
                      setFormData({
                        ...formData,
                        room: selected.room,
                        propertyId: selected.id,
                        rent: selected.rent || formData.rent,
                        roomLabel: selected.layout || formData.roomLabel,
                      });
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  disabled={!formData.building}
                >
                  <option value="">请选择房间</option>
                  {selectedBuildingProperties.map((p: any) => {
                    const isVacant = p.status === '空置' || p.status === '闲置';
                    return (
                      <option key={p.id} value={p.room}>
                        {p.room} ({p.layout}) {isVacant ? '✓ 空置' : `(${p.status})`}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">房间标签</label>
              <Input
                value={formData.roomLabel}
                onChange={(e) => setFormData({ ...formData, roomLabel: e.target.value })}
                placeholder="例: 主卧、次卧"
              />
            </div>
          </div>

          {/* Financial */}
          <div className="border-b pb-4">
            <h3 className="font-medium mb-3">财务信息</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">租金 (¥/月)</label>
                <Input
                  type="number"
                  value={formData.rent}
                  onChange={(e) => setFormData({ ...formData, rent: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">押金 (¥)</label>
                <Input
                  type="number"
                  value={formData.deposit}
                  onChange={(e) => setFormData({ ...formData, deposit: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>

          {/* Lease */}
          <div className="border-b pb-4">
            <h3 className="font-medium mb-3">合同期限</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">开始日期</label>
                <Input
                  type="date"
                  value={formData.leaseStart}
                  onChange={(e) => setFormData({ ...formData, leaseStart: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">结束日期</label>
                <Input
                  type="date"
                  value={formData.leaseEnd}
                  onChange={(e) => setFormData({ ...formData, leaseEnd: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">状态</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  <option value="正常">正常</option>
                  <option value="即将到期">即将到期</option>
                  <option value="欠款">欠款</option>
                  <option value="已退租">已退租</option>
                  <option value="纠纷">纠纷</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  checked={formData.remind}
                  onChange={(e) => setFormData({ ...formData, remind: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300"
                  id="remind"
                />
                <label htmlFor="remind" className="text-sm">发送提醒</label>
              </div>
            </div>
          </div>

          {/* WeChat */}
          <div className="border-b pb-4">
            <h3 className="font-medium mb-3">微信信息</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">微信备注</label>
                <Input
                  value={formData.wechatRemark}
                  onChange={(e) => setFormData({ ...formData, wechatRemark: e.target.value })}
                  placeholder="微信备注名"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">微信群名</label>
                <Input
                  value={formData.wechatGroupName}
                  onChange={(e) => setFormData({ ...formData, wechatGroupName: e.target.value })}
                  placeholder="微信群名称"
                />
              </div>
            </div>
          </div>

          {/* Fee Items */}
          <div className="border-b pb-4">
            <h3 className="font-medium mb-3">收费项目</h3>
            <div className="space-y-2 mb-4">
              {formData.feeItems.map((item: FeeItem, i: number) => (
                <div key={item.id || i} className="flex items-center gap-2 p-2 border rounded bg-muted/30">
                  <input
                    value={item.name}
                    onChange={(e) => updateFeeItem(i, 'name', e.target.value)}
                    className="flex-1 px-2 py-1 border rounded bg-background text-sm"
                    placeholder="项目名称"
                  />
                  <select
                    value={item.billingMode}
                    onChange={(e) => updateFeeItem(i, 'billingMode', e.target.value)}
                    className="px-2 py-1 border rounded bg-background text-sm"
                  >
                    <option value="固定金额">固定金额</option>
                    <option value="抄表计算">抄表计算</option>
                  </select>
                  <input
                    type="number"
                    value={item.unitPrice || 0}
                    onChange={(e) => updateFeeItem(i, 'unitPrice', parseFloat(e.target.value) || 0)}
                    className="w-20 px-2 py-1 border rounded bg-background text-sm"
                    placeholder="单价"
                  />
                  <button
                    type="button"
                    onClick={() => removeFeeItem(i)}
                    className="p-1 text-destructive hover:bg-destructive/10 rounded"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add new fee item */}
            <div className="flex items-end gap-2 p-3 border rounded-lg bg-muted/20">
              <div className="flex-1">
                <label className="block text-xs text-muted-foreground mb-1">项目名称</label>
                <Input
                  value={newFeeItem.name}
                  onChange={(e) => setNewFeeItem({ ...newFeeItem, name: e.target.value })}
                  placeholder="例: 水费、电费、网费"
                />
              </div>
              <div className="w-32">
                <label className="block text-xs text-muted-foreground mb-1">计费方式</label>
                <select
                  value={newFeeItem.billingMode}
                  onChange={(e) => setNewFeeItem({ ...newFeeItem, billingMode: e.target.value })}
                  className="w-full px-2 py-2 border rounded-md bg-background text-sm"
                >
                  <option value="固定金额">固定金额</option>
                  <option value="抄表计算">抄表计算</option>
                </select>
              </div>
              <div className="w-24">
                <label className="block text-xs text-muted-foreground mb-1">单价</label>
                <Input
                  type="number"
                  value={newFeeItem.unitPrice}
                  onChange={(e) => setNewFeeItem({ ...newFeeItem, unitPrice: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <Button type="button" variant="secondary" onClick={addFeeItem}>
                添加
              </Button>
            </div>
          </div>

          {/* Notes */}
          <div className="border-b pb-4">
            <h3 className="font-medium mb-3">备注</h3>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background min-h-[80px]"
              placeholder="其他备注信息..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit">
              <Save className="mr-2 h-4 w-4" />
              保存
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function TenantsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBuilding, setFilterBuilding] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editingTenant, setEditingTenant] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['tenants', filterBuilding, showArchived, filterStatus],
    queryFn: () => tenantsApi.list({
      building: filterBuilding || undefined,
      // 如果筛选"已退租"，自动包含已归档的租客
      archived: (filterStatus === '已退租' || showArchived) ? true : undefined,
    }),
  });

  // 获取状态统计
  const { data: statusSummary } = useQuery({
    queryKey: ['tenants-status-summary'],
    queryFn: tenantsApi.statusSummary,
  });

  // 自动更新状态
  const handleAutoUpdateStatus = async () => {
    setIsUpdatingStatus(true);
    try {
      const result = await tenantsApi.autoUpdateStatus();
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['tenants'] });
        queryClient.invalidateQueries({ queryKey: ['tenants-status-summary'] });
        if (result.data?.updates?.length > 0) {
          alert(`已自动更新 ${result.data.updates.length} 个租客状态：\n` +
            result.data.updates.map((u: any) => `• ${u.oldStatus} → ${u.newStatus} (${u.reason})`).join('\n'));
        } else {
          alert('所有租客状态正常，无需更新');
        }
      }
    } catch (error) {
      alert('自动更新状态失败');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => tenantsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setShowAddModal(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => tenantsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setEditingTenant(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tenantsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
  });

  const tenants = data?.data || [];

  // Get unique buildings for filter
  const buildings = [...new Set(tenants.map((t: any) => t.building).filter(Boolean))];

  // Filter by search query and status locally
  let filteredTenants = searchQuery
    ? tenants.filter((t: any) =>
        t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.phone?.includes(searchQuery) ||
        t.room?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.building?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tenants;

  // Filter by status
  if (filterStatus) {
    filteredTenants = filteredTenants.filter((t: any) => (t.status || '正常') === filterStatus);
  }

  // Group by building
  const groupedByBuilding = filteredTenants.reduce((acc: any, tenant: any) => {
    const building = tenant.building || '其他';
    if (!acc[building]) acc[building] = [];
    acc[building].push(tenant);
    return acc;
  }, {});

  const handleSaveEdit = (data: any) => {
    if (editingTenant) {
      updateMutation.mutate({ id: editingTenant.id, data });
    }
  };

  const handleDelete = (tenant: any) => {
    if (confirm(`确定要删除租客 "${tenant.name}" 吗？`)) {
      deleteMutation.mutate(tenant.id);
    }
  };

  // Calculate days until lease end
  const getDaysUntilEnd = (endDate: string) => {
    if (!endDate) return null;
    const end = new Date(endDate);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">租客管理</h1>
          <p className="text-muted-foreground">
            共 {tenants.length} 位租客
            {statusSummary && (
              <span className="ml-2 text-xs">
                (正常: {statusSummary['正常'] || 0}
                ，即将到期: {statusSummary['即将到期'] || 0}
                ，欠款: {statusSummary['欠款'] || 0}
                ，已退租: {statusSummary['已退租'] || 0})
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAutoUpdateStatus} disabled={isUpdatingStatus}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isUpdatingStatus ? 'animate-spin' : ''}`} />
            自动检查状态
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            添加租客
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索租客..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-md bg-background"
          />
        </div>
        <select
          value={filterBuilding}
          onChange={(e) => setFilterBuilding(e.target.value)}
          className="px-4 py-2 border rounded-md bg-background"
        >
          <option value="">所有建筑</option>
          {buildings.map((b: string) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border rounded-md bg-background"
        >
          <option value="">所有状态</option>
          <option value="正常">正常</option>
          <option value="即将到期">即将到期</option>
          <option value="欠款">欠款</option>
          <option value="已退租">已退租</option>
          <option value="纠纷">纠纷</option>
        </select>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300"
          />
          <span className="text-sm">显示已归档</span>
        </label>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="h-24 animate-pulse bg-muted" />
          ))}
        </div>
      ) : filteredTenants.length === 0 ? (
        <Card className="flex h-64 flex-col items-center justify-center text-muted-foreground">
          <Users className="mb-4 h-12 w-12" />
          <p>暂无租客</p>
          <Button variant="link">添加第一位租客</Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByBuilding).map(([building, buildingTenants]: [string, any]) => (
            <div key={building} className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Users className="h-5 w-5" />
                {building}
                <Badge variant="secondary">{buildingTenants.length}</Badge>
              </h2>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">租客</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">房间</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">租金/押金</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">合同期限</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buildingTenants.map((tenant: any) => {
                      const daysUntilEnd = getDaysUntilEnd(tenant.leaseEnd);
                      const isExpiringSoon = daysUntilEnd !== null && daysUntilEnd <= 30 && daysUntilEnd > 0;
                      const isExpired = daysUntilEnd !== null && daysUntilEnd <= 0;
                      const feeItems = tenant.feeItems ? JSON.parse(tenant.feeItems) : [];

                      return (
                        <tr key={tenant.id} className="border-b hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="font-medium">{tenant.name}</div>
                            {tenant.phone && (
                              <div className="text-sm text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {tenant.phone}
                              </div>
                            )}
                            {tenant.wechatRemark && (
                              <div className="text-xs text-muted-foreground mt-1">
                                微信: {tenant.wechatRemark}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div>{tenant.room || '-'}</div>
                            {tenant.building && (
                              <div className="text-xs text-muted-foreground">{tenant.building}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              <span>¥{tenant.rent?.toLocaleString()}/月</span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              押金: ¥{tenant.deposit?.toLocaleString()}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {tenant.leaseStart ? (
                              <div>
                                <div className="text-sm flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {tenant.leaseStart} ~ {tenant.leaseEnd || '长期'}
                                </div>
                                {isExpiringSoon && (
                                  <Badge variant="warning" className="mt-1">
                                    {daysUntilEnd}天后到期
                                  </Badge>
                                )}
                                {isExpired && (
                                  <Badge variant="destructive" className="mt-1">
                                    已到期
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={
                                tenant.status === '正常' ? 'default' :
                                tenant.status === '即将到期' ? 'outline' :
                                tenant.status === '欠款' ? 'destructive' :
                                tenant.status === '已退租' ? 'secondary' :
                                'default'
                              }
                              className={
                                tenant.status === '即将到期' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                                tenant.status === '欠款' ? 'bg-red-100 text-red-800 border-red-300' :
                                tenant.status === '已退租' ? 'bg-gray-100 text-gray-600' :
                                ''
                              }
                            >
                              {tenant.status === '即将到期' && <AlertTriangle className="h-3 w-3 mr-1 inline" />}
                              {tenant.status === '欠款' && <AlertTriangle className="h-3 w-3 mr-1 inline" />}
                              {tenant.status || '正常'}
                            </Badge>
                            {feeItems.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {feeItems.map((f: any) => f.name).join(', ')}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingTenant(tenant)}
                              >
                                <Pencil className="mr-1 h-3 w-3" />
                                编辑
                              </Button>
                              <Button variant="ghost" size="sm">
                                账单
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDelete(tenant)}
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
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingTenant && (
        <TenantEditModal
          tenant={editingTenant}
          onClose={() => setEditingTenant(null)}
          onSave={handleSaveEdit}
        />
      )}

      {/* Add Modal */}
      {showAddModal && (
        <TenantEditModal
          tenant={{}}
          onClose={() => setShowAddModal(false)}
          onSave={(data) => createMutation.mutate(data)}
        />
      )}
    </div>
  );
}
