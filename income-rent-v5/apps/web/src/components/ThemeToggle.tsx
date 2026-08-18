// Theme toggle component - segmented control showing all 3 options
import { Moon, Sun, Monitor } from 'lucide-react';
import { useThemeStore } from '@/stores/theme';
import { cn } from '@/lib/utils';

type Theme = 'light' | 'dark' | 'system';

const themes: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: 'light', icon: Sun, label: '浅色' },
  { value: 'dark', icon: Moon, label: '深色' },
  { value: 'system', icon: Monitor, label: '系统' },
];

export function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();

  return (
    <div
      className="inline-flex items-center rounded-lg border border-input bg-background p-1"
      role="radiogroup"
      aria-label="主题选择"
    >
      {themes.map(({ value, icon: Icon, label }) => {
        const isActive = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
