import { useEffect, useRef } from 'react';
import { subscribeInsert } from '../insertBus';

/**
 * Register the calling form as the receiver for AI-accepted text aimed at `target`.
 * The handler is held in a ref so callers can pass an inline closure over current state
 * without re-subscribing (and re-flushing the queue) on every render.
 */
export function useInsertTarget(target, handler, enabled = true) {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    if (!enabled || !target) return undefined;
    return subscribeInsert(target, (payload) => ref.current?.(payload));
  }, [target, enabled]);
}

export default useInsertTarget;
