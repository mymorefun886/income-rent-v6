// Sidebar component with grouped navigation
import { Link, useLocation } from '@tanstack/react-router';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NavItem {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

interface NavLinkProps {
  item: NavItem;
  onClick?: () => void;
}

function NavLink({ item, onClick }: NavLinkProps) {
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

interface SidebarGroupProps {
  group: NavGroup;
  isOpen: boolean;
  onToggle: () => void;
  onItemClick?: () => void;
}

function SidebarGroup({ group, isOpen, onToggle, onItemClick }: SidebarGroupProps) {
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
            <NavLink key={item.to} item={item} onClick={onItemClick} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface SidebarProps {
  groups: NavGroup[];
  topLevelItems: NavItem[];
  bottomItems?: NavItem[];
  openGroups: Set<string>;
  onToggleGroup: (title: string) => void;
  onItemClick?: () => void;
}

export function Sidebar({ groups, topLevelItems, bottomItems = [], openGroups, onToggleGroup, onItemClick }: SidebarProps) {
  return (
    <aside className="flex w-64 flex-col border-r bg-sidebar" role="navigation" aria-label="主导航">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <span className="text-2xl" aria-hidden="true">🏠</span>
        <span className="text-lg font-bold">收租佬 V6</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-4" aria-label="页面导航">
        {/* Top-level items (Dashboard) */}
        {topLevelItems.map((item) => (
          <NavLink key={item.to} item={item} onClick={onItemClick} />
        ))}

        {/* Divider */}
        {topLevelItems.length > 0 && <div className="my-2 border-t border-sidebar-border" />}

        {/* Grouped navigation */}
        {groups.map((group) => (
          <SidebarGroup
            key={group.title}
            group={group}
            isOpen={openGroups.has(group.title)}
            onToggle={() => onToggleGroup(group.title)}
            onItemClick={onItemClick}
          />
        ))}

        {/* Bottom items (Reports, Settings) */}
        {bottomItems.length > 0 && (
          <>
            <div className="my-2 border-t border-sidebar-border" />
            {bottomItems.map((item) => (
              <NavLink key={item.to} item={item} onClick={onItemClick} />
            ))}
          </>
        )}
      </nav>
    </aside>
  );
}
