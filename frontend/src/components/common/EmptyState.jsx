import { Inbox } from 'lucide-react';
import { cn } from '@/utils/cn';

function EmptyState({ title, description, action, icon: Icon = Inbox, className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center',
        className
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground/70">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-base font-medium text-foreground">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export { EmptyState };
