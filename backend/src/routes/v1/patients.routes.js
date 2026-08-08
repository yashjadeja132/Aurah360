import { Router } from 'express';
import PatientController from '../../controllers/PatientController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission, requirePermissionOrBreakGlass } from '../../middlewares/permission.middleware.js';
import { uploadPatientDocument } from '../../middlewares/upload.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  createPatientSchema,
  updatePatientSchema,
  updateConsentSchema,
  listPatientQuerySchema,
  patientIdParamSchema,
  documentIdParamSchema,
  uploadDocumentSchema,
  renameDocumentSchema,
  reviewDocumentSchema,
  releaseDocumentSchema,
  duplicateCheckSchema,
  mergePlaceholderSchema,
  guardianVerificationSchema,
} from '../../validators/patient.validator.js';

const router = Router();
const controller = new PatientController();

router.use(authenticate);

router.get(
  '/',
  requirePermission(PERMISSIONS.PATIENTS_VIEW, PERMISSIONS.PATIENTS_ALL),
  validate({ query: listPatientQuerySchema }),
  controller.list
);

router.post(
  '/',
  requirePermission(PERMISSIONS.PATIENTS_CREATE, PERMISSIONS.PATIENTS_ALL),
  validate({ body: createPatientSchema }),
  controller.create
);

router.post(
  '/duplicates/check',
  requirePermission(
    PERMISSIONS.PATIENTS_MERGE,
    PERMISSIONS.PATIENTS_CREATE,
    PERMISSIONS.PATIENTS_VIEW,
    PERMISSIONS.PATIENTS_ALL
  ),
  validate({ body: duplicateCheckSchema }),
  controller.checkDuplicates
);

router.post(
  '/merge/preview',
  requirePermission(PERMISSIONS.PATIENTS_MERGE, PERMISSIONS.PATIENTS_ALL),
  validate({ body: mergePlaceholderSchema }),
  controller.mergePreview
);

router.post(
  '/merge',
  requirePermission(PERMISSIONS.PATIENTS_MERGE, PERMISSIONS.PATIENTS_ALL),
  validate({ body: mergePlaceholderSchema }),
  controller.merge
);

router.get(
  '/:id',
  requirePermissionOrBreakGlass('id', PERMISSIONS.PATIENTS_VIEW, PERMISSIONS.PATIENTS_ALL),
  validate({ params: patientIdParamSchema }),
  controller.getById
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.PATIENTS_EDIT, PERMISSIONS.PATIENTS_ALL),
  validate({ params: patientIdParamSchema, body: updatePatientSchema }),
  controller.update
);

router.patch(
  '/:id/consent',
  requirePermission(PERMISSIONS.PATIENTS_EDIT, PERMISSIONS.PATIENTS_ALL),
  validate({ params: patientIdParamSchema, body: updateConsentSchema }),
  controller.updateConsent
);

// PAT-005 — staff verifies the guardian↔dependent relationship at the desk. This is what unlocks
// the dependent's portal record for the guardian; it can never be set through a profile edit.
router.patch(
  '/:id/guardian-verification',
  requirePermission(PERMISSIONS.PATIENTS_EDIT, PERMISSIONS.PATIENTS_ALL),
  validate({ params: patientIdParamSchema, body: guardianVerificationSchema }),
  controller.setGuardianVerified
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.PATIENTS_DELETE, PERMISSIONS.PATIENTS_ALL),
  validate({ params: patientIdParamSchema }),
  controller.softDelete
);

router.get(
  '/:id/documents',
  requirePermissionOrBreakGlass(
    'id',
    PERMISSIONS.PATIENTS_DOCUMENTS,
    PERMISSIONS.PATIENTS_ALL,
    PERMISSIONS.PATIENTS_VIEW
  ),
  validate({ params: patientIdParamSchema }),
  controller.listDocuments
);

router.post(
  '/:id/documents',
  requirePermission(PERMISSIONS.PATIENTS_DOCUMENTS, PERMISSIONS.PATIENTS_ALL),
  uploadPatientDocument,
  validate({ params: patientIdParamSchema, body: uploadDocumentSchema }),
  controller.uploadDocument
);

router.patch(
  '/:id/documents/:documentId',
  requirePermission(PERMISSIONS.PATIENTS_DOCUMENTS, PERMISSIONS.PATIENTS_ALL),
  validate({ params: documentIdParamSchema, body: renameDocumentSchema }),
  controller.renameDocument
);

router.delete(
  '/:id/documents/:documentId',
  requirePermission(PERMISSIONS.PATIENTS_DOCUMENTS, PERMISSIONS.PATIENTS_ALL),
  validate({ params: documentIdParamSchema }),
  controller.deleteDocument
);

router.post(
  '/:id/documents/:documentId/review',
  requirePermission(PERMISSIONS.PATIENTS_DOCUMENTS, PERMISSIONS.PATIENTS_ALL, PERMISSIONS.CLINICAL_EDIT),
  validate({ params: documentIdParamSchema, body: reviewDocumentSchema }),
  controller.reviewDocument
);

router.post(
  '/:id/documents/:documentId/release',
  requirePermission(PERMISSIONS.PATIENTS_DOCUMENTS, PERMISSIONS.PATIENTS_ALL, PERMISSIONS.CLINICAL_SIGN),
  validate({ params: documentIdParamSchema, body: releaseDocumentSchema }),
  controller.releaseDocument
);

router.get(
  '/:id/timeline',
  requirePermissionOrBreakGlass('id', PERMISSIONS.PATIENTS_VIEW, PERMISSIONS.PATIENTS_ALL),
  validate({ params: patientIdParamSchema }),
  controller.timeline
);

export default router;
