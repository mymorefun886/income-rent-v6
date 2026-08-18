// Message Logs page - V8
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { messageLogsApi } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MessageSquare, Search, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export function MessageLogsPage() {
  const [filterStatus, setFilterStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['message-logs', filterStatus],
    queryFn: () => messageLogsApi.list({
      status: filterStatus || undefined,
    }),
  });

  const logs = data?.data?.items || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">消息日志</h1>
          <p className="text-muted-foreground">
            共 {logs.length} 条消息记录，
            成功 {logs.filter((l: any) => l.status === 'sent').length} 条
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border rounded-md bg-background"
        >
          <option value="">所有状态</option>
          <option value="sent">发送成功</option>
          <option value="failed">发送失败</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="h-20 animate-pulse bg-muted" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <Card className="flex h-64 flex-col items-center justify-center text-muted-foreground">
          <MessageSquare className="mb-4 h-12 w-12" />
          <p>暂无消息日志</p>
        </Card>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">发送时间</th>
                <th className="px-4 py-3 text-left text-sm font-medium">目标群组</th>
                <th className="px-4 py-3 text-left text-sm font-medium">操作员</th>
                <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
                <th className="px-4 py-3 text-left text-sm font-medium">关联账单</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any) => (
                <tr key={log.id} className="border-b hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm">
                    {log.sentAt ? new Date(log.sentAt).toLocaleString('zh-CN') : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">{log.targetGroup || '-'}</td>
                  <td className="px-4 py-3 text-sm">{log.operator || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(log.status)}
                      <Badge variant={log.status === 'sent' ? 'success' : 'destructive'}>
                        {log.status === 'sent' ? '成功' : '失败'}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {log.recordId ? log.recordId.slice(0, 8) + '...' : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
