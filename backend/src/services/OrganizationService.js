import OrganizationRepository from '../repositories/OrganizationRepository.js';
import AuditService from './AuditService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';

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
    Object.assign(org, payload, { updatedBy: actorId });
    await org.save();
    await this.auditService.record(AUDIT_ACTIONS.ORGANIZATION_UPDATED, { actorId, req });
    return org.toSafeObject();
  }

  /** ORG-006 — fields a branch is allowed to override; anything else must come from the org. */
  async getOverridableFields() {
    const org = await this.organizationRepository.getSingleton();
    return org.branchOverridableFields;
  }
}

export default OrganizationService;
