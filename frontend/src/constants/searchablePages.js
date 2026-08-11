import { APP_ROUTES } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';
import { navGroups } from '@/constants/navGroups';
import { MASTER_NAV } from '@/modules/masters/config/masterConfigs';

/**
 * Flat {title, path, permissions, roles} list for CommandPalette's page-navigation search.
 * Built FROM navGroups (the sidebar's own source of truth) rather than hand-written a second
 * time, so a nav item added/removed/re-gated there is reflected here automatically — the two
 * never drift apart. A short list of extra Settings sub-pages (Branches, Masters catalogue,
 * Treatment Protocols, Suppliers, Consultation Templates) is appended for the same reason
 * SettingsLayout links to them: they live outside the generic nav but are still pages a user
 * with the right permission should be able to jump straight to.
 */
function flattenNavGroups() {
  const pages = [];
  for (const group of navGroups) {
    for (const item of group.items) {
      pages.push({
        title: item.label,
        labelKey: item.labelKey,
        path: item.to,
        permissions: item.permissions,
        roles: item.roles,
      });
    }
  }
  return pages;
}

const settingsSubPages = [
  { title: 'Branches', path: APP_ROUTES.BRANCHES, permissions: [PERMISSIONS.BRANCHES_VIEW, PERMISSIONS.BRANCHES_ALL] },
  ...MASTER_NAV.map((m) => ({
    title: m.title,
    path: `/settings/${m.slug}`,
    permissions: [PERMISSIONS.MASTERS_VIEW, PERMISSIONS.MASTERS_ALL],
  })),
  {
    title: 'Treatment Protocols',
    path: APP_ROUTES.TREATMENT_PROTOCOLS,
    permissions: [PERMISSIONS.TREATMENT_PLAN_VIEW, PERMISSIONS.TREATMENT_PLAN_ALL],
  },
  {
    title: 'Vendors / Suppliers',
    path: APP_ROUTES.SUPPLIERS,
    permissions: [PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_ALL],
  },
  {
    title: 'Consultation Templates',
    path: APP_ROUTES.SETTINGS_CONSULTATION_TEMPLATES,
    permissions: [PERMISSIONS.CONSULTATION_TEMPLATE_MANAGE],
  },
];

export const SEARCHABLE_PAGES = [...flattenNavGroups(), ...settingsSubPages];

/**
 * Same "both gates must pass" rule AppLayout/PermissionGuard use elsewhere in the app:
 * `roles` (if present) is a whitelist, and `permissions` (if present) requires the user hold
 * at least one. Reusing this here — rather than re-deriving a third permission-check — is what
 * keeps the palette's page list scoped to exactly what the sidebar would show this user.
 */
export function isPageVisible(page, user, hasAnyPermission) {
  const roleOk = !page.roles || page.roles.includes(user?.role);
  const permOk = !page.permissions || hasAnyPermission(user?.permissions, page.permissions);
  return roleOk && permOk;
}

export default SEARCHABLE_PAGES;
