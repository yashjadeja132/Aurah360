/**
 * Permission matching with wildcard support.
 * - Exact: users.view
 * - Module wildcard: users.* matches users.view
 * - Global: * matches everything (Owner)
 */
export function permissionMatches(granted, required) {
  if (!granted || !required) return false;
  if (granted === '*' || granted === required) return true;

  if (granted.endsWith('.*')) {
    const prefix = granted.slice(0, -1); // "users."
    return required.startsWith(prefix) || required === granted.slice(0, -2);
  }

  return false;
}

export function hasPermission(grantedList = [], required) {
  if (!required) return true;
  return grantedList.some((g) => permissionMatches(g, required));
}

export function hasAnyPermission(grantedList = [], requiredList = []) {
  if (!requiredList.length) return true;
  return requiredList.some((req) => hasPermission(grantedList, req));
}

export function hasAllPermissions(grantedList = [], requiredList = []) {
  if (!requiredList.length) return true;
  return requiredList.every((req) => hasPermission(grantedList, req));
}

/**
 * Merge role permissions with optional user overrides (union).
 */
export function resolveEffectivePermissions(rolePermissions = [], overrides = []) {
  const set = new Set([...(rolePermissions || []), ...(overrides || [])]);
  return [...set];
}

export default {
  permissionMatches,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  resolveEffectivePermissions,
};
