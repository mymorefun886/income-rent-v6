// Badge UI Component
import { cn } from '@/lib/utils';

export type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeProps['variant'] & string, string> = {
  default: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  outline: 'border border-input bg-background',
  destructive: 'bg-destructive text-destructive-foreground',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
