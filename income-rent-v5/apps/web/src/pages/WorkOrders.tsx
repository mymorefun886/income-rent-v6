// Work Orders page - 维修工单管理
import { useState, useEffect, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Wrench, User, Phone, Calendar, DollarSign, Building, Home, CheckSquare, RefreshCw, X, ChevronDown, ChevronUp } from 'lucide-react';
import { workOrdersApi } from '@/lib/api';
import { propertiesApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency, formatDate } from '@/lib/utils';

interface WorkOrderRoom {
  id?: string;
  building?: string;
  room?: string;
  issue: string;
  description?: string;
  status?: string;
  laborCost: number;
  materialCost: number;
  totalCost: number;
}

interface WorkOrder {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  scope: string; // single/building/multi_building/multi_room
  building?: string;
  buildings?: string; // JSON array for multi-building
  rooms?: string; // JSON array for multi-room
  roomsList?: WorkOrderRoom[];
  room?: string;
  repairDate?: string;
  workerName?: string;
  workerPhone?: string;
  laborCost: number;
  materialCost: number;
  totalCost: number;
  expenseId?: string;
  createdAt: string;
  updatedAt: string;
}

// 常见维修问题
const COMMON_ISSUES = [
  { label: '水龙头漏水', category: '水电' },
  { label: '马桶堵塞', category: '水电' },
  { label: '电灯不亮', category: '水电' },
  { label: '插座没电', category: '水电' },
  { label: '水表/电表故障', category: '水电' },
  { label: '空调不制冷', category: '电器' },
  { label: '空调漏水', category: '电器' },
  { label: '热水器故障', category: '电器' },
  { label: '门锁损坏', category: '五金' },
  { label: '窗户关不严', category: '五金' },
  { label: '墙面渗水', category: '土建' },
  { label: '墙面裂缝', category: '土建' },
  { label: '地砖破损', category: '土建' },
  { label: '天花脱落', category: '土建' },
  { label: '下水道堵塞', category: '管道' },
  { label: '消防设备', category: '消防' },
  { label: '公共区域照明故障', category: '公共' },
  { label: '其他', category: '其他' },
];

const STATUS_LABELS: Record<string, string> = {
  open: '待处理',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  in_progress: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: '低',
  normal: '普通',
  high: '高',
  urgent: '紧急',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

export function WorkOrdersPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingWorkOrder, setEditingWorkOrder] = useState<WorkOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [formScope, setFormScope] = useState<string>('single');
  const [selectedBuilding, setSelectedBuilding] = useState<string>('');
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [multiRooms, setMultiRooms] = useState<WorkOrderRoom[]>([]);
  const [expandedWorkOrder, setExpandedWorkOrder] = useState<string | null>(null);
  const [showBatchAdd, setShowBatchAdd] = useState<boolean>(false);
  const [batchSelectedRooms, setBatchSelectedRooms] = useState<string[]>([]);
  const [batchIssue, setBatchIssue] = useState<string>('');
  const queryClient = useQueryClient();

  // 获取房源列表（用于选择楼栋和房间）
  const { data: properties } = useQuery({
    queryKey: ['properties-all'],
    queryFn: () => propertiesApi.list({ pageSize: 500 }),
  });

  // 提取唯一楼栋列表
  const buildings = (() => {
    const buildingSet = new Set<string>();
    const props = properties?.data?.items || properties?.data || [];
    props.forEach((p: any) => {
      if (p.building) buildingSet.add(p.building);
    });
    return Array.from(buildingSet).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  })();

  // 根据选择的楼栋提取房间列表
  const rooms = (() => {
    if (!selectedBuilding) return [];
    const props = properties?.data?.items || properties?.data || [];
    const rooms = props
      .filter((p: any) => p.building === selectedBuilding && p.room)
      .map((p: any) => p.room)
      .sort((a: string, b: string) => a.localeCompare(b, 'zh-Hans-CN', { numeric: true }));
    return [...new Set(rooms)];
  })();

  // 根据指定楼栋获取房间列表（用于多房间模式）
  const getRoomsForBuilding = (building: string | undefined) => {
    if (!building) return [];
    const props = properties?.data?.items || properties?.data || [];
    const rooms = props
      .filter((p: any) => p.building === building && p.room)
      .map((p: any) => p.room)
      .sort((a: string, b: string) => a.localeCompare(b, 'zh-Hans-CN', { numeric: true }));
    return [...new Set(rooms)];
  };

  const { data: workOrders, isLoading } = useQuery({
    queryKey: ['work-orders', statusFilter],
    queryFn: () => workOrdersApi.list(statusFilter ? { status: statusFilter } : undefined),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => workOrdersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setShowForm(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: function (params: { id: string; data: Record<string, unknown> }) {
      return workOrdersApi.update(params.id, params.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setEditingWorkOrder(null);
      resetForm();
    },
    onError: (err: any) => {
      console.error('更新失败:', err);
      const msg = err?.message || err?.error || JSON.stringify(err);
      alert('更新失败: ' + msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workOrdersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
    },
  });

  // 同步到支出
  const syncExpenseMutation = useMutation({
    mutationFn: (id: string) => workOrdersApi.syncExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      alert('已同步到支出表');
    },
    onError: (err: any) => {
      alert(err.message || '同步失败');
    },
  });

  const resetForm = () => {
    setSelectedIssues([]);
    setFormScope('single');
    setSelectedBuilding('');
    setSelectedBuildings([]);
    setSelectedRoom('');
    setDescription('');
    setMultiRooms([]);
  };

  // 编辑时初始化表单
  useEffect(() => {
    if (editingWorkOrder) {
      setFormScope(editingWorkOrder.scope);
      setSelectedBuilding(editingWorkOrder.building || '');
      setSelectedRoom(editingWorkOrder.room || '');
      setDescription(editingWorkOrder.description || '');
      if (editingWorkOrder.buildings) {
        try {
          const blds = JSON.parse(editingWorkOrder.buildings);
          setSelectedBuildings(Array.isArray(blds) ? blds : []);
        } catch {
          setSelectedBuildings([]);
        }
      }
      // 初始化多房间数据
      if (editingWorkOrder.scope === 'multi_room') {
        if (editingWorkOrder.roomsList && editingWorkOrder.roomsList.length > 0) {
          setMultiRooms(editingWorkOrder.roomsList);
        } else if (editingWorkOrder.rooms) {
          try {
            const rooms = JSON.parse(editingWorkOrder.rooms);
            setMultiRooms(Array.isArray(rooms) ? rooms : []);
          } catch {
            setMultiRooms([]);
          }
        }
      }
      // 从标题恢复已选常见问题
      const title = editingWorkOrder.title || '';
      const matchedIssues = COMMON_ISSUES
        .map(i => i.label)
        .filter(label => title.includes(label));
      setSelectedIssues(matchedIssues);
    }
  }, [editingWorkOrder]);

  // 多房间操作
  const addMultiRoom = () => {
    setMultiRooms([...multiRooms, { issue: '', laborCost: 0, materialCost: 0, totalCost: 0 }]);
  };

  const removeMultiRoom = (index: number) => {
    setMultiRooms(multiRooms.filter((_, i) => i !== index));
  };

  const updateMultiRoom = (index: number, field: keyof WorkOrderRoom, value: any) => {
    const updated = [...multiRooms];
    (updated[index] as any)[field] = value;
    if (field === 'laborCost' || field === 'materialCost') {
      updated[index].totalCost = (updated[index].laborCost || 0) + (updated[index].materialCost || 0);
    }
    setMultiRooms(updated);
  };

  const moveMultiRoom = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= multiRooms.length) return;
    const updated = [...multiRooms];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setMultiRooms(updated);
  };

  // 批量添加房间
  const handleBatchAddRooms = () => {
    if (batchSelectedRooms.length === 0) return;
    const newRooms = batchSelectedRooms.map(roomKey => {
      const [building, room] = roomKey.split('::');
      return {
        building,
        room,
        issue: batchIssue,
        laborCost: 0,
        materialCost: 0,
        totalCost: 0,
      };
    });
    setMultiRooms([...multiRooms, ...newRooms]);
    setBatchSelectedRooms([]);
    setBatchIssue('');
    setShowBatchAdd(false);
    // 自动更新标题
    const allRooms = [...multiRooms, ...newRooms];
    const issueSummary = allRooms
      .filter(r => r.issue)
      .map(r => `${r.room || '?'}${r.issue}`)
      .join('、');
    if (issueSummary) {
      const titleInput = document.querySelector<HTMLInputElement>('input[name="title"]');
      if (titleInput) titleInput.value = issueSummary;
    }
  };

  // 切换房间选择
  const toggleBatchRoom = (roomKey: string) => {
    setBatchSelectedRooms(prev =>
      prev.includes(roomKey) ? prev.filter(r => r !== roomKey) : [...prev, roomKey]
    );
  };

  // 获取所有房间列表（按楼栋分组）
  const allRoomsByBuilding = (() => {
    const props = properties?.data?.items || properties?.data || [];
    const map = new Map<string, string[]>();
    props.forEach((p: any) => {
      if (p.building && p.room) {
        if (!map.has(p.building)) map.set(p.building, []);
        map.get(p.building)!.push(p.room);
      }
    });
    // 排序
    map.forEach((rooms, building) => {
      map.set(building, [...new Set(rooms)].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN', { numeric: true })));
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'zh-Hans-CN'));
  })();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const laborCost = Number(formData.get('laborCost')) || 0;
    const materialCost = Number(formData.get('materialCost')) || 0;

    // 根据范围决定 building 和 buildings
    let building: string | undefined;
    let buildings: string | undefined;
    let room: string | undefined;
    let totalLaborCost = laborCost;
    let totalMaterialCost = materialCost;

    if (formScope === 'single') {
      building = formData.get('building') as string || undefined;
      // 優先使用 selectedRoom，若無則使用編輯時的房間號
      room = selectedRoom || editingWorkOrder?.room || undefined;
    } else if (formScope === 'building') {
      building = formData.get('building') as string || undefined;
    } else if (formScope === 'multi_building') {
      buildings = selectedBuildings.length > 0 ? JSON.stringify(selectedBuildings) : undefined;
      building = selectedBuildings.length === 1 ? selectedBuildings[0] : undefined;
    } else if (formScope === 'multi_room') {
      // 多房间：累加各房间费用
      totalLaborCost = multiRooms.reduce((sum, r) => sum + (r.laborCost || 0), 0);
      totalMaterialCost = multiRooms.reduce((sum, r) => sum + (r.materialCost || 0), 0);
    }

    const data: Record<string, unknown> = {
      title: formData.get('title'),
      description: description || null,
      status: formData.get('status') || 'open',
      priority: formData.get('priority') || 'normal',
      scope: formScope,
      building,
      buildings,
      room,
      repairDate: formData.get('repairDate') || null,
      workerName: formData.get('workerName') || null,
      workerPhone: formData.get('workerPhone') || null,
      laborCost: totalLaborCost,
      materialCost: totalMaterialCost,
      totalCost: totalLaborCost + totalMaterialCost,
      payee: formData.get('workerName') || null,
    };

    // 多房间时传递 rooms 数组
    if (formScope === 'multi_room') {
      data.rooms = multiRooms;
    }

    if (editingWorkOrder) {
      updateMutation.mutate({ id: editingWorkOrder.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleIssueSelect = (issue: string) => {
    setSelectedIssues(prev => {
      const newIssues = prev.includes(issue)
        ? prev.filter(i => i !== issue)
        : [...prev, issue];
      // 同步更新标题输入框
      const titleInput = document.querySelector<HTMLInputElement>('input[name="title"]');
      if (titleInput) titleInput.value = newIssues.join('、');
      return newIssues;
    });
  };

  const handleBuildingToggle = (bld: string) => {
    setSelectedBuildings(prev =>
      prev.includes(bld) ? prev.filter(b => b !== bld) : [...prev, bld]
    );
  };

  // 解析显示楼栋
  const displayBuildings = (wo: any) => {
    if (wo.buildings) {
      try {
        const blds = JSON.parse(wo.buildings);
        if (Array.isArray(blds) && blds.length > 0) {
          return blds.join(', ');
        }
      } catch {}
    }
    return wo.building || '-';
  };

  // 获取范围标签
  const scopeLabels: Record<string, string> = {
    single: '单间',
    building: '单栋',
    multi_building: '多栋楼',
    multi_room: '多房间',
  };

  // 解析多房间数据
  const parseMultiRooms = (wo: any): WorkOrderRoom[] => {
    if (wo.roomsList && wo.roomsList.length > 0) {
      return wo.roomsList;
    }
    if (wo.rooms) {
      try {
        const rooms = JSON.parse(wo.rooms);
        return Array.isArray(rooms) ? rooms : [];
      } catch {}
    }
    return [];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">工单管理</h1>
          <p className="text-sm text-muted-foreground">维修工单跟踪，包含人工费和材料费</p>
        </div>
        <Button onClick={() => { setShowForm(true); setEditingWorkOrder(null); resetForm(); }}>
          <Plus className="h-4 w-4 mr-2" />
          新增工单
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-md bg-background"
        >
          <option value="">全部状态</option>
          <option value="open">待处理</option>
          <option value="in_progress">进行中</option>
          <option value="completed">已完成</option>
          <option value="cancelled">已取消</option>
        </select>
      </div>

      {/* Form */}
      {(showForm || editingWorkOrder) && (
        <Card>
          <CardHeader>
            <CardTitle>{editingWorkOrder ? '编辑工单' : '新增工单'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 第一行：范围选择 */}
              <div>
                <label className="block text-sm font-medium mb-2">维修范围</label>
                <div className="flex flex-wrap gap-3">
                  <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                    formScope === 'single' ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-950 dark:border-blue-400' : 'hover:bg-muted'
                  }`}>
                    <input
                      type="radio"
                      name="scope"
                      value="single"
                      checked={formScope === 'single'}
                      onChange={() => setFormScope('single')}
                      className="hidden"
                    />
                    <Home className="h-4 w-4" />
                    单个房间
                  </label>
                  <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                    formScope === 'multi_room' ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-950 dark:border-blue-400' : 'hover:bg-muted'
                  }`}>
                    <input
                      type="radio"
                      name="scope"
                      value="multi_room"
                      checked={formScope === 'multi_room'}
                      onChange={() => setFormScope('multi_room')}
                      className="hidden"
                    />
                    <Home className="h-4 w-4" />
                    多个房间
                  </label>
                  <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                    formScope === 'building' ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-950 dark:border-blue-400' : 'hover:bg-muted'
                  }`}>
                    <input
                      type="radio"
                      name="scope"
                      value="building"
                      checked={formScope === 'building'}
                      onChange={() => setFormScope('building')}
                      className="hidden"
                    />
                    <Building className="h-4 w-4" />
                    单栋楼
                  </label>
                  <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                    formScope === 'multi_building' ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-950 dark:border-blue-400' : 'hover:bg-muted'
                  }`}>
                    <input
                      type="radio"
                      name="scope"
                      value="multi_building"
                      checked={formScope === 'multi_building'}
                      onChange={() => setFormScope('multi_building')}
                      className="hidden"
                    />
                    <CheckSquare className="h-4 w-4" />
                    多栋楼
                  </label>
                </div>
              </div>

              {/* 第二行：楼栋/房间选择 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 单个房间：楼栋 + 房间号 */}
                {formScope === 'single' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">楼栋 *</label>
                      <select
                        name="building"
                        value={selectedBuilding}
                        onChange={(e) => setSelectedBuilding(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md bg-background"
                        required
                      >
                        <option value="">选择楼栋</option>
                        {buildings.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">房间号 *</label>
                      <select
                        name="room"
                        value={selectedRoom}
                        onChange={(e) => setSelectedRoom(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md bg-background"
                        required
                      >
                        <option value="">选择房间</option>
                        {rooms.map((r: string) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* 单栋楼：楼栋选择 */}
                {formScope === 'building' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">楼栋 *</label>
                    <select
                      name="building"
                      defaultValue={editingWorkOrder?.building || ''}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                      required
                    >
                      <option value="">选择楼栋</option>
                      {buildings.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 多栋楼：多选楼栋 */}
                {formScope === 'multi_building' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">选择楼栋（可多选）*</label>
                    <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-background">
                      {buildings.length === 0 ? (
                        <span className="text-muted-foreground">暂无楼栋数据</span>
                      ) : (
                        buildings.map((bld) => (
                          <button
                            key={bld}
                            type="button"
                            onClick={() => handleBuildingToggle(bld)}
                            className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                              selectedBuildings.includes(bld)
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-background border-gray-300 hover:border-blue-400'
                            }`}
                          >
                            {selectedBuildings.includes(bld) && <span className="mr-1">✓</span>}
                            {bld}
                          </button>
                        ))
                      )}
                    </div>
                    {selectedBuildings.length > 0 && (
                      <p className="text-sm text-muted-foreground mt-1">
                        已选择 {selectedBuildings.length} 栋：{selectedBuildings.join(', ')}
                      </p>
                    )}
                  </div>
                )}

                {/* 多个房间：动态添加房间和问题 */}
                {formScope === 'multi_room' && (
                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium">房间维修清单 *</label>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => setShowBatchAdd(!showBatchAdd)}>
                          <CheckSquare className="h-4 w-4 mr-1" />
                          批量添加
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={addMultiRoom}>
                          <Plus className="h-4 w-4 mr-1" />
                          添加单个
                        </Button>
                      </div>
                    </div>

                    {/* 批量添加面板 */}
                    {showBatchAdd && (
                      <div className="border rounded-lg p-4 bg-muted/10 mb-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium">选择房间（可多选）</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">统一维修问题：</span>
                            <select
                              value={batchIssue}
                              onChange={(e) => setBatchIssue(e.target.value)}
                              className="px-2 py-1 text-sm border rounded-md bg-background"
                            >
                              <option value="">（可选）</option>
                              {COMMON_ISSUES.map((issue) => (
                                <option key={issue.label} value={issue.label}>{issue.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto border rounded-md bg-background p-2">
                          {allRoomsByBuilding.map(([building, rooms]) => (
                            <div key={building} className="mb-2">
                              <div className="text-xs font-medium text-muted-foreground px-2 py-1 bg-muted/30 rounded sticky top-0">
                                {building}
                              </div>
                              <div className="flex flex-wrap gap-1 p-1">
                                {rooms.map(room => {
                                  const roomKey = `${building}::${room}`;
                                  const isSelected = batchSelectedRooms.includes(roomKey);
                                  return (
                                    <button
                                      key={roomKey}
                                      type="button"
                                      onClick={() => toggleBatchRoom(roomKey)}
                                      className={`px-2 py-1 text-xs rounded border transition-colors ${
                                        isSelected
                                          ? 'bg-blue-600 text-white border-blue-600'
                                          : 'bg-background hover:bg-muted border-gray-300'
                                      }`}
                                    >
                                      {isSelected && <span className="mr-0.5">✓</span>}
                                      {room}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t">
                          <span className="text-sm text-muted-foreground">
                            已选择 {batchSelectedRooms.length} 个房间
                          </span>
                          <div className="flex gap-2">
                            <Button type="button" size="sm" variant="ghost" onClick={() => { setShowBatchAdd(false); setBatchSelectedRooms([]); }}>
                              取消
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleBatchAddRooms}
                              disabled={batchSelectedRooms.length === 0}
                            >
                              确认添加
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="space-y-3">
                      {multiRooms.length === 0 ? (
                        <div className="text-center p-4 border border-dashed rounded-md text-muted-foreground">
                          点击"添加房间"按钮开始添加工单
                        </div>
                      ) : (
                        multiRooms.map((room, index) => (
                          <div key={index} className="border rounded-lg p-3 bg-muted/20">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">房间 #{index + 1}</span>
                              <div className="flex gap-1">
                                <Button type="button" size="sm" variant="ghost" disabled={index === 0} onClick={() => moveMultiRoom(index, 'up')}>
                                  <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button type="button" size="sm" variant="ghost" disabled={index === multiRooms.length - 1} onClick={() => moveMultiRoom(index, 'down')}>
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                                <Button type="button" size="sm" variant="ghost" onClick={() => removeMultiRoom(index)}>
                                  <X className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-muted-foreground mb-1">楼栋</label>
                                <select
                                  value={room.building || ''}
                                  onChange={(e) => updateMultiRoom(index, 'building', e.target.value)}
                                  className="w-full px-2 py-1.5 text-sm border rounded-md bg-background"
                                >
                                  <option value="">选择楼栋</option>
                                  {buildings.map((b) => (
                                    <option key={b} value={b}>{b}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs text-muted-foreground mb-1">房间号</label>
                                <select
                                  value={room.room || ''}
                                  onChange={(e) => updateMultiRoom(index, 'room', e.target.value)}
                                  className="w-full px-2 py-1.5 text-sm border rounded-md bg-background"
                                >
                                  <option value="">选择房间</option>
                                  {getRoomsForBuilding(room.building).map((r: string) => (
                                    <option key={r} value={r}>{r}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            {/* 维修问题多选 */}
                            <div className="mt-3">
                              <label className="block text-xs text-muted-foreground mb-1">维修问题 *（可多选）</label>
                              <div className="flex flex-wrap gap-1">
                                {COMMON_ISSUES.map((issue) => {
                                  // issues 存储为逗号分隔的字符串
                                  const selectedIssues = (room.issue || '').split(',').filter(Boolean);
                                  const isSelected = selectedIssues.includes(issue.label);
                                  return (
                                    <button
                                      key={issue.label}
                                      type="button"
                                      onClick={() => {
                                        let newIssues;
                                        if (isSelected) {
                                          newIssues = selectedIssues.filter(i => i !== issue.label);
                                        } else {
                                          newIssues = [...selectedIssues, issue.label];
                                        }
                                        const newIssueStr = newIssues.join(',');
                                        updateMultiRoom(index, 'issue', newIssueStr);
                                        // 自动更新标题
                                        const newRooms = [...multiRooms];
                                        newRooms[index] = { ...newRooms[index], issue: newIssueStr };
                                        const issueSummary = newRooms
                                          .filter(r => r.issue)
                                          .map(r => `${r.room || '?'}${r.issue.split(',').join('/')}`)
                                          .join('、');
                                        if (issueSummary) {
                                          const titleInput = document.querySelector<HTMLInputElement>('input[name="title"]');
                                          if (titleInput) titleInput.value = issueSummary;
                                        }
                                      }}
                                      className={`px-2 py-1 text-xs rounded border transition-colors ${
                                        isSelected
                                          ? 'bg-blue-600 text-white border-blue-600'
                                          : 'bg-background hover:bg-muted border-gray-300'
                                      }`}
                                    >
                                      {isSelected && <span className="mr-0.5">✓</span>}
                                      {issue.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                              <div>
                                <label className="block text-xs text-muted-foreground mb-1">详细描述</label>
                                <input
                                  type="text"
                                  value={room.description || ''}
                                  onChange={(e) => updateMultiRoom(index, 'description', e.target.value)}
                                  placeholder="问题详情"
                                  className="w-full px-2 py-1.5 text-sm border rounded-md bg-background"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-muted-foreground mb-1">人工费</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={room.laborCost || 0}
                                  onChange={(e) => updateMultiRoom(index, 'laborCost', Number(e.target.value))}
                                  className="w-full px-2 py-1.5 text-sm border rounded-md bg-background"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-muted-foreground mb-1">材料费</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={room.materialCost || 0}
                                  onChange={(e) => updateMultiRoom(index, 'materialCost', Number(e.target.value))}
                                  className="w-full px-2 py-1.5 text-sm border rounded-md bg-background"
                                />
                              </div>
                            </div>
                            <div className="mt-2 text-right text-sm">
                              小计: <span className="font-medium">¥{((room.laborCost || 0) + (room.materialCost || 0)).toFixed(2)}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {multiRooms.length > 0 && (
                      <div className="mt-3 p-3 bg-muted/30 rounded-lg flex items-center justify-between">
                        <span className="font-medium">多房间总计</span>
                        <span className="text-xl font-bold text-red-600">
                          ¥{multiRooms.reduce((sum, r) => sum + (r.laborCost || 0) + (r.materialCost || 0), 0).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 第三行：常见问题（可多选） */}
              <div>
                <label className="block text-sm font-medium mb-2">常见问题（可多选，点击切换）</label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_ISSUES.map((issue) => (
                    <button
                      key={issue.label}
                      type="button"
                      onClick={() => handleIssueSelect(issue.label)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                        selectedIssues.includes(issue.label)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-background border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      {selectedIssues.includes(issue.label) && <span className="mr-1">✓</span>}
                      {issue.label}
                    </button>
                  ))}
                </div>
                {selectedIssues.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    已选择 {selectedIssues.length} 项：{selectedIssues.join('、')}
                  </p>
                )}
              </div>

              {/* 第四行：维修内容 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">维修内容 *</label>
                  <input
                    name="title"
                    type="text"
                    required
                    defaultValue={editingWorkOrder?.title || selectedIssues.join('、')}
                    placeholder="简述维修问题"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">详细描述</label>
                  <textarea
                    name="description"
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="问题详情、注意事项等"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>
              </div>

              {/* 第五行：日期和师傅 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    <Calendar className="inline h-4 w-4 mr-1" />
                    维修日期
                  </label>
                  <input
                    name="repairDate"
                    type="date"
                    defaultValue={editingWorkOrder?.repairDate || new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    <User className="inline h-4 w-4 mr-1" />
                    师傅姓名
                  </label>
                  <input
                    name="workerName"
                    type="text"
                    defaultValue={editingWorkOrder?.workerName}
                    placeholder="维修师傅姓名"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    <Phone className="inline h-4 w-4 mr-1" />
                    师傅电话
                  </label>
                  <input
                    name="workerPhone"
                    type="tel"
                    defaultValue={editingWorkOrder?.workerPhone}
                    placeholder="联系电话，方便下次维护"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>
              </div>

              {/* 第六行：费用 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    <Wrench className="inline h-4 w-4 mr-1" />
                    人工费
                  </label>
                  <input
                    name="laborCost"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={editingWorkOrder?.laborCost || 0}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    <DollarSign className="inline h-4 w-4 mr-1" />
                    材料费
                  </label>
                  <input
                    name="materialCost"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={editingWorkOrder?.materialCost || 0}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>

                <div className="flex items-end">
                  <div className="bg-muted/30 rounded-lg p-3 w-full flex items-center justify-between">
                    <span className="font-medium">总费用</span>
                    <span className="text-xl font-bold text-red-600">
                      ¥{((Number(editingWorkOrder?.laborCost) || 0) + (Number(editingWorkOrder?.materialCost) || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 第七行：状态和优先级 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">状态</label>
                  <select
                    name="status"
                    required
                    defaultValue={editingWorkOrder?.status || 'open'}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  >
                    <option value="open">待处理</option>
                    <option value="in_progress">进行中</option>
                    <option value="completed">已完成</option>
                    <option value="cancelled">已取消</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">优先级</label>
                  <select
                    name="priority"
                    required
                    defaultValue={editingWorkOrder?.priority || 'normal'}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  >
                    <option value="low">低</option>
                    <option value="normal">普通</option>
                    <option value="high">高</option>
                    <option value="urgent">紧急</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingWorkOrder ? '更新' : '创建'}
                </Button>
                <Button type="button" variant="outline" onClick={() => {
                  setShowForm(false);
                  setEditingWorkOrder(null);
                  resetForm();
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
          ) : workOrders?.data?.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">暂无工单</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">维修内容</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">楼栋/房间</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">维修日期</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">师傅</th>
                    <th className="px-4 py-3 text-center text-sm font-medium">状态</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">范围</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">人工费</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">材料费</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">总计</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {workOrders?.data?.map((wo: any) => {
                    const roomsList = parseMultiRooms(wo);
                    const isExpanded = expandedWorkOrder === wo.id;
                    return (
                      <Fragment key={wo.id}>
                        <tr className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => setExpandedWorkOrder(isExpanded ? null : wo.id)}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {wo.scope === 'multi_room' && roomsList.length > 0 && (
                                isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                              )}
                              <div>
                                <div className="font-medium">{wo.title}</div>
                                {wo.description && (
                                  <div className="text-sm text-muted-foreground truncate max-w-xs">
                                    {wo.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm">
                              <div>{displayBuildings(wo)}</div>
                              {wo.scope !== 'multi_room' && wo.room && <div className="text-muted-foreground">{wo.room}</div>}
                              {wo.scope === 'multi_room' && roomsList.length > 0 && (
                                <div className="text-muted-foreground">
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs">
                                    {roomsList.length} 个房间
                                  </span>
                                  <div className="mt-1 text-xs truncate max-w-[180px]" title={roomsList.map(r => `${r.room || '?'}:${r.issue}`).join('、')}>
                                    {roomsList.slice(0, 2).map(r => `${r.room || '?'}:${r.issue}`).join('、')}
                                    {roomsList.length > 2 && ` +${roomsList.length - 2}`}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">{wo.repairDate || '-'}</td>
                          <td className="px-4 py-3 text-sm">
                            {wo.workerName ? (
                              <div>
                                <div>{wo.workerName}</div>
                                {wo.workerPhone && (
                                  <div className="text-muted-foreground text-xs">{wo.workerPhone}</div>
                                )}
                              </div>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs ${STATUS_COLORS[wo.status] || ''}`}>
                              {STATUS_LABELS[wo.status] || wo.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {scopeLabels[wo.scope] || wo.scope}
                          </td>
                          <td className="px-4 py-3 text-right text-sm">{formatCurrency(wo.laborCost || 0)}</td>
                          <td className="px-4 py-3 text-right text-sm">{formatCurrency(wo.materialCost || 0)}</td>
                          <td className="px-4 py-3 text-right font-medium">{formatCurrency((wo.laborCost || 0) + (wo.materialCost || 0))}</td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-2">
                              {wo.expenseId && (
                                <span className="text-xs text-green-600 mr-1" title="已同步到支出">✓</span>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingWorkOrder(wo)}
                                title="编辑"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm('确定同步此工单到支出表？')) {
                                    syncExpenseMutation.mutate(wo.id);
                                  }
                                }}
                                title={wo.expenseId ? '已同步，点击重新同步' : '同步到支出'}
                                disabled={syncExpenseMutation.isPending}
                              >
                                <RefreshCw className={`h-4 w-4 ${wo.expenseId ? 'text-green-600' : ''}`} />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm('确定删除此工单？')) {
                                    deleteMutation.mutate(wo.id);
                                  }
                                }}
                                title="删除"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {/* 多房间展开详情 */}
                        {wo.scope === 'multi_room' && isExpanded && roomsList.length > 0 && (
                          <tr>
                            <td colSpan={10} className="px-4 py-3 bg-muted/30">
                              <div className="text-sm font-medium mb-3 flex items-center gap-2">
                                <Wrench className="h-4 w-4" />
                                房间维修明细
                                <span className="text-xs text-muted-foreground font-normal">
                                  (共 {roomsList.length} 个房间)
                                </span>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-muted-foreground/30">
                                      <th className="px-2 py-1 text-left font-medium text-muted-foreground">#</th>
                                      <th className="px-2 py-1 text-left font-medium text-muted-foreground">楼栋</th>
                                      <th className="px-2 py-1 text-left font-medium text-muted-foreground">房间</th>
                                      <th className="px-2 py-1 text-left font-medium text-muted-foreground">维修问题</th>
                                      <th className="px-2 py-1 text-left font-medium text-muted-foreground">描述</th>
                                      <th className="px-2 py-1 text-right font-medium text-muted-foreground">人工费</th>
                                      <th className="px-2 py-1 text-right font-medium text-muted-foreground">材料费</th>
                                      <th className="px-2 py-1 text-right font-medium text-muted-foreground">小计</th>
                                      <th className="px-2 py-1 text-center font-medium text-muted-foreground">状态</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {roomsList.map((room: any, idx: number) => (
                                      <tr key={idx} className="border-b border-muted-foreground/10 hover:bg-muted/20">
                                        <td className="px-2 py-2 text-muted-foreground">{idx + 1}</td>
                                        <td className="px-2 py-2">{room.building || '-'}</td>
                                        <td className="px-2 py-2 font-medium">{room.room || '-'}</td>
                                        <td className="px-2 py-2">
                                          <span className="inline-flex items-center px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs">
                                            {room.issue}
                                          </span>
                                        </td>
                                        <td className="px-2 py-2 text-muted-foreground max-w-[200px] truncate">{room.description || '-'}</td>
                                        <td className="px-2 py-2 text-right">{formatCurrency(room.laborCost || 0)}</td>
                                        <td className="px-2 py-2 text-right">{formatCurrency(room.materialCost || 0)}</td>
                                        <td className="px-2 py-2 text-right font-medium">{formatCurrency((room.laborCost || 0) + (room.materialCost || 0))}</td>
                                        <td className="px-2 py-2 text-center">
                                          <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[room.status] || ''}`}>
                                            {STATUS_LABELS[room.status] || room.status || '待处理'}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                    <tr className="bg-muted/40 font-medium">
                                      <td colSpan={5} className="px-2 py-2 text-right">合计：</td>
                                      <td className="px-2 py-2 text-right">{formatCurrency(roomsList.reduce((s, r) => s + (r.laborCost || 0), 0))}</td>
                                      <td className="px-2 py-2 text-right">{formatCurrency(roomsList.reduce((s, r) => s + (r.materialCost || 0), 0))}</td>
                                      <td className="px-2 py-2 text-right text-red-600">{formatCurrency(roomsList.reduce((s, r) => s + (r.laborCost || 0) + (r.materialCost || 0), 0))}</td>
                                      <td></td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
