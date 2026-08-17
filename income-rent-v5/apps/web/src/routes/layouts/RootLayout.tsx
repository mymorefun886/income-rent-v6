// Root layout with responsive sidebar
import { Outlet, Link, useNavigate, useLocation } from '@tanstack/react-router';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/Button';
import { useEffect } from 'react';
import {
  Home,
  Building2,
  Users,
  Receipt,
  Settings,
  Menu,
  X,
  LogOut,
  FileText,
  CreditCard,
  ArrowLeftRight,
  Wallet,
  Wrench,
  Gauge,
  FileEdit,
  Smartphone,
  Droplets,
  MessageSquare,
  Bell,
  BarChart3,
  FileCheck,
  Bot,
} from 'lucide-react';
import { useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';

const navItems = [
  { to: '/', icon: Home, label: '首页' },
  { to: '/properties', icon: Building2, label: '房源' },
  { to: '/tenants', icon: Users, label: '租客' },
  { to: '/contracts', icon: FileText, label: '合同' },
  { to: '/records', icon: Receipt, label: '账单' },
  { to: '/payments', icon: CreditCard, label: '收款' },
  { to: '/transactions', icon: ArrowLeftRight, label: '交易' },
  { to: '/expenses', icon: Wallet, label: '支出' },
  { to: '/work-orders', icon: Wrench, label: '工单' },
  { to: '/meter-input', icon: Smartphone, label: '手机抄表' },
  { to: '/utility-bills', icon: Droplets, label: '水电费盈亏' },
  { to: '/meter-drafts', icon: FileEdit, label: '抄表管理' },
  { to: '/message-logs', icon: MessageSquare, label: '消息日志' },
  { to: '/wechat-bot', icon: Bot, label: '微信 Bot' },
  { to: '/receipts', icon: FileCheck, label: '收據單' },
  { to: '/reminders', icon: Bell, label: '提醒' },
  { to: '/reports', icon: BarChart3, label: '报表' },
  { to: '/settings', icon: Settings, label: '设置' },
];

export function RootLayout() {
  const { user, isAuthenticated, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated && location.pathname !== '/login') {
      navigate({ to: '/login' });
    }
  }, [isAuthenticated, location.pathname, navigate]);

  const handleLogout = () => {
    clearAuth();
    navigate({ to: '/login' });
  };

  // Show minimal layout for login page
  if (location.pathname === '/login') {
    return <Outlet />;
  }

  // Show loading or redirect if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4 text-4xl">🏠</div>
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg"
      >
        跳转到主要内容
      </a>

      {/* Sidebar - Desktop */}
      <aside className="hidden w-64 flex-col border-r bg-sidebar lg:flex" role="navigation" aria-label="主导航">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <span className="text-2xl" aria-hidden="true">🏠</span>
          <span className="text-lg font-bold">收租佬 V6</span>
        </div>
        <nav className="flex-1 space-y-1 p-4 overflow-y-auto" aria-label="页面导航">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-4">
          <div className="mb-2 flex items-center gap-2 px-3 text-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 truncate">
              <p className="font-medium">{user?.username}</p>
              <p className="text-xs text-muted-foreground">{user?.role}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            退出登录
          </Button>
          <div className="mt-2 flex justify-center">
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b px-4 lg:hidden">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏠</span>
            <span className="text-lg font-bold">收租佬 V6</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="菜单">
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </header>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <aside className="h-full w-64 bg-sidebar" onClick={(e) => e.stopPropagation()}>
              <div className="flex h-16 items-center gap-2 border-b px-6">
                <span className="text-2xl">🏠</span>
                <span className="text-lg font-bold">收租佬 V6</span>
              </div>
              <nav className="space-y-1 p-4 overflow-y-auto">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.to;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="absolute bottom-0 left-0 right-0 border-t p-4">
                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  退出登录
                </Button>
              </div>
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main id="main-content" className="flex-1 overflow-auto p-4 lg:p-6" role="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
