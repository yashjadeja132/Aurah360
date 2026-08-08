import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import ConsentService from '../services/ConsentService.js';
import { assertPatientInScope } from '../helpers/patientScope.helper.js';

/**
 * SEC-030 — consent is scoped to the PATIENT, never to a branch.
 *
 * `ConsentGrant` has no `branchId` column, and adding one would be wrong: consent is a property of
 * the person, not of the site that recorded it. A patient who consented to photography at Branch A
 * must have that consent visible and enforceable at Branch B, or the photo-capture gate at B fails
 * open (no record found = never consented) and clinicians re-ask for consent the patient already
 * gave. So the whole consent history travels with the patient.
 *
 * What was missing is the RELATIONSHIP check: `consent.view` / `consent.manage` are held by
 * BRANCH_MANAGER, DOCTOR and RECEPTIONIST, and every one of them could read — or rewrite — the
 * consent record of any patient in the organisation by id. The caller must now have a branch
 * relationship with the patient (registered there, or seen there). Out of scope answers 404, not
 * 403, so a patient's existence cannot be probed by id.
 *
 * Definitions (the consent FORMS and their versions) stay unscoped: they are organisation-wide
 * published documents with no patient data in them.
 */
class ConsentController {
  constructor() {
    this.service = new ConsentService();
  }

  grant = asyncHandler(async (req, res) => {
    await assertPatientInScope(req, req.body?.patientId, 'Patient not found');
    const grant = await this.service.grant(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Consent recorded', data: { grant } });
  });

  withdraw = asyncHandler(async (req, res) => {
    await assertPatientInScope(req, req.body?.patientId, 'Patient not found');
    const grant = await this.service.withdraw(req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Consent withdrawn', data: { grant } });
  });

  currentStates = asyncHandler(async (req, res) => {
    await assertPatientInScope(req, req.params.patientId, 'Patient not found');
    const states = await this.service.currentStates(req.params.patientId);
    return ApiResponse.success(res, { message: 'Consent states retrieved', data: { states } });
  });

  history = asyncHandler(async (req, res) => {
    await assertPatientInScope(req, req.params.patientId, 'Patient not found');
    const history = await this.service.history(req.params.patientId, req.query.purpose);
    return ApiResponse.success(res, { message: 'Consent history retrieved', data: { history } });
  });

  listDefinitions = asyncHandler(async (req, res) => {
    const definitions = await this.service.listDefinitions();
    return ApiResponse.success(res, { message: 'Consent definitions retrieved', data: { definitions } });
  });

  publishDefinition = asyncHandler(async (req, res) => {
    const definition = await this.service.publishNewVersion(req.body, req.auth.userId);
    return ApiResponse.created(res, { message: 'Consent version published', data: { definition } });
  });
}

export default ConsentController;
