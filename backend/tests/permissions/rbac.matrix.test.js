import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS } from '../../src/constants/rolePermissions.js';
import { PERMISSIONS } from '../../src/constants/permissions.js';
import { ROLES } from '../../src/constants/roles.js';
import { hasAnyPermission } from '../../src/helpers/permission.helper.js';

/**
 * Real RBAC matrix probes against the actual role→permission map (SEC-001, NFR-018).
 * No live server needed — this is the same lookup requirePermission() performs at request time.
 */
describe('RBAC permission matrix', () => {
  const grantedFor = (role) => (role === ROLES.OWNER ? ['*'] : ROLE_PERMISSIONS[role] || []);

  it('Owner is granted every sensitive action via wildcard', () => {
    expect(hasAnyPermission(grantedFor(ROLES.OWNER), [PERMISSIONS.BILLING_REFUND])).toBe(true);
    expect(hasAnyPermission(grantedFor(ROLES.OWNER), [PERMISSIONS.AI_GOVERNANCE_MANAGE])).toBe(true);
    expect(hasAnyPermission(grantedFor(ROLES.OWNER), [PERMISSIONS.BREAK_GLASS])).toBe(true);
  });

  it('Receptionist cannot finalize billing or view the executive dashboard', () => {
    expect(hasAnyPermission(grantedFor(ROLES.RECEPTIONIST), [PERMISSIONS.BILLING_FINALIZE])).toBe(false);
    expect(hasAnyPermission(grantedFor(ROLES.RECEPTIONIST), [PERMISSIONS.DASHBOARD_VIEW])).toBe(false);
  });

  it('Receptionist can view/create appointments and check patients in', () => {
    expect(hasAnyPermission(grantedFor(ROLES.RECEPTIONIST), [PERMISSIONS.APPOINTMENTS_VIEW, PERMISSIONS.APPOINTMENTS_ALL])).toBe(true);
    expect(hasAnyPermission(grantedFor(ROLES.RECEPTIONIST), [PERMISSIONS.RECEPTION_CHECKIN])).toBe(true);
  });

  it('Doctor cannot adjust stock or approve inventory transfers', () => {
    expect(hasAnyPermission(grantedFor(ROLES.DOCTOR), [PERMISSIONS.STOCK_ADJUST])).toBe(false);
    expect(hasAnyPermission(grantedFor(ROLES.DOCTOR), [PERMISSIONS.INVENTORY_TRANSFER_APPROVE])).toBe(false);
  });

  it('Doctor can sign consultations and resolve adverse events', () => {
    expect(hasAnyPermission(grantedFor(ROLES.DOCTOR), [PERMISSIONS.CONSULTATION_SIGN, PERMISSIONS.CONSULTATION_ALL])).toBe(true);
    expect(hasAnyPermission(grantedFor(ROLES.DOCTOR), [PERMISSIONS.ADVERSE_EVENT_RESOLVE])).toBe(true);
  });

  it('Cashier is scoped to billing and cannot touch clinical records', () => {
    expect(hasAnyPermission(grantedFor(ROLES.CASHIER), [PERMISSIONS.BILLING_ALL])).toBe(true);
    expect(hasAnyPermission(grantedFor(ROLES.CASHIER), [PERMISSIONS.CONSULTATION_VIEW, PERMISSIONS.CONSULTATION_ALL])).toBe(false);
  });

  it('CRM executive cannot access restricted clinical content (§16.2)', () => {
    expect(hasAnyPermission(grantedFor(ROLES.CRM_EXECUTIVE), [PERMISSIONS.CLINICAL_VIEW, PERMISSIONS.CLINICAL_ALL])).toBe(false);
  });

  it('every role in ROLES has a defined entry in ROLE_PERMISSIONS (no silently-unscoped role)', () => {
    for (const role of Object.values(ROLES)) {
      if (role === ROLES.OWNER) continue; // Owner uses the wildcard shortcut, not a list
      expect(Array.isArray(ROLE_PERMISSIONS[role])).toBe(true);
      expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
    }
  });
});
