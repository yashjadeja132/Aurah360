/**
 * Skeleton — PermissionGuard render tests.
 *
 * Cases:
 * - loading → shows checking message
 * - missing perm + redirect → Navigate
 * - has perm → renders children
 * - owner * → renders children
 */
export const plan = ['loading', 'denied_redirect', 'allowed', 'owner_wildcard'];
