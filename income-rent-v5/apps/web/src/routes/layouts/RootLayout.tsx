// Root layout with responsive sidebar and grouped navigation
import { Outlet, Link, useNavigate, useLocation } from '@tanstack/react-router';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/Button';
import { useEffect, useState } from 'react';
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
  FileEdit,
  Smartphone,
  Droplets,
  MessageSquare,
  Bell,
  BarChart3,
  FileCheck,
  Bot,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Toaster } from '@/components/ui/Toaster';
import { Sidebar, type NavGroup, type NavItem } from '@/components/layout/Sidebar';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { cn } from '@/lib/utils';

// ── Navigation Configuration ──
// Top-level items (always visible)
const topLevelNavItems: NavItem[] = [
  { to: '/', icon: Home, label: '首页' },
];

// Grouped navigation items
const navGroups: NavGroup[] = [
  {
    title: '租务管理',
    items: [
      { to: '/properties', icon: Building2, label: '房源' },
      { to: '/tenants', icon: Users, label: '租客' },
      { to: '/contracts', icon: FileText, label: '合同' },
      { to: '/work-orders', icon: Wrench, label: '工单' },
    ],
  },
  {
    title: '财务管理',
    items: [
      { to: '/records', icon: Receipt, label: '账单' },
      { to: '/payments', icon: CreditCard, label: '收款' },
      { to: '/transactions', icon: ArrowLeftRight, label: '交易' },
      { to: '/expenses', icon: Wallet, label: '支出' },
      { to: '/receipts', icon: FileCheck, label: '收據單' },
    ],
  },
  {
    title: '抄表 & 水电',
    items: [
      { to: '/meter-input', icon: Smartphone, label: '手机抄表' },
      { to: '/meter-drafts', icon: FileEdit, label: '抄表管理' },
      { to: '/utility-bills', icon: Droplets, label: '水电费盈亏' },
    ],
  },
  {
    title: '沟通 & 自动化',
    items: [
      { to: '/reminders', icon: Bell, label: '提醒' },
      { to: '/message-logs', icon: MessageSquare, label: '消息日志' },
      { to: '/wechat-bot', icon: Bot, label: '微信 Bot' },
    ],
  },
];

// Bottom items (Settings, etc.)
const bottomNavItems: NavItem[] = [
  { to: '/reports', icon: BarChart3, label: '报表' },
  { to: '/settings', icon: Settings, label: '设置' },
];

// Default open groups (can be persisted)
const DEFAULT_OPEN_GROUPS = ['租务管理', '财务管理'];

export function RootLayout() {
  const { user, isAuthenticated, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(DEFAULT_OPEN_GROUPS)
  );

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

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  // Auto-expand group based on current path
  useEffect(() => {
    for (const group of navGroups) {
      if (group.items.some((item) => item.to === location.pathname)) {
        setOpenGroups((prev) => {
          if (prev.has(group.title)) return prev;
          const next = new Set(prev);
          next.add(group.title);
          return next;
        });
        break;
      }
    }
  }, [location.pathname]);

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
      <div className="hidden lg:flex">
        <Sidebar
          groups={navGroups}
          topLevelItems={topLevelNavItems}
          bottomItems={bottomNavItems}
          openGroups={openGroups}
          onToggleGroup={toggleGroup}
        />
        {/* Bottom section */}
        <div className="hidden" />
      </div>

      {/* Mobile Header */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b px-4 safe-top lg:hidden">
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">🏠</span>
            <span className="text-lg font-bold">收租佬 V6</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="菜单"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </header>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <aside
              className="h-full w-64 bg-sidebar"
              onClick={(e) => e.stopPropagation()}
              role="navigation"
              aria-label="主导航"
            >
              <div className="flex h-16 items-center gap-2 border-b px-6">
                <span className="text-2xl" aria-hidden="true">🏠</span>
                <span className="text-lg font-bold">收租佬 V6</span>
              </div>
              <nav className="flex-1 space-y-1 overflow-y-auto p-4" aria-label="页面导航">
                {topLevelNavItems.map((item) => (
                  <MobileNavLink key={item.to} item={item} onClick={() => setSidebarOpen(false)} />
                ))}
                <div className="my-2 border-t border-sidebar-border" />
                {navGroups.map((group) => (
                  <MobileSidebarGroup
                    key={group.title}
                    group={group}
                    isOpen={openGroups.has(group.title)}
                    onToggle={() => toggleGroup(group.title)}
                    onItemClick={() => setSidebarOpen(false)}
                  />
                ))}
                <div className="my-2 border-t border-sidebar-border" />
                {bottomNavItems.map((item) => (
                  <MobileNavLink key={item.to} item={item} onClick={() => setSidebarOpen(false)} />
                ))}
              </nav>
              <div className="border-t p-4 safe-bottom">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  退出登录
                </Button>
              </div>
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main id="main-content" className="flex-1 overflow-auto p-4 lg:p-6" role="main">
          <Breadcrumb />
          <Outlet />
        </main>
      </div>

      {/* Toast notifications */}
      <Toaster />
    </div>
  );
}

// ── Mobile Navigation Components ──

function MobileNavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const location = useLocation();
  const Icon = item.icon;
  const isActive = location.pathname === item.to;

  return (
    <Link
      to={item.to}
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
        isActive
          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
      )}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function MobileSidebarGroup({
  group,
  isOpen,
  onToggle,
  onItemClick,
}: {
  group: NavGroup;
  isOpen: boolean;
  onToggle: () => void;
  onItemClick?: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        aria-expanded={isOpen}
      >
        <span>{group.title}</span>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        )}
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-200 ease-in-out',
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="space-y-1 pl-2 pt-1">
          {group.items.map((item) => (
            <MobileNavLink key={item.to} item={item} onClick={onItemClick} />
          ))}
        </div>
      </div>
    </div>
  );
}

