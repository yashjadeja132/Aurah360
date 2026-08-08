import OrganizationRepository from '../repositories/OrganizationRepository.js';
import AuditService from './AuditService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import ApiError from '../libs/ApiError.js';
import { refreshOrgRuntime } from '../config/orgRuntime.js';
import { ORG_SHADOWED_BRANCH_FIELD_SET } from '../constants/branchOverrides.js';

/** Organization master (ORG-001, ORG-006) — a singleton document all branches inherit from. */
class OrganizationService {
  constructor() {
    this.organizationRepository = new OrganizationRepository();
    this.auditService = new AuditService();
  }

  async get() {
    const org = await this.organizationRepository.getSingleton();
    return org.toSafeObject();
  }

  async update(payload, actorId, req = null) {
    const org = await this.organizationRepository.getSingleton();
    const updates = { ...payload };
    if (updates.invoicePrefix) updates.invoicePrefix = updates.invoicePrefix.trim().toUpperCase();
    Object.assign(org, updates, { updatedBy: actorId });
    await org.save();
    // Push the new timezone / financial-year values into the synchronous runtime mirror straight
    // away, so the very next report request already uses them.
    refreshOrgRuntime(org);
    await this.auditService.record(AUDIT_ACTIONS.ORGANIZATION_UPDATED, { actorId, req });
    return org.toSafeObject();
  }

  /** ORG-006 — org-shadowed fields a branch is allowed to override; anything else must come
   *  from the org. Consumed by BranchService.update()/updateSettings(). */
  async getOverridableFields() {
    const org = await this.organizationRepository.getSingleton();
    return org.branchOverridableFields || [];
  }

  /**
   * ORG-006 enforcement point. Throws 403 if `payloadKeys` touches an org-shadowed branch field
   * (constants/branchOverrides.js) that the organization has not opened for branch override.
   * Branch-identity fields (name, address, phone, …) are not org-shadowed and always pass.
   */
  async assertBranchOverridesAllowed(payloadKeys = []) {
    const shadowed = payloadKeys.filter((k) => ORG_SHADOWED_BRANCH_FIELD_SET.has(k));
    if (!shadowed.length) return;
    const allowed = new Set(await this.getOverridableFields());
    const blocked = shadowed.filter((k) => !allowed.has(k));
    if (blocked.length) {
      throw ApiError.forbidden(
        `This branch may not override organization-level ${blocked.join(', ')}. `
          + 'Change it on the organization, or add it to branchOverridableFields.'
      );
    }
  }

  /** Invoice presentation settings, read fresh by the billing/print paths. */
  async getInvoiceSettings() {
    const org = await this.organizationRepository.getSingleton();
    return {
      invoicePrefix: (org.invoicePrefix || 'INV').trim().toUpperCase(),
      invoiceFooterNote: org.invoiceFooterNote || null,
    };
  }
}

export default OrganizationService;
