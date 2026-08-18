// Toast store and hook for notifications
import { create } from 'zustand';
import { ToastProps, ToastActionElement } from '@/components/ui/Toast';

type ToastVariant = 'default' | 'destructive' | 'success' | 'warning';

type ToastItem = {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  action?: ToastActionElement;
  duration?: number;
};

type ToastStore = {
  toasts: ToastItem[];
  toast: (props: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: string) => void;
};

let toastCount = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  toast: ({ ...props }) => {
    const id = `toast-${++toastCount}`;
    set((state) => ({
      toasts: [...state.toasts, { id, ...props }],
    }));

    // Auto dismiss
    const duration = props.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
  },
  dismiss: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

// Convenience hook
export function useToast() {
  const { toast, dismiss } = useToastStore();
  return { toast, dismiss };
}
