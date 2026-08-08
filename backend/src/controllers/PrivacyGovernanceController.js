import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import PrivacyGovernanceService from '../services/PrivacyGovernanceService.js';
import { assertPatientInScope, filterRowsToPatientScope } from '../helpers/patientScope.helper.js';

/**
 * SEC-030 — scoping here is patient-anchored, and one endpoint is deliberately left alone.
 *
 * PRIVACY REQUESTS (DSAR/erasure/correction). `PrivacyRequest` has no `branchId` column — the
 * subject of the request is a patient, and the record is about that person, so the branch
 * dimension can only come from the patient. `privacy_request.view` is held by BRANCH_MANAGER,
 * DOCTOR and RECEPTIONIST, all branch-pinned, and all of them could previously list and resolve
 * every DSAR in the organisation — including the free-text `description` and `resolutionNotes`,
 * which routinely name the complaint. The list is now filtered to patients the caller has a
 * branch relationship with, and the single-record verify/resolve writes 404 (never 403) outside
 * it. Scoping to the patient rather than to a registration branch is what keeps a DSAR raised at
 * the branch that actually treated the patient workable there.
 *
 * BREAK-GLASS GRANTS are deliberately NOT scoped:
 *   - `grantBreakGlass` exists precisely to reach a patient the caller has NO relationship with
 *     (an emergency at another branch). A relationship check would defeat the mechanism it is.
 *     It is already gated by BREAK_GLASS + a step-up re-authentication, and every use is audited.
 *   - `listBreakGlassGrants` is the audit review of those uses. It requires BREAK_GLASS or
 *     AUDIT_VIEW, and neither is granted to any branch-pinned role — only OWNER and ADMIN hold
 *     them, and both are unrestricted by design. Narrowing an emergency-access audit trail to one
 *     branch would also hide the cross-branch reaches that are the reason it is reviewed at all.
 */
class PrivacyGovernanceController {
  constructor() {
    this.service = new PrivacyGovernanceService();
  }

  /** Bound patient-scope check handed to the service for single-record reads/writes. */
  #patientGuard(req) {
    return (patientId) => assertPatientInScope(req, patientId, 'Privacy request not found');
  }

  grantBreakGlass = asyncHandler(async (req, res) => {
    const grant = await this.service.grantBreakGlass(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Break-glass access granted', data: { grant } });
  });

  listBreakGlassGrants = asyncHandler(async (req, res) => {
    const grants = await this.service.listBreakGlassGrants(req.query);
    return ApiResponse.success(res, { message: 'Break-glass grants retrieved', data: { grants } });
  });

  openRequest = asyncHandler(async (req, res) => {
    await assertPatientInScope(req, req.body?.patientId, 'Patient not found');
    const request = await this.service.openRequest(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Privacy request opened', data: { request } });
  });

  listRequests = asyncHandler(async (req, res) => {
    const requests = await filterRowsToPatientScope(
      req,
      await this.service.listRequests(req.query)
    );
    return ApiResponse.success(res, { message: 'Privacy requests retrieved', data: { requests } });
  });

  verifyIdentity = asyncHandler(async (req, res) => {
    const request = await this.service.verifyIdentity(
      req.params.id,
      req.auth.userId,
      req,
      this.#patientGuard(req)
    );
    return ApiResponse.success(res, { message: 'Identity verified', data: { request } });
  });

  resolveRequest = asyncHandler(async (req, res) => {
    const request = await this.service.resolveRequest(
      req.params.id,
      req.body,
      req.auth.userId,
      req,
      this.#patientGuard(req)
    );
    return ApiResponse.success(res, { message: 'Privacy request resolved', data: { request } });
  });
}

export default PrivacyGovernanceController;
