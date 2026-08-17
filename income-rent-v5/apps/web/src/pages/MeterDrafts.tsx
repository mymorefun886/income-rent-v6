// Meter Drafts page - 显示未同步的草稿，已同步的单独显示
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { meterDraftsApi, propertiesApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FileEdit, Zap, Droplets, Save, X, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

// Helper: Sort rooms naturally (101, 102, 201, 301...)
function sortRooms(rooms: string[]): string[] {
  return [...rooms].sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0] || '0');
    const numB = parseInt(b.match(/\d+/)?.[0] || '0');
    if (numA !== numB) return numA - numB;
    return a.localeCompare(b);
  });
}

// Helper: Get previous month cycle
function getPreviousCycle(cycle: string): string {
  const [year, month] = cycle.split('-').map(Number);
  if (month === 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(month - 1).padStart(2, '0')}`;
}

// LocalStorage helpers for auto-save
function loadLocalDrafts(key: string): Record<string, string> {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function saveLocalDrafts(key: string, data: Record<string, string>) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function MeterDraftsPage() {
  const [filterCycle, setFilterCycle] = useState('');
  const [filterBuilding, setFilterBuilding] = useState('');
  const [editingDrafts, setEditingDrafts] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [showSynced, setShowSynced] = useState(false); // 是否显示已同步记录

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['meter-drafts', filterCycle, filterBuilding, showSynced ? 'all' : 'draft'],
    queryFn: () => meterDraftsApi.list({
      cycle: filterCycle || undefined,
      building: filterBuilding || undefined,
      status: showSynced ? 'all' : 'draft',
    }),
  });

  // Fetch ALL drafts for dropdown options (independent of filter)
  const { data: allDraftsData } = useQuery({
    queryKey: ['meter-drafts-all-dropdowns'],
    queryFn: () => meterDraftsApi.list({}),
  });

  // Fetch buildings from properties
  const { data: propertiesData } = useQuery({
    queryKey: ['properties-for-meter'],
    queryFn: () => propertiesApi.list({ pageSize: 100 }),
  });

  // Fetch previous cycle drafts for placeholder display
  const prevCycle = filterCycle ? getPreviousCycle(filterCycle) : '';
  const { data: prevDraftsData } = useQuery({
    queryKey: ['meter-drafts-prev', filterBuilding, prevCycle],
    queryFn: () => meterDraftsApi.list({
      cycle: prevCycle,
      building: filterBuilding || undefined,
    }),
    enabled: !!filterCycle && !!prevCycle,
  });

  const allProperties = propertiesData?.data || [];
  const buildings = [...new Set(allProperties.map((p: any) => p.building).filter(Boolean))];

  const drafts = data?.data || [];
  const prevDrafts = prevDraftsData?.data || [];

  // Create a map of previous readings for quick lookup
  const prevReadingsMap: Record<string, any> = {};
  for (const d of prevDrafts) {
    prevReadingsMap[d.room] = d;
  }

  // Get unique cycles and buildings from ALL drafts (not filtered)
  const allDrafts = allDraftsData?.data || [];
  const cycles = [...new Set(allDrafts.map((d: any) => d.cycle).filter(Boolean))].sort();
  const draftBuildings = [...new Set(allDrafts.map((d: any) => d.building).filter(Boolean))];

  // Batch update mutation
  const batchUpdateMutation = useMutation({
    mutationFn: (drafts: Record<string, unknown>[]) => meterDraftsApi.batchUpdate(drafts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meter-drafts'] });
      setIsEditing(false);
      setEditingDrafts([]);
      // Clear local storage after successful save
      if (selectedGroup) {
        localStorage.removeItem(`meter-drafts-${selectedGroup}`);
      }
    },
  });

  // Group by building and cycle, sort rooms
  const groupedByBuildingCycle = drafts.reduce((acc: any, draft: any) => {
    const key = `${draft.building}::${draft.cycle}`;
    if (!acc[key]) acc[key] = { building: draft.building, cycle: draft.cycle, drafts: [] };
    acc[key].drafts.push(draft);
    return acc;
  }, {});

  // Sort rooms in each group
  for (const key of Object.keys(groupedByBuildingCycle)) {
    groupedByBuildingCycle[key].drafts = sortRooms(groupedByBuildingCycle[key].drafts.map((d: any) => d.room))
      .map((room: string) => groupedByBuildingCycle[key].drafts.find((d: any) => d.room === room));
  }

  const handleStartEdit = (groupKey: string, groupDrafts: any[]) => {
    // Load from local storage first (unsaved changes)
    const localKey = `meter-drafts-${groupKey}`;
    const localData = loadLocalDrafts(localKey);

    const mergedDrafts = groupDrafts.map((d: any) => ({
      ...d,
      electricNow: localData[`${d.room}-electric`] ?? d.electricNow ?? '',
      waterNow: localData[`${d.room}-water`] ?? d.waterNow ?? '',
    }));

    setEditingDrafts(mergedDrafts);
    setSelectedGroup(groupKey);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditingDrafts([]);
    setIsEditing(false);
    setSelectedGroup(null);
  };

  const handleUpdateDraft = (index: number, field: string, value: string) => {
    const updated = [...editingDrafts];
    updated[index] = { ...updated[index], [field]: value };
    setEditingDrafts(updated);

    // Auto-save to local storage
    if (selectedGroup) {
      const localKey = `meter-drafts-${selectedGroup}`;
      const localData = loadLocalDrafts(localKey);
      const room = updated[index].room;
      localData[`${room}-${field}`] = value;
      saveLocalDrafts(localKey, localData);
    }
  };

  const handleSaveBatch = () => {
    batchUpdateMutation.mutate(editingDrafts);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">抄表管理</h1>
          <p className="text-sm text-muted-foreground">
            {showSynced ? '已同步记录' : '未同步草稿 · 共 ' + drafts.length + ' 条'}
          </p>
          {!showSynced && (
            <p className="text-xs text-blue-600 mt-1">
              💡 生成账单请在「手机抄表」页面操作
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSynced(!showSynced)}
        >
          {showSynced ? (
            <>
              <FileEdit className="mr-2 h-4 w-4" />
              查看草稿
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              查看已同步
            </>
          )}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 md:gap-4 items-center">
        <select
          value={filterCycle}
          onChange={(e) => setFilterCycle(e.target.value)}
          className="px-3 py-2 border rounded-md bg-background text-sm"
        >
          <option value="">所有周期</option>
          {cycles.map((c: string) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={filterBuilding}
          onChange={(e) => setFilterBuilding(e.target.value)}
          className="px-3 py-2 border rounded-md bg-background text-sm"
        >
          <option value="">所有建筑</option>
          {draftBuildings.map((b: string) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-24 animate-pulse bg-muted" />
          ))}
        </div>
      ) : drafts.length === 0 ? (
        <Card className="flex h-64 flex-col items-center justify-center text-muted-foreground">
          <FileEdit className="mb-4 h-12 w-12" />
          <p>暂无抄表数据</p>
        </Card>
      ) : (
        <div className="space-y-4 md:space-y-6">
          {Object.entries(groupedByBuildingCycle).map(([key, group]: [string, any]) => (
            <div key={key} className="space-y-2 md:space-y-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <h2 className="text-base md:text-lg font-semibold flex items-center gap-2">
                  <FileEdit className="h-4 w-4 md:h-5 md:w-5" />
                  {group.building} - {group.cycle}
                  <Badge variant="secondary">{group.drafts.length} 间</Badge>
                </h2>
                {!isEditing || selectedGroup !== key ? (
                  <div className="flex gap-2">
                    {showSynced ? (
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        已同步
                      </Badge>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => handleStartEdit(key, group.drafts)}>
                        <FileEdit className="mr-1 h-3 w-3 md:mr-2 md:h-4 md:w-4" />
                        编辑
                      </Button>
                    )}
                  </div>
                ) : selectedGroup === key ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveBatch} disabled={batchUpdateMutation.isPending}>
                      <Save className="mr-1 h-3 w-3 md:mr-2 md:h-4 md:w-4" />
                      保存
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                      <X className="mr-1 h-3 w-3 md:mr-2 md:h-4 md:w-4" />
                      取消
                    </Button>
                  </div>
                ) : null}
              </div>

              {/* Mobile-friendly card layout */}
              <div className="grid grid-cols-1 gap-2 md:hidden">
                {(selectedGroup === key ? editingDrafts : group.drafts).map((draft: any, index: number) => {
                  const prevReading = prevReadingsMap[draft.room];
                  return (
                    <div key={draft.id} className="p-3 border rounded-lg bg-background">
                      <div className="font-medium text-base mb-2">{draft.room}</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                            <Zap className="h-3 w-3 text-yellow-500" />
                            电表
                          </label>
                          {selectedGroup === key ? (
                            <input
                              type="number"
                              inputMode="numeric"
                              value={draft.electricNow || ''}
                              onChange={(e) => handleUpdateDraft(index, 'electricNow', e.target.value)}
                              className="w-full px-3 py-2 border rounded bg-background text-base"
                              placeholder={prevReading?.electricNow || '上月读数'}
                            />
                          ) : (
                            <div className="text-base">{draft.electricNow || '-'}</div>
                          )}
                          {prevReading?.electricNow && selectedGroup === key && (
                            <div className="text-xs text-muted-foreground mt-1">
                              上月: {prevReading.electricNow}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                            <Droplets className="h-3 w-3 text-blue-500" />
                            水表
                          </label>
                          {selectedGroup === key ? (
                            <input
                              type="number"
                              inputMode="numeric"
                              value={draft.waterNow || ''}
                              onChange={(e) => handleUpdateDraft(index, 'waterNow', e.target.value)}
                              className="w-full px-3 py-2 border rounded bg-background text-base"
                              placeholder={prevReading?.waterNow || '上月读数'}
                            />
                          ) : (
                            <div className="text-base">{draft.waterNow || '-'}</div>
                          )}
                          {prevReading?.waterNow && selectedGroup === key && (
                            <div className="text-xs text-muted-foreground mt-1">
                              上月: {prevReading.waterNow}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table layout */}
              <div className="hidden md:block rounded-lg border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">房间</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">电表读数</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">水表读数</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">更新时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedGroup === key ? editingDrafts : group.drafts).map((draft: any, index: number) => {
                      const prevReading = prevReadingsMap[draft.room];
                      return (
                        <tr key={draft.id} className="border-b hover:bg-muted/30">
                          <td className="px-4 py-3 text-sm font-medium">{draft.room}</td>
                          <td className="px-4 py-3">
                            {selectedGroup === key ? (
                              <div>
                                <input
                                  type="text"
                                  value={draft.electricNow || ''}
                                  onChange={(e) => handleUpdateDraft(index, 'electricNow', e.target.value)}
                                  className="w-24 px-2 py-1 border rounded bg-background text-sm"
                                  placeholder={prevReading?.electricNow || ''}
                                />
                                {prevReading?.electricNow && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    上月: {prevReading.electricNow}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-sm">
                                <Zap className="h-3 w-3 text-yellow-500" />
                                {draft.electricNow || '-'}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {selectedGroup === key ? (
                              <div>
                                <input
                                  type="text"
                                  value={draft.waterNow || ''}
                                  onChange={(e) => handleUpdateDraft(index, 'waterNow', e.target.value)}
                                  className="w-24 px-2 py-1 border rounded bg-background text-sm"
                                  placeholder={prevReading?.waterNow || ''}
                                />
                                {prevReading?.waterNow && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    上月: {prevReading.waterNow}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-sm">
                                <Droplets className="h-3 w-3 text-blue-500" />
                                {draft.waterNow || '-'}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {draft.updatedAt ? new Date(draft.updatedAt).toLocaleDateString('zh-CN') : '-'}
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
    </div>
  );
}
