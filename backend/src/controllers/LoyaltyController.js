import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import LoyaltyAdminService from '../services/LoyaltyAdminService.js';
import LoyaltyLedgerService from '../services/LoyaltyLedgerService.js';
import { hasAnyPermission } from '../helpers/permission.helper.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { ROLES } from '../constants/roles.js';
import { scopedListQuery, resolveRecordScope } from '../helpers/scope.helper.js';
import { assertPatientInScope } from '../helpers/patientScope.helper.js';

/**
 * SEC-030 — row-level scoping, applied selectively and deliberately.
 *
 * SCOPED (these rows have a real, meaningful branch dimension):
 *   - the manual-adjustment approval queue and its approve/reject decisions
 *     (`LoyaltyAdjustmentRequest.branchId` is required — the queue IS a branch worklist), and
 *   - the reports dashboard, which already accepted a `branchId` filter and was honouring
 *     whatever the client sent.
 *
 * DELIBERATELY NOT BRANCH-SCOPED — a patient's POINTS FOLLOW THE PATIENT, NOT A BRANCH. Points
 * earned at Branch A are redeemable at Branch B; that is the whole promise of the programme.
 * Filtering `LoyaltyLedgerEntry.branchId` down to the caller's branch would show a cashier a
 * partial balance and let them redeem against points the patient does not have there — a money
 * bug, not a security fix. So balance / ledger / tier / adjustment-creation return the patient's
 * COMPLETE cross-branch position, and the scope check is applied to the PATIENT instead: the
 * caller must have a branch relationship with them (`assertPatientInScope`). That closes the real
 * hole (any LOYALTY_BALANCE_VIEW holder could read any patient in the org by id) without
 * breaking cross-branch redemption.
 *
 * ALSO NOT SCOPED — settings, earning rules, tiers and campaigns are organisation-wide PROGRAMME
 * CONFIGURATION, not per-branch data. They carry no `branchId` column at all (campaigns/rules
 * carry a `branchIds[]` TARGETING array, where `[]` means "all branches"), contain no PHI, and are
 * authored centrally. Pinning them would hide a branch's own governing rules from it.
 */
class LoyaltyController {
  constructor() {
    this.adminService = new LoyaltyAdminService();
    this.ledgerService = new LoyaltyLedgerService();
  }

  getSettings = asyncHandler(async (req, res) => {
    const data = await this.adminService.getSettings();
    return ApiResponse.success(res, { data });
  });

  updateSettings = asyncHandler(async (req, res) => {
    const data = await this.adminService.updateSettings(req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Loyalty settings updated', data });
  });

  listRules = asyncHandler(async (req, res) => {
    const data = await this.adminService.listRules(req.query);
    return ApiResponse.success(res, { data });
  });

  getRule = asyncHandler(async (req, res) => {
    const data = await this.adminService.getRule(req.params.id);
    return ApiResponse.success(res, { data });
  });

  createRule = asyncHandler(async (req, res) => {
    const data = await this.adminService.createRule(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Loyalty rule created', data });
  });

  addRuleVersion = asyncHandler(async (req, res) => {
    const data = await this.adminService.addRuleVersion(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Rule version added', data });
  });

  /** LOY-002 — dry-run preview of a rule-version draft. Reads only; nothing is persisted. */
  previewRule = asyncHandler(async (req, res) => {
    const data = await this.adminService.previewRuleVersion(req.body);
    return ApiResponse.success(res, { message: 'Dry-run preview — nothing was saved', data });
  });

  listTiers = asyncHandler(async (req, res) => {
    const data = await this.adminService.listTiers();
    return ApiResponse.success(res, { data });
  });

  createTier = asyncHandler(async (req, res) => {
    const data = await this.adminService.upsertTier(null, req.body);
    return ApiResponse.created(res, { message: 'Loyalty tier created', data });
  });

  updateTier = asyncHandler(async (req, res) => {
    const data = await this.adminService.upsertTier(req.params.id, req.body);
    return ApiResponse.success(res, { message: 'Loyalty tier updated', data });
  });

  listCampaigns = asyncHandler(async (req, res) => {
    const data = await this.adminService.listCampaigns(req.query);
    return ApiResponse.success(res, { data });
  });

  createCampaign = asyncHandler(async (req, res) => {
    const data = await this.adminService.createCampaign(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Loyalty campaign created', data });
  });

  updateCampaignStatus = asyncHandler(async (req, res) => {
    const data = await this.adminService.updateCampaignStatus(req.params.id, req.body.status, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Campaign status updated', data });
  });

  listAdjustmentQueue = asyncHandler(async (req, res) => {
    const data = await this.adminService.listAdjustmentQueue(await scopedListQuery(req, { branch: true }));
    return ApiResponse.success(res, { data });
  });

  approveAdjustment = asyncHandler(async (req, res) => {
    const { branchId } = await resolveRecordScope(req, { branch: true, doctor: false });
    const data = await this.adminService.approveAdjustment(req.params.id, req.body, req.auth.userId, req, branchId);
    return ApiResponse.success(res, { message: 'Adjustment approved', data });
  });

  rejectAdjustment = asyncHandler(async (req, res) => {
    const { branchId } = await resolveRecordScope(req, { branch: true, doctor: false });
    const data = await this.adminService.rejectAdjustment(req.params.id, req.body, req.auth.userId, req, branchId);
    return ApiResponse.success(res, { message: 'Adjustment rejected', data });
  });

  getPatientBalance = asyncHandler(async (req, res) => {
    await assertPatientInScope(req, req.params.patientId, 'Patient not found');
    const data = await this.ledgerService.getBalance(req.params.patientId);
    return ApiResponse.success(res, { data });
  });

  getPatientLedger = asyncHandler(async (req, res) => {
    await assertPatientInScope(req, req.params.patientId, 'Patient not found');
    // `before` = cursor mode (patient app); otherwise page mode (staff patient-360 panel).
    if (req.query.before) {
      const data = await this.ledgerService.listLedger(req.params.patientId, req.query);
      return ApiResponse.success(res, { data });
    }
    const { items, meta } = await this.adminService.listPatientLedger(req.params.patientId, req.query);
    return ApiResponse.success(res, { data: items, meta });
  });

  getPatientTierProgress = asyncHandler(async (req, res) => {
    await assertPatientInScope(req, req.params.patientId, 'Patient not found');
    const data = await this.adminService.getPatientTierProgress(req.params.patientId);
    return ApiResponse.success(res, { data });
  });

  createPatientAdjustment = asyncHandler(async (req, res) => {
    await assertPatientInScope(req, req.params.patientId, 'Patient not found');
    const canAutoApply =
      req.auth?.role === ROLES.OWNER || hasAnyPermission(req.auth?.permissions || [], [PERMISSIONS.LOYALTY_ADJUST_APPROVE]);
    const data = await this.adminService.createPatientAdjustment(
      req.params.patientId,
      req.body,
      req.auth,
      req,
      canAutoApply
    );
    // Read the outcome off the request, not off canAutoApply: an approver's own adjustment is
    // still queued when it exceeds their role's configured point limit.
    return ApiResponse.created(res, {
      message: data.status === 'APPLIED' ? 'Adjustment applied' : 'Adjustment submitted for approval',
      data,
    });
  });

  getDashboardSummary = asyncHandler(async (req, res) => {
    const data = await this.adminService.getDashboardSummary(await scopedListQuery(req, { branch: true }));
    return ApiResponse.success(res, { data });
  });
}

export default LoyaltyController;
