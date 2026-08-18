// Unit tests for Sidebar component
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Home, Building2, Receipt } from 'lucide-react';

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>{children}</a>
  ),
  useLocation: () => ({ pathname: '/' }),
}));

const topLevelItems = [
  { to: '/', icon: Home, label: '首页' },
];

const groups = [
  {
    title: '租务管理',
    items: [
      { to: '/properties', icon: Building2, label: '房源' },
    ],
  },
  {
    title: '财务管理',
    items: [
      { to: '/records', icon: Receipt, label: '账单' },
    ],
  },
];

describe('Sidebar', () => {
  it('should render top-level items', () => {
    render(
      <Sidebar
        groups={groups}
        topLevelItems={topLevelItems}
        openGroups={new Set()}
        onToggleGroup={() => {}}
      />
    );
    expect(screen.getByText('首页')).toBeInTheDocument();
  });

  it('should render group titles', () => {
    render(
      <Sidebar
        groups={groups}
        topLevelItems={topLevelItems}
        openGroups={new Set()}
        onToggleGroup={() => {}}
      />
    );
    expect(screen.getByText('租务管理')).toBeInTheDocument();
    expect(screen.getByText('财务管理')).toBeInTheDocument();
  });

  it('should show group items when open', () => {
    render(
      <Sidebar
        groups={groups}
        topLevelItems={topLevelItems}
        openGroups={new Set(['租务管理'])}
        onToggleGroup={() => {}}
      />
    );
    expect(screen.getByText('房源')).toBeInTheDocument();
  });

  it('should toggle group on click', () => {
    const onToggleGroup = vi.fn();
    render(
      <Sidebar
        groups={groups}
        topLevelItems={topLevelItems}
        openGroups={new Set()}
        onToggleGroup={onToggleGroup}
      />
    );
    fireEvent.click(screen.getByText('租务管理'));
    expect(onToggleGroup).toHaveBeenCalledWith('租务管理');
  });

  it('should render bottom items', () => {
    const bottomItems = [
      { to: '/settings', icon: Home, label: '设置' },
    ];
    render(
      <Sidebar
        groups={groups}
        topLevelItems={topLevelItems}
        bottomItems={bottomItems}
        openGroups={new Set()}
        onToggleGroup={() => {}}
      />
    );
    expect(screen.getByText('设置')).toBeInTheDocument();
  });
});
