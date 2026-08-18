// AlertDialog component for destructive confirmations (shadcn/ui)
import * as React from 'react';
import { buttonVariants } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { cn } from '@/lib/utils';

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  cancelText?: string;
  confirmText?: string;
  onConfirm: () => void;
  variant?: 'destructive' | 'default';
  loading?: boolean;
}

export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  cancelText = '取消',
  confirmText = '确认',
  onConfirm,
  variant = 'default',
  loading = false,
}: AlertDialogProps) {
  const isDestructive = variant === 'destructive';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            className={buttonVariants({ variant: 'outline' })}
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={buttonVariants({ variant: isDestructive ? 'destructive' : 'default' })}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? '处理中...' : confirmText}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
