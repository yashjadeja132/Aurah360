import { describe, it, expect } from 'vitest';
import { hasAnyPermission, hasAllPermissions, permissionMatches } from '../../src/helpers/permission.helper.js';

describe('permission.helper', () => {
  it('owner wildcard grants all', () => {
    expect(hasAnyPermission(['*'], ['billing.view'])).toBe(true);
  });

  it('module wildcard grants child permission', () => {
    expect(hasAnyPermission(['reports.*'], ['reports.export'])).toBe(true);
  });

  it('module wildcard also matches the bare module key', () => {
    expect(permissionMatches('reports.*', 'reports')).toBe(true);
  });

  it('missing permission is denied', () => {
    expect(hasAnyPermission(['patients.view'], ['billing.payment'])).toBe(false);
  });

  it('empty required list is always granted (no restriction)', () => {
    expect(hasAnyPermission(['patients.view'], [])).toBe(true);
  });

  it('hasAllPermissions requires every listed permission', () => {
    expect(hasAllPermissions(['billing.view', 'billing.create'], ['billing.view', 'billing.create'])).toBe(true);
    expect(hasAllPermissions(['billing.view'], ['billing.view', 'billing.create'])).toBe(false);
  });

  it('does not partially match unrelated modules', () => {
    expect(hasAnyPermission(['billingx.*'], ['billing.view'])).toBe(false);
  });
});
