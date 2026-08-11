import { createContext, forwardRef, useContext, useEffect, useId, useRef } from 'react';
import { cn } from '@/utils/cn';

const DialogContext = createContext(null);

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const DialogOverlay = forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px]', className)}
    {...props}
  />
));
DialogOverlay.displayName = 'DialogOverlay';

function Dialog({ open, onOpenChange, children, variant = 'center' }) {
  const titleId = useId();
  const triggerRef = useRef(null);

  useEffect(() => {
    if (open) {
      // Remember the element that had focus before the dialog opened so we
      // can restore focus to it once the dialog closes (e.g. the trigger).
      triggerRef.current = document.activeElement;
    } else if (triggerRef.current && typeof triggerRef.current.focus === 'function') {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [open]);

  if (!open) return null;

  // `variant="drawer"` docks the panel to the right edge, full viewport height —
  // used by side-drawer flows (e.g. master detail) instead of a brand-new primitive.
  const isDrawer = variant === 'drawer';
  const wrapperClassName = isDrawer
    ? 'fixed inset-0 z-50 flex justify-end'
    : 'fixed inset-0 z-50 flex items-center justify-center p-4';
  const containerClassName = isDrawer
    ? 'relative z-50 h-full w-full max-w-md sm:max-w-lg'
    : 'relative z-50 w-full max-w-lg';

  return (
    <DialogContext.Provider value={{ titleId, onOpenChange }}>
      <div className={wrapperClassName}>
        <DialogOverlay onClick={() => onOpenChange?.(false)} />
        <div className={containerClassName}>{children}</div>
      </div>
    </DialogContext.Provider>
  );
}

function DialogContent({ className, children, ...props }) {
  const { titleId, onOpenChange } = useContext(DialogContext) ?? {};
  const contentRef = useRef(null);

  useEffect(() => {
    const node = contentRef.current;
    if (!node) return undefined;

    // Focus the dialog (or its first focusable descendant) when it mounts.
    const focusable = node.querySelectorAll(FOCUSABLE_SELECTOR);
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      node.focus();
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onOpenChange?.(false);
        return;
      }

      if (event.key === 'Tab') {
        const focusables = Array.from(node.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
          (el) => !el.hasAttribute('disabled')
        );
        if (focusables.length === 0) {
          event.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    node.addEventListener('keydown', handleKeyDown);
    return () => node.removeEventListener('keydown', handleKeyDown);
  }, [onOpenChange]);

  return (
    <div
      ref={contentRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className={cn(
        'rounded-xl border bg-card p-6 text-card-foreground shadow-lg outline-none',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function DialogHeader({ className, ...props }) {
  return <div className={cn('mb-4 flex flex-col space-y-1.5', className)} {...props} />;
}

function DialogTitle({ className, id, ...props }) {
  const { titleId } = useContext(DialogContext) ?? {};
  return (
    <h2 id={id ?? titleId} className={cn('text-lg font-semibold tracking-tight', className)} {...props} />
  );
}

function DialogDescription({ className, ...props }) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

function DialogFooter({ className, ...props }) {
  return <div className={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />;
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter };
