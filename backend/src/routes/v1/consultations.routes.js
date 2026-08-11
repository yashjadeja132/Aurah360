import { Router } from 'express';
import ConsultationController from '../../controllers/ConsultationController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { uploadPatientDocument } from '../../middlewares/upload.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  consultationIdParamSchema,
  patientIdParamSchema,
  photoIdParamSchema,
  startConsultationSchema,
  updateConsultationSchema,
  soapAutosaveSchema,
  vitalsSchema,
  diagnosisSchema,
  examinationSchema,
  intakeSchema,
  photoMetaSchema,
  releasePhotoSchema,
  templateCreateSchema,
  doctorListQuerySchema,
  templateListQuerySchema,
  templateAdminListQuerySchema,
  templateUpdateSchema,
  amendConsultationSchema,
  releaseSummarySchema,
  createLabOrderSchema,
  updateLabOrderSchema,
  labOrderIdParamSchema,
  labOrderReviewQueueQuerySchema,
  followUpQueueQuerySchema,
  followUpActionSchema,
} from '../../validators/consultation.validator.js';

const router = Router();
const controller = new ConsultationController();

router.use(authenticate);

router.post(
  '/',
  requirePermission(PERMISSIONS.CONSULTATION_CREATE, PERMISSIONS.CONSULTATION_ALL),
  validate({ body: startConsultationSchema }),
  controller.start
);

router.get(
  '/doctor',
  requirePermission(PERMISSIONS.CONSULTATION_VIEW, PERMISSIONS.CONSULTATION_ALL),
  validate({ query: doctorListQuerySchema }),
  controller.listByDoctor
);

router.get(
  '/templates',
  requirePermission(PERMISSIONS.CONSULTATION_VIEW, PERMISSIONS.CONSULTATION_ALL),
  validate({ query: templateListQuerySchema }),
  controller.listTemplates
);

/**
 * Settings → Masters admin listing — must stay above `/templates/:id`-shaped routes so 'all' is
 * never swallowed as a template id. Gated to CONSULTATION_TEMPLATE_MANAGE only: unlike the
 * consultation-session-scoped `/templates` above (any CONSULTATION_VIEW holder, doctor-filtered),
 * this is the unscoped, org-wide template-library admin surface.
 */
router.get(
  '/templates/all',
  requirePermission(PERMISSIONS.CONSULTATION_TEMPLATE_MANAGE),
  validate({ query: templateAdminListQuerySchema }),
  controller.listAllTemplates
);

router.post(
  '/templates',
  requirePermission(PERMISSIONS.CONSULTATION_EDIT, PERMISSIONS.CONSULTATION_ALL),
  validate({ body: templateCreateSchema }),
  controller.createTemplate
);

router.patch(
  '/templates/:id',
  requirePermission(PERMISSIONS.CONSULTATION_TEMPLATE_MANAGE),
  validate({ params: consultationIdParamSchema, body: templateUpdateSchema }),
  controller.updateTemplate
);

router.post(
  '/templates/:id/approve',
  requirePermission(PERMISSIONS.CONSULTATION_TEMPLATE_MANAGE),
  validate({ params: consultationIdParamSchema }),
  controller.approveTemplate
);

router.delete(
  '/templates/:id',
  requirePermission(PERMISSIONS.CONSULTATION_EDIT, PERMISSIONS.CONSULTATION_ALL),
  validate({ params: consultationIdParamSchema }),
  controller.deleteTemplate
);

// A13 — cross-patient Report Review worklist. Must stay above '/:id' so 'lab-orders' is not
// swallowed as a consultation id.
router.get(
  '/lab-orders/review-queue',
  requirePermission(PERMISSIONS.CONSULTATION_VIEW, PERMISSIONS.CONSULTATION_ALL),
  validate({ query: labOrderReviewQueueQuerySchema }),
  controller.labOrderReviewQueue
);

// §5 — cross-patient Follow-ups due/overdue worklist. Must stay above '/:id' for the same
// reason as '/lab-orders/review-queue' — otherwise 'follow-ups' is swallowed as a consultation id.
router.get(
  '/follow-ups',
  requirePermission(PERMISSIONS.CONSULTATION_VIEW, PERMISSIONS.CONSULTATION_ALL),
  validate({ query: followUpQueueQuerySchema }),
  controller.followUpQueue
);

router.get(
  '/patient/:patientId',
  requirePermission(PERMISSIONS.CONSULTATION_VIEW, PERMISSIONS.CONSULTATION_ALL),
  validate({ params: patientIdParamSchema }),
  controller.listByPatient
);

router.get(
  '/patient/:patientId/summary',
  requirePermission(PERMISSIONS.CONSULTATION_VIEW, PERMISSIONS.CONSULTATION_ALL),
  validate({ params: patientIdParamSchema }),
  controller.patientSummary
);

router.post(
  '/ai/summarize',
  requirePermission(PERMISSIONS.CONSULTATION_VIEW, PERMISSIONS.CONSULTATION_ALL),
  controller.aiSummarize
);
router.post(
  '/ai/draft-soap',
  requirePermission(PERMISSIONS.CONSULTATION_VIEW, PERMISSIONS.CONSULTATION_ALL),
  controller.aiDraftSoap
);
router.post(
  '/ai/suggest-diagnosis',
  requirePermission(PERMISSIONS.CONSULTATION_VIEW, PERMISSIONS.CONSULTATION_ALL),
  controller.aiSuggestDiagnosis
);
router.post(
  '/ai/suggest-questions',
  requirePermission(PERMISSIONS.CONSULTATION_VIEW, PERMISSIONS.CONSULTATION_ALL),
  controller.aiSuggestQuestions
);

router.get(
  '/:id/workspace',
  requirePermission(PERMISSIONS.CONSULTATION_VIEW, PERMISSIONS.CONSULTATION_ALL),
  validate({ params: consultationIdParamSchema }),
  controller.getWorkspace
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.CONSULTATION_VIEW, PERMISSIONS.CONSULTATION_ALL),
  validate({ params: consultationIdParamSchema }),
  controller.getById
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.CONSULTATION_EDIT, PERMISSIONS.CONSULTATION_ALL),
  validate({ params: consultationIdParamSchema, body: updateConsultationSchema }),
  controller.update
);

router.post(
  '/:id/sign',
  requirePermission(PERMISSIONS.CONSULTATION_SIGN, PERMISSIONS.CONSULTATION_ALL),
  validate({ params: consultationIdParamSchema }),
  controller.sign
);

router.post(
  '/:id/lock',
  requirePermission(PERMISSIONS.CONSULTATION_LOCK, PERMISSIONS.CONSULTATION_ALL),
  validate({ params: consultationIdParamSchema }),
  controller.lock
);

router.post(
  '/:id/unlock',
  requirePermission(PERMISSIONS.CONSULTATION_LOCK, PERMISSIONS.CONSULTATION_ALL),
  validate({ params: consultationIdParamSchema }),
  controller.unlock
);

router.post(
  '/:id/release-summary',
  requirePermission(PERMISSIONS.CONSULTATION_SIGN, PERMISSIONS.CONSULTATION_ALL),
  validate({ params: consultationIdParamSchema, body: releaseSummarySchema }),
  controller.releaseSummary
);

router.patch(
  '/:id/follow-up-status',
  requirePermission(PERMISSIONS.CONSULTATION_EDIT, PERMISSIONS.CONSULTATION_ALL),
  validate({ params: consultationIdParamSchema, body: followUpActionSchema }),
  controller.updateFollowUpStatus
);

router.post(
  '/:id/amend',
  requirePermission(PERMISSIONS.CONSULTATION_SIGN, PERMISSIONS.CONSULTATION_ALL),
  validate({ params: consultationIdParamSchema, body: amendConsultationSchema }),
  controller.amend
);

router.post(
  '/:id/lab-orders',
  requirePermission(PERMISSIONS.CONSULTATION_EDIT, PERMISSIONS.CONSULTATION_ALL),
  validate({ params: consultationIdParamSchema, body: createLabOrderSchema }),
  controller.createLabOrder
);

router.get(
  '/:id/lab-orders',
  requirePermission(PERMISSIONS.CONSULTATION_VIEW, PERMISSIONS.CONSULTATION_ALL),
  validate({ params: consultationIdParamSchema }),
  controller.listLabOrders
);

router.patch(
  '/:id/lab-orders/:labOrderId',
  requirePermission(PERMISSIONS.CONSULTATION_EDIT, PERMISSIONS.CONSULTATION_ALL),
  validate({ params: consultationIdParamSchema.merge(labOrderIdParamSchema), body: updateLabOrderSchema }),
  controller.updateLabOrder
);

router.post(
  '/:id/soap/autosave',
  requirePermission(PERMISSIONS.CONSULTATION_EDIT, PERMISSIONS.CONSULTATION_ALL),
  validate({ params: consultationIdParamSchema, body: soapAutosaveSchema }),
  controller.autosaveSoap
);

router.get(
  '/:id/soap/versions',
  requirePermission(PERMISSIONS.CONSULTATION_VIEW, PERMISSIONS.CONSULTATION_ALL),
  validate({ params: consultationIdParamSchema }),
  controller.soapVersions
);

router.put(
  '/:id/vitals',
  requirePermission(PERMISSIONS.CONSULTATION_EDIT, PERMISSIONS.CONSULTATION_ALL),
  validate({ params: consultationIdParamSchema, body: vitalsSchema }),
  controller.saveVitals
);

// Diagnosis authoring is prescriber-only — deliberately NOT CONSULTATION_EDIT, which assistive
// clinical roles (nurse) hold so they can record vitals and intake notes on the same screen.
router.put(
  '/:id/diagnosis',
  requirePermission(PERMISSIONS.CONSULTATION_DIAGNOSE, PERMISSIONS.CONSULTATION_ALL),
  validate({ params: consultationIdParamSchema, body: diagnosisSchema }),
  controller.saveDiagnosis
);

// §2 Pre-consult intake — CONSULTATION_EDIT (same gate as vitals) is the nurse-appropriate
// permission: NURSE already holds it precisely so they can "record vitals, intake notes ... on
// the same screen" without CONSULTATION_DIAGNOSE (see rolePermissions.js NURSE block comment).
router.get(
  '/:id/intake',
  requirePermission(PERMISSIONS.CONSULTATION_VIEW, PERMISSIONS.CONSULTATION_ALL),
  validate({ params: consultationIdParamSchema }),
  controller.getIntake
);

router.put(
  '/:id/intake',
  requirePermission(PERMISSIONS.CONSULTATION_EDIT, PERMISSIONS.CONSULTATION_ALL),
  validate({ params: consultationIdParamSchema, body: intakeSchema }),
  controller.saveIntake
);

router.put(
  '/:id/examination',
  requirePermission(PERMISSIONS.CONSULTATION_EDIT, PERMISSIONS.CONSULTATION_ALL),
  validate({ params: consultationIdParamSchema, body: examinationSchema }),
  controller.saveExamination
);

router.get(
  '/:id/photos',
  requirePermission(PERMISSIONS.CONSULTATION_VIEW, PERMISSIONS.CONSULTATION_ALL),
  validate({ params: consultationIdParamSchema }),
  controller.listPhotos
);

router.post(
  '/:id/photos',
  requirePermission(PERMISSIONS.CONSULTATION_EDIT, PERMISSIONS.CONSULTATION_ALL),
  uploadPatientDocument,
  validate({ params: consultationIdParamSchema, body: photoMetaSchema }),
  controller.uploadPhoto
);

router.post(
  '/photos/:photoId/verify-consent',
  requirePermission(PERMISSIONS.CONSULTATION_EDIT, PERMISSIONS.CONSULTATION_ALL),
  validate({ params: photoIdParamSchema }),
  controller.verifyPhotoConsent
);

/**
 * IMG-005 — releasing an image to the patient is a clinical-sign-grade decision, so this mirrors
 * the document release gate (`POST /patients/:id/documents/:documentId/release`) rather than the
 * looser CONSULTATION_EDIT used for capture.
 */
router.post(
  '/photos/:photoId/release',
  requirePermission(PERMISSIONS.CONSULTATION_ALL, PERMISSIONS.CLINICAL_SIGN),
  validate({ params: photoIdParamSchema, body: releasePhotoSchema }),
  controller.releasePhoto
);

export default router;
