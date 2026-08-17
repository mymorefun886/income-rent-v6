// Theme toggle component
import { Moon, Sun, Monitor } from 'lucide-react';
import { useThemeStore } from '@/stores/theme';
import { Button } from '@/components/ui/Button';

export function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();

  const cycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  const icons = {
    light: <Sun className="h-4 w-4" />,
    dark: <Moon className="h-4 w-4" />,
    system: <Monitor className="h-4 w-4" />,
  };

  const labels = {
    light: '浅色模式',
    dark: '深色模式',
    system: '跟随系统',
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      title={labels[theme]}
      aria-label={`当前主题: ${labels[theme]}，点击切换`}
    >
      {icons[theme]}
    </Button>
  );
}
