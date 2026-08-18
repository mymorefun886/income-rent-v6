// Form field components for accessible forms
import * as React from 'react';
import { createContext, useContext, useId } from 'react';
import { cn } from '@/lib/utils';
import { Label } from './Label';

// Form item context
type FormItemContextValue = { id: string };

const FormItemContext = createContext<FormItemContextValue>({ id: '' });

function useFormField() {
  const itemContext = useContext(FormItemContext);
  return { id: itemContext.id };
}

// FormItem wrapper - provides ID context for label/control/error association
function FormItem({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const id = useId();
  return (
    <FormItemContext.Provider value={{ id }}>
      <div className={cn('space-y-2', className)} {...props} />
    </FormItemContext.Provider>
  );
}

// FormLabel - automatically associates with control via htmlFor
function FormLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof Label>) {
  const { id } = useFormField();
  return <Label className={className} htmlFor={id} {...props} />;
}

// FormControl - passes id to control for label association
function FormControl({ ...props }: React.Attributes & { children?: React.ReactNode }) {
  const { id } = useFormField();
  return (
    <div
      id={id}
      aria-describedby={undefined}
      {...props}
    />
  );
}

// FormMessage - error message with aria-live
function FormMessage({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  const { id } = useFormField();
  if (!children) return null;
  return (
    <p
      id={`${id}-message`}
      className={cn('text-sm font-medium text-destructive', className)}
      role="alert"
      aria-live="polite"
      {...props}
    >
      {children}
    </p>
  );
}

// FormDescription - hint text
function FormDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  const { id } = useFormField();
  return (
    <p
      id={`${id}-description`}
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export { useFormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription };
