// Properties page - V4 Compatible
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { propertiesApi } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
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
import { Building2, Plus, Home, Search, Filter, Pencil, Trash2, X, Save } from 'lucide-react';

const statusColors: Record<string, string> = {
  '已出租': 'bg-green-500',
  '空置': 'bg-yellow-500',
  '自用': 'bg-blue-500',
};

const usageTypeLabels: Record<string, string> = {
  '出租': '出租',
  '自用（不出租）': '自用',
};

// ── V4 Options ──
const LAYOUT_OPTIONS = ['单间', '1室1厅0卫', '1室1厅1卫', '2室1厅1卫', '2室2厅1卫', '3室2厅2卫', '4室2厅2卫'];
const INVENTORY_OPTIONS = ['空调', '热水器', '洗衣机', '冰箱', '电视', '微波炉', '床', '衣柜', '书桌', '沙发', '油烟机', '燃气灶', '电视柜', '鞋柜', '热水器(太阳能)', '热水器(电)', '宽带', '有线电视'];
const TAG_OPTIONS = ['付一押一', '付一押二', '付一押三', '楼梯', '电梯', '有阳台', '有卫生间', '可短租', '微信', '支付宝', '银行转账', '停车位', '近地铁', '精装修', '简装修', '毛坯'];

// ── Edit Modal ──
function PropertyEditModal({ property, onClose, onSave }: { property: any; onClose: () => void; onSave: (data: any) => void }) {
  const [formData, setFormData] = useState({
    building: property.building || '',
    room: property.room || '',
    floor: property.floor || 0,
    totalFloor: property.totalFloor || 0,
    layout: property.layout || '',
    title: property.title || '',
    address: property.address || '',
    area: property.area || 0,
    rent: property.rent || 0,
    displayRent: property.displayRent || 0,
    usageType: property.usageType || '出租',
    propertyType: property.propertyType || '',
    bankAccount: property.bankAccount || '',
    status: property.status || '空置',
    tenantName: property.tenantName || '',
    tenantPhone: property.tenantPhone || '',
    contractEnd: property.contractEnd || '',
    balance: property.balance || 0,
    notes: property.notes || '',
    tags: property.tags ? JSON.parse(property.tags) : [],
    roomInventory: property.roomInventory ? JSON.parse(property.roomInventory) : [],
  });

  const [newTag, setNewTag] = useState('');
  const [newItem, setNewItem] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      tags: formData.tags.length > 0 ? formData.tags : undefined,
      roomInventory: formData.roomInventory.length > 0 ? formData.roomInventory : undefined,
    });
  };

  const addTag = () => {
    if (newTag.trim()) {
      setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] });
      setNewTag('');
    }
  };

  const removeTag = (index: number) => {
    setFormData({ ...formData, tags: formData.tags.filter((_: any, i: number) => i !== index) });
  };

  const addInventoryItem = () => {
    if (newItem.trim()) {
      setFormData({ ...formData, roomInventory: [...formData.roomInventory, newItem.trim()] });
      setNewItem('');
    }
  };

  const removeInventoryItem = (index: number) => {
    setFormData({ ...formData, roomInventory: formData.roomInventory.filter((_: any, i: number) => i !== index) });
  };

  return (
    <Dialog open={!!property} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑房源 - {property.title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">建筑</label>
              <Input
                value={formData.building}
                onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                placeholder="例: 西山东区30号A"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">房号</label>
              <Input
                value={formData.room}
                onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                placeholder="例: 101"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">楼层</label>
              <Input
                type="number"
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">总楼层</label>
              <Input
                type="number"
                value={formData.totalFloor}
                onChange={(e) => setFormData({ ...formData, totalFloor: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">户型</label>
              <Select
                value={formData.layout}
                onValueChange={(value) => setFormData({ ...formData, layout: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择户型" />
                </SelectTrigger>
                <SelectContent>
                  {LAYOUT_OPTIONS.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

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
              <label className="block text-sm font-medium mb-1">展示租金</label>
              <Input
                type="number"
                value={formData.displayRent}
                onChange={(e) => setFormData({ ...formData, displayRent: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
                  <SelectItem value="空置">空置</SelectItem>
                  <SelectItem value="已出租">已出租</SelectItem>
                  <SelectItem value="自用">自用</SelectItem>
                  <SelectItem value="闲置">闲置</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">用途</label>
              <Select
                value={formData.usageType}
                onValueChange={(value) => setFormData({ ...formData, usageType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="出租">出租</SelectItem>
                  <SelectItem value="自用（不出租）">自用（不出租）</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tenant Info */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">租客信息</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">租客姓名</label>
                <Input
                  value={formData.tenantName}
                  onChange={(e) => setFormData({ ...formData, tenantName: e.target.value })}
                  placeholder="租客姓名"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">租客电话</label>
                <Input
                  value={formData.tenantPhone}
                  onChange={(e) => setFormData({ ...formData, tenantPhone: e.target.value })}
                  placeholder="联系电话"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">合同到期日</label>
              <Input
                type="date"
                value={formData.contractEnd}
                onChange={(e) => setFormData({ ...formData, contractEnd: e.target.value })}
              />
            </div>
          </div>

          {/* Financial */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">财务信息</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">收款账户</label>
                <Select
                  value={formData.bankAccount}
                  onValueChange={(value) => setFormData({ ...formData, bankAccount: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="微信">微信</SelectItem>
                    <SelectItem value="支付宝">支付宝</SelectItem>
                    <SelectItem value="银行转账">银行转账</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">余额</label>
                <Input
                  type="number"
                  value={formData.balance}
                  onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>

          {/* Tags - Multi-select from options */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">标签</h3>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {TAG_OPTIONS.map(tag => (
                <label key={tag} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={formData.tags.includes(tag)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFormData({ ...formData, tags: [...formData.tags, tag] });
                      } else {
                        setFormData({ ...formData, tags: formData.tags.filter((t: string) => t !== tag) });
                      }
                    }}
                  />
                  {tag}
                </label>
              ))}
            </div>
            {/* Custom tags */}
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.tags.filter((t: string) => !TAG_OPTIONS.includes(t)).map((tag: string, i: number) => (
                <Badge key={i} variant="outline" className="flex items-center gap-1">
                  {tag}
                  <button type="button" onClick={() => setFormData({ ...formData, tags: formData.tags.filter((t: string) => t !== tag) })} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="添加自定义标签..."
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              />
              <Button type="button" variant="secondary" onClick={addTag}>添加</Button>
            </div>
          </div>

          {/* Inventory - Multi-select from options */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">房间物品</h3>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {INVENTORY_OPTIONS.map(item => (
                <label key={item} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={formData.roomInventory.includes(item)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFormData({ ...formData, roomInventory: [...formData.roomInventory, item] });
                      } else {
                        setFormData({ ...formData, roomInventory: formData.roomInventory.filter((i: string) => i !== item) });
                      }
                    }}
                  />
                  {item}
                </label>
              ))}
            </div>
            {/* Custom items */}
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.roomInventory.filter((i: string) => !INVENTORY_OPTIONS.includes(i)).map((item: string, i: number) => (
                <Badge key={i} variant="secondary" className="flex items-center gap-1">
                  {item}
                  <button type="button" onClick={() => setFormData({ ...formData, roomInventory: formData.roomInventory.filter((ri: string) => ri !== item) })} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="添加自定义物品..."
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addInventoryItem())}
              />
              <Button type="button" variant="secondary" onClick={addInventoryItem}>添加</Button>
            </div>
          </div>

          {/* Notes */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">备注</h3>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="其他备注信息..."
              className="min-h-[80px]"
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

export function PropertiesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBuilding, setFilterBuilding] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [editingProperty, setEditingProperty] = useState<any>(null);
  const [deletingProperty, setDeletingProperty] = useState<any>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['properties', filterBuilding, filterStatus],
    queryFn: () => propertiesApi.list({
      building: filterBuilding || undefined,
      status: filterStatus || undefined,
    }),
  });

  // ── Mutations ──
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => propertiesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      setEditingProperty(null);
      toast({ title: '保存成功', description: '房源信息已更新', variant: 'success' });
    },
    onError: () => {
      toast({ title: '保存失败', description: '请稍后重试', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => propertiesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast({ title: '删除成功', description: '房源已删除', variant: 'success' });
    },
    onError: () => {
      toast({ title: '删除失败', description: '请稍后重试', variant: 'destructive' });
    },
  });

  const properties = data?.data || [];

  // Get unique buildings for filter
  const buildings = [...new Set(properties.map((p: any) => p.building).filter(Boolean))];

  // Filter by search query locally
  const filteredProperties = searchQuery
    ? properties.filter((p: any) =>
        p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.building?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.room?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.address?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : properties;

  // Group by building
  const groupedByBuilding = filteredProperties.reduce((acc: any, prop: any) => {
    const building = prop.building || '其他';
    if (!acc[building]) acc[building] = [];
    acc[building].push(prop);
    return acc;
  }, {});

  // Sort buildings: 西山别墅98栋排在最后
  const sortedBuildings = Object.entries(groupedByBuilding).sort((a: [string, any], b: [string, any]) => {
    const buildingA = a[0];
    const buildingB = b[0];
    // 西山别墅98栋排最后
    if (buildingA.includes('西山别墅') && !buildingB.includes('西山别墅')) return 1;
    if (!buildingA.includes('西山别墅') && buildingB.includes('西山别墅')) return -1;
    // 其他按字母排序
    return buildingA.localeCompare(buildingB);
  });

  const handleSaveEdit = (data: any) => {
    if (editingProperty) {
      updateMutation.mutate({ id: editingProperty.id, data });
    }
  };

  const handleDelete = (property: any) => {
    setDeletingProperty(property);
  };

  const confirmDelete = () => {
    if (deletingProperty) {
      deleteMutation.mutate(deletingProperty.id);
      setDeletingProperty(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">房源管理</h1>
          <p className="text-muted-foreground">
            共 {properties.length} 套房源，
            已出租 {properties.filter((p: any) => p.status === '已出租').length} 套，
            空置 {properties.filter((p: any) => p.status === '空置').length} 套
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          添加房源
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索房源..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-md bg-background"
          />
        </div>
        <Select value={filterBuilding} onValueChange={setFilterBuilding}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="所有建筑" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">所有建筑</SelectItem>
            {buildings.map((b: string) => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="所有状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">所有状态</SelectItem>
            <SelectItem value="已出租">已出租</SelectItem>
            <SelectItem value="空置">空置</SelectItem>
            <SelectItem value="自用">自用</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-40 animate-pulse bg-muted" />
          ))}
        </div>
      ) : filteredProperties.length === 0 ? (
        <Card className="flex h-64 flex-col items-center justify-center text-muted-foreground">
          <Building2 className="mb-4 h-12 w-12" />
          <p>暂无房源</p>
          <Button variant="link">添加第一套房源</Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedBuildings.map(([building, props]: [string, any]) => (
            <div key={building} className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {building}
                <Badge variant="secondary">{props.length}</Badge>
              </h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {props.map((property: any) => {
                  const tags = property.tags ? JSON.parse(property.tags) : [];
                  const roomConfigs = property.roomConfigs ? JSON.parse(property.roomConfigs) : [];

                  return (
                    <Card key={property.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center justify-between">
                          <span className="truncate">{property.title}</span>
                          <Badge className={statusColors[property.status] || 'bg-gray-500'}>
                            {property.status || '未知'}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Home className="h-4 w-4" />
                          <span>{property.room}</span>
                          {property.layout && <span>({property.layout})</span>}
                        </div>
                        {property.floor && (
                          <div className="text-muted-foreground">
                            {property.floor}楼 / 共{property.totalFloor}楼
                          </div>
                        )}
                        {property.rent > 0 && (
                          <div className="font-semibold text-lg">
                            ¥{property.rent.toLocaleString()}/月
                          </div>
                        )}
                        {property.tenantName && (
                          <div className="text-muted-foreground">
                            租客: {property.tenantName}
                          </div>
                        )}
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {tags.map((tag: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {property.bankAccount && (
                          <div className="text-xs text-muted-foreground">
                            收款: {property.bankAccount}
                          </div>
                        )}
                        {/* Actions */}
                        <div className="flex gap-2 pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => setEditingProperty(property)}
                          >
                            <Pencil className="mr-1 h-3 w-3" />
                            编辑
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(property)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingProperty && (
        <PropertyEditModal
          property={editingProperty}
          onClose={() => setEditingProperty(null)}
          onSave={handleSaveEdit}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingProperty}
        onOpenChange={(open) => !open && setDeletingProperty(null)}
        title="删除房源"
        description={deletingProperty ? `确定要删除房源 "${deletingProperty.title}" 吗？此操作不可撤销。` : undefined}
        confirmText="删除"
        cancelText="取消"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
