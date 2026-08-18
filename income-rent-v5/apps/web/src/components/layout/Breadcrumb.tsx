// Breadcrumb component for navigation path
import { useLocation, Link } from '@tanstack/react-router';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

// Map of paths to human-readable labels
const PATH_LABELS: Record<string, string> = {
  '/': '首页',
  '/properties': '房源',
  '/tenants': '租客',
  '/contracts': '合同',
  '/records': '账单',
  '/payments': '收款',
  '/transactions': '交易',
  '/expenses': '支出',
  '/work-orders': '工单',
  '/meter-input': '手机抄表',
  '/utility-bills': '水电费盈亏',
  '/meter-drafts': '抄表管理',
  '/message-logs': '消息日志',
  '/wechat-bot': '微信 Bot',
  '/receipts': '收據單',
  '/reminders': '提醒',
  '/reports': '报表',
  '/settings': '设置',
};

interface BreadcrumbItem {
  label: string;
  path: string;
  isLast: boolean;
}

function buildBreadcrumbs(pathname: string): BreadcrumbItem[] {
  // Home is always first
  const items: BreadcrumbItem[] = [
    { label: '首页', path: '/', isLast: pathname === '/' },
  ];

  // If not home, add the current page
  if (pathname !== '/' && PATH_LABELS[pathname]) {
    items.push({
      label: PATH_LABELS[pathname],
      path: pathname,
      isLast: true,
    });
  }

  return items;
}

export function Breadcrumb() {
  const location = useLocation();
  const breadcrumbs = buildBreadcrumbs(location.pathname);

  // Don't show breadcrumb on home page or login page
  if (location.pathname === '/' || location.pathname === '/login') {
    return null;
  }

  return (
    <nav aria-label="面包屑导航" className="mb-4">
      <ol className="flex items-center gap-1 text-sm text-muted-foreground">
        {breadcrumbs.map((item, index) => (
          <li key={item.path} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="h-4 w-4" aria-hidden="true" />}
            {item.isLast ? (
              <span className="font-medium text-foreground" aria-current="page">
                {item.label}
              </span>
            ) : (
              <Link
                to={item.path}
                className="hover:text-foreground transition-colors flex items-center gap-1"
              >
                {item.path === '/' && <Home className="h-4 w-4" aria-hidden="true" />}
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
