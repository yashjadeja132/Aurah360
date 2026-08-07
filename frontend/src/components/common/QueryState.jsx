import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';

/**
 * Shared loading / error / empty states for React Query pages.
 */
export function QueryState({
  isLoading,
  isError,
  error,
  isEmpty,
  emptyTitle = 'No results',
  emptyDescription = 'Nothing to show yet.',
  onRetry,
  children,
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-2/3" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div>
          <p className="text-destructive">{error?.message || error?.response?.data?.message || 'Something went wrong.'}</p>
          {onRetry && (
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
              Retry
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return children;
}

export default QueryState;
