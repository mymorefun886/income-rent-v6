// Settings page
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Database, Download, Upload, Shield } from 'lucide-react';

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">系统设置</h1>
        <p className="text-muted-foreground">管理系统配置和数据</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Data Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              数据管理
            </CardTitle>
            <CardDescription>备份和恢复您的数据</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start">
              <Download className="mr-2 h-4 w-4" />
              备份数据
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Upload className="mr-2 h-4 w-4" />
              恢复数据
            </Button>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              安全设置
            </CardTitle>
            <CardDescription>管理账户安全和访问权限</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start">
              修改密码
            </Button>
            <Button variant="outline" className="w-full justify-start">
              会话管理
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle>系统信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>版本: V5.0.0</p>
          <p>数据库: SQLite (better-sqlite3)</p>
          <p>部署方式: Docker</p>
        </CardContent>
      </Card>
    </div>
  );
}
