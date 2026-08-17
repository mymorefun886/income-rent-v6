// WeChat Bot Settings page - 微信 Bot 管理
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wechatApi } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MessageSquare, RefreshCw, Send, QrCode, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export function WeChatBotPage() {
  const [chatId, setChatId] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [pollingEnabled, setPollingEnabled] = useState(false);
  const queryClient = useQueryClient();

  // 获取 Bot 状态
  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['wechat-status'],
    queryFn: () => wechatApi.status(),
    refetchInterval: pollingEnabled ? 2000 : 5000, // 初始化后更频繁轮询
  });

  const botStatus = statusData?.data || { ready: false };

  // 从状态中获取二维码
  const qrCode = botStatus.qrCode || null;

  // 调试信息
  console.log('[WeChat Bot] statusData:', statusData);
  console.log('[WeChat Bot] botStatus:', botStatus);
  console.log('[WeChat Bot] qrCode:', qrCode);

  // 初始化 Bot
  const initMutation = useMutation({
    mutationFn: () => wechatApi.init(),
    onSuccess: (data) => {
      console.log('[WeChat Bot] init success:', data);
      // 开始频繁轮询
      setPollingEnabled(true);
      // 立即刷新一次
      queryClient.invalidateQueries({ queryKey: ['wechat-status'] });
      // 10 秒后停止频繁轮询
      setTimeout(() => setPollingEnabled(false), 10000);
    },
    onError: (error) => {
      console.error('[WeChat Bot] init error:', error);
    },
  });

  // 发送测试消息
  const sendMutation = useMutation({
    mutationFn: () => wechatApi.send({ chatId, content: testMessage }),
    onSuccess: () => {
      setTestMessage('');
      alert('消息已发送');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">微信 Bot 管理</h1>
          <p className="text-muted-foreground">
            管理个人微信 Bot，发送账单和催租消息
          </p>
        </div>
      </div>

      {/* Bot 状态 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Bot 状态
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {statusLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : botStatus.ready ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-green-600 font-medium">已连接</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="text-red-600 font-medium">未连接</span>
                </>
              )}
            </div>
            <Button
              onClick={() => initMutation.mutate()}
              disabled={initMutation.isPending || botStatus.ready}
              variant="default"
            >
              {initMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  初始化中...
                </>
              ) : (
                <>
                  <QrCode className="mr-2 h-4 w-4" />
                  {botStatus.ready ? '已登录' : '扫码登录'}
                </>
              )}
            </Button>
          </div>

          {/* 二维码显示 */}
          {qrCode && !botStatus.ready && (
            <div className="mt-4 p-4 bg-muted rounded-lg flex flex-col items-center">
              <p className="text-sm text-muted-foreground mb-3">请使用微信扫描以下二维码登录：</p>
              <div className="bg-white p-2 rounded-lg">
                {/* 使用 iframe 或直接链接打开二维码 */}
                <iframe
                  src={qrCode}
                  title="微信登录二维码"
                  className="w-64 h-64 border-0"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                如果二维码无法显示，
                <a
                  href={qrCode}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 underline ml-1"
                >
                  点击这里在新窗口打开
                </a>
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                二维码有效期约 2 分钟，请尽快扫码
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 发送测试消息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            发送测试消息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">群 Chat ID</label>
              <input
                type="text"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="输入微信群 ID（可从微信获取）"
                className="w-full px-4 py-2 border rounded-md bg-background"
              />
              <p className="text-xs text-muted-foreground mt-1">
                群 ID 格式类似：xxxxx@chatroom
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">消息内容</label>
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="输入要发送的测试消息..."
                rows={4}
                className="w-full px-4 py-2 border rounded-md bg-background resize-none"
              />
            </div>
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={!chatId || !testMessage || sendMutation.isPending || !botStatus.ready}
            >
              {sendMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  发送中...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  发送消息
                </>
              )}
            </Button>
            {!botStatus.ready && (
              <p className="text-xs text-amber-600">
                ⚠️ Bot 未连接，请先完成扫码登录
              </p>
            )}
            {sendMutation.isError && (
              <p className="text-xs text-red-600">
                ❌ 发送失败：{sendMutation.error?.message || '未知错误'}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle>使用说明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">1. 登录 Bot：</strong>
              点击「扫码登录」按钮，使用微信扫描二维码
            </p>
            <p>
              <strong className="text-foreground">2. 获取群 ID：</strong>
              在微信中打开目标群聊，点击群名称查看群信息
            </p>
            <p>
              <strong className="text-foreground">3. 发送消息：</strong>
              输入群 ID 和消息内容，点击发送测试
            </p>
            <p>
              <strong className="text-foreground">4. 自动功能：</strong>
              配置完成后，系统可自动发送账单和催租提醒
            </p>
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
              <p className="text-blue-700 dark:text-blue-300">
                <strong>提示：</strong>Bot 登录状态会持久化，无需每次重启后重新扫码。
                如遇登录过期，系统会自动提示重新扫码。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
