/**
 * Lightweight Module 1 smoke checks that do not require MongoDB.
 */
import { permissionMatches, hasPermission, hasAnyPermission, resolveEffectivePermissions } from '../helpers/permission.helper.js';
import { ROLES, ROLE_LIST } from '../constants/roles.js';
import { PERMISSION_CATALOG, PERMISSIONS } from '../constants/permissions.js';
import { ROLE_PERMISSIONS } from '../constants/rolePermissions.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERT FAILED: ${message}`);
  }
}

assert(ROLE_LIST.includes(ROLES.OWNER), 'Owner role exists');
assert(ROLE_LIST.includes(ROLES.CASHIER), 'Cashier role exists');
assert(ROLE_LIST.length === 10, 'Exactly 10 system roles');

assert(permissionMatches('users.*', 'users.view'), 'wildcard users.* matches users.view');
assert(permissionMatches('*', 'billing.refund'), 'global * matches anything');
assert(!permissionMatches('users.view', 'users.create'), 'exact mismatch fails');
assert(hasPermission(['patients.*'], 'patients.edit'), 'hasPermission wildcard');
assert(hasAnyPermission(['billing.view'], ['users.create', 'billing.view']), 'hasAnyPermission');

const merged = resolveEffectivePermissions(['users.view'], ['users.edit', 'users.view']);
assert(merged.includes('users.edit') && merged.includes('users.view'), 'permission merge');

assert(ROLE_PERMISSIONS[ROLES.OWNER].length > 0, 'Owner has permissions');
assert(PERMISSION_CATALOG.some((p) => p.key === PERMISSIONS.USERS_CREATE), 'catalog has users.create');

console.log('Module 1 unit smoke checks passed.');
