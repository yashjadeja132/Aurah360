/**
 * Client-side permission helpers (UI only — server remains authoritative).
 */
export function permissionMatches(granted, required) {
  if (!granted || !required) return false;
  if (granted === '*' || granted === required) return true;
  if (granted.endsWith('.*')) {
    const prefix = granted.slice(0, -1);
    return required.startsWith(prefix);
  }
  return false;
}

export function hasPermission(grantedList = [], required) {
  return (grantedList || []).some((g) => permissionMatches(g, required));
}

export function hasAnyPermission(grantedList = [], requiredList = []) {
  if (!requiredList?.length) return true;
  return requiredList.some((req) => hasPermission(grantedList, req));
}

export default { hasPermission, hasAnyPermission, permissionMatches };
