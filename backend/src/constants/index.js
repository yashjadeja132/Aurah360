export { HTTP_STATUS } from './httpStatus.js';
export { ROLES, ROLE_LIST, ROLE_LABELS } from './roles.js';
export {
  PERMISSIONS,
  PERMISSION_LIST,
  PERMISSION_CATALOG,
} from './permissions.js';
export { ROLE_PERMISSIONS } from './rolePermissions.js';
export {
  MASTER_TYPES,
  MASTER_TYPE_LIST,
  MASTER_TYPE_LABELS,
  MASTER_SLUG_TO_TYPE,
  MASTER_TYPE_TO_SLUG,
} from './masterTypes.js';

export const COOKIE_NAMES = Object.freeze({
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  CSRF_TOKEN: 'csrf_token',
});

export const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
});

export const ENTITY_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
});
