// Transactions page - V8
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionsApi } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ArrowLeftRight, Plus, Search, RefreshCw, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export function TransactionsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['transactions', filterStatus],
    queryFn: () => transactionsApi.list({
      status: filterStatus || undefined,
      search: searchQuery || undefined,
    }),
  });

  const autoMatchMutation = useMutation({
    mutationFn: () => transactionsApi.autoMatch(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['records'] });
    },
  });

  const transactions = data?.data?.items || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'matched':
        return <Badge variant="success">已匹配</Badge>;
      case 'completed':
        return <Badge variant="default">已完成</Badge>;
      default:
        return <Badge variant="warning">未匹配</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'deposit_collect':
        return <Badge variant="secondary">收押金</Badge>;
      case 'deposit_refund':
        return <Badge variant="secondary">退押金</Badge>;
      case 'rent_income':
        return <Badge variant="default">租金</Badge>;
      default:
        return <Badge variant="outline">{type || '其他'}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">交易记录</h1>
          <p className="text-muted-foreground">
            共 {transactions.length} 笔交易，
            未匹配 {transactions.filter((t: any) => t.status === 'unmatched').length} 笔
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => autoMatchMutation.mutate()}
            disabled={autoMatchMutation.isPending}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            自动匹配
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            添加交易
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索交易..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-md bg-background"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border rounded-md bg-background"
        >
          <option value="">所有状态</option>
          <option value="unmatched">未匹配</option>
          <option value="matched">已匹配</option>
          <option value="completed">已完成</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="h-20 animate-pulse bg-muted" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <Card className="flex h-64 flex-col items-center justify-center text-muted-foreground">
          <ArrowLeftRight className="mb-4 h-12 w-12" />
          <p>暂无交易记录</p>
          <Button variant="link">添加第一笔交易</Button>
        </Card>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">日期</th>
                <th className="px-4 py-3 text-left text-sm font-medium">类型</th>
                <th className="px-4 py-3 text-left text-sm font-medium">金额</th>
                <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
                <th className="px-4 py-3 text-left text-sm font-medium">备注</th>
                <th className="px-4 py-3 text-left text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx: any) => (
                <tr key={tx.id} className="border-b hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm">
                    {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('zh-CN') : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {getTypeBadge(tx.type)}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    ¥{tx.amount?.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(tx.status)}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground truncate max-w-xs">
                    {tx.note || '-'}
                  </td>
                  <td className="px-4 py-3">
                    {tx.status === 'unmatched' && (
                      <Button variant="ghost" size="sm">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        匹配
                      </Button>
                    )}
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
