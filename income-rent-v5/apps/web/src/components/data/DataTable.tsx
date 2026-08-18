// Responsive DataTable component - switches between table (desktop) and card (mobile)
import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

export type ColumnPriority = 'high' | 'medium' | 'low';

export interface Column<T> {
  key: string;
  header: string;
  priority?: ColumnPriority; // default: 'medium'
  render: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  emptyState?: React.ReactNode;
  loading?: boolean;
  sortable?: boolean;
  onSort?: (key: string) => void;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyState,
  loading = false,
  sortable = false,
  onSort,
  sortKey,
  sortDirection,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse bg-muted rounded-lg" />
        ))}
      </div>
    );
  }

  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  // Filter columns by priority for mobile
  const highPriorityColumns = columns.filter(
    (col) => (col.priority ?? 'medium') === 'high'
  );
  const mediumPriorityColumns = columns.filter(
    (col) => (col.priority ?? 'medium') === 'medium'
  );
  const lowPriorityColumns = columns.filter(
    (col) => (col.priority ?? 'medium') === 'low'
  );

  // Mobile shows high + medium priority columns
  const mobileColumns = [...highPriorityColumns, ...mediumPriorityColumns];

  return (
    <>
      {/* Desktop Table (hidden on mobile) */}
      <div className="hidden md:block rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-left font-medium text-muted-foreground',
                    sortable && onSort && 'cursor-pointer hover:text-foreground select-none',
                    col.className
                  )}
                  onClick={() => sortable && onSort?.(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {sortable && sortKey === col.key && (
                      <span className="ml-1">
                        {sortDirection === 'asc' ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                className="border-b hover:bg-muted/30 transition-colors"
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-3', col.className)}>
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Card Grid (mobile only) */}
      <div className="md:hidden space-y-3">
        {data.map((item) => (
          <div
            key={keyExtractor(item)}
            className="rounded-lg border bg-card p-4 space-y-2"
          >
            {mobileColumns.map((col) => (
              <div key={col.key} className="flex justify-between gap-2">
                <span className="text-xs text-muted-foreground shrink-0">
                  {col.header}
                </span>
                <span className="text-sm text-right">{col.render(item)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
