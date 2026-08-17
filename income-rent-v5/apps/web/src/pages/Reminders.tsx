// Reminders page - V6
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { remindersApi } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Bell, Plus, Calendar, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export function RemindersPage() {
  const [showEnabled, setShowEnabled] = useState<boolean | undefined>(undefined);

  const { data, isLoading } = useQuery({
    queryKey: ['reminders', showEnabled],
    queryFn: () => remindersApi.list({
      enabled: showEnabled,
    }),
  });

  const { data: upcomingData } = useQuery({
    queryKey: ['reminders', 'upcoming'],
    queryFn: () => remindersApi.upcoming(),
  });

  const reminders = data?.data || [];
  const upcoming = upcomingData?.data || [];

  const getDaysUntilDue = (dueDate: string) => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const now = new Date();
    return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">提醒管理</h1>
          <p className="text-muted-foreground">
            共 {reminders.length} 个提醒，
            {upcoming.length} 个即将到期
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          添加提醒
        </Button>
      </div>

      {/* Upcoming Reminders */}
      {upcoming.length > 0 && (
        <Card className="border-warning">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-5 w-5 text-warning" />
              即将到期提醒
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcoming.map((reminder: any) => {
                const daysUntil = getDaysUntilDue(reminder.dueDate);
                return (
                  <div
                    key={reminder.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-warning/10"
                  >
                    <div>
                      <div className="font-medium">{reminder.room || '未知房间'}</div>
                      <div className="text-sm text-muted-foreground">
                        到期日期: {reminder.dueDate}
                      </div>
                    </div>
                    <Badge variant="warning">
                      {daysUntil}天后到期
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showEnabled === true}
            onChange={(e) => setShowEnabled(e.target.checked ? true : undefined)}
            className="w-4 h-4 rounded border-gray-300"
          />
          <span className="text-sm">仅显示启用</span>
        </label>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="h-24 animate-pulse bg-muted" />
          ))}
        </div>
      ) : reminders.length === 0 ? (
        <Card className="flex h-64 flex-col items-center justify-center text-muted-foreground">
          <Bell className="mb-4 h-12 w-12" />
          <p>暂无提醒</p>
          <Button variant="link">添加第一个提醒</Button>
        </Card>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">房间</th>
                <th className="px-4 py-3 text-left text-sm font-medium">提前天数</th>
                <th className="px-4 py-3 text-left text-sm font-medium">提醒时间</th>
                <th className="px-4 py-3 text-left text-sm font-medium">到期日期</th>
                <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
                <th className="px-4 py-3 text-left text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {reminders.map((reminder: any) => {
                const daysUntil = getDaysUntilDue(reminder.dueDate);
                const isExpiringSoon = daysUntil !== null && daysUntil <= 30 && daysUntil > 0;
                const isExpired = daysUntil !== null && daysUntil <= 0;

                return (
                  <tr key={reminder.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{reminder.room || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {reminder.daysBefore}天
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {reminder.remindTime}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">{reminder.dueDate || '-'}</div>
                      {isExpiringSoon && (
                        <Badge variant="warning" className="mt-1">
                          {daysUntil}天后
                        </Badge>
                      )}
                      {isExpired && (
                        <Badge variant="destructive" className="mt-1">
                          已到期
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={reminder.enabled ? 'success' : 'secondary'}>
                        {reminder.enabled ? '启用' : '禁用'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm">编辑</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
