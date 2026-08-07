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
  photoMetaSchema,
  templateCreateSchema,
  doctorListQuerySchema,
  templateListQuerySchema,
  amendConsultationSchema,
  releaseSummarySchema,
  createLabOrderSchema,
  updateLabOrderSchema,
  labOrderIdParamSchema,
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

router.post(
  '/templates',
  requirePermission(PERMISSIONS.CONSULTATION_EDIT, PERMISSIONS.CONSULTATION_ALL),
  validate({ body: templateCreateSchema }),
  controller.createTemplate
);

router.delete(
  '/templates/:id',
  requirePermission(PERMISSIONS.CONSULTATION_EDIT, PERMISSIONS.CONSULTATION_ALL),
  validate({ params: consultationIdParamSchema }),
  controller.deleteTemplate
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

router.put(
  '/:id/diagnosis',
  requirePermission(PERMISSIONS.CONSULTATION_EDIT, PERMISSIONS.CONSULTATION_ALL),
  validate({ params: consultationIdParamSchema, body: diagnosisSchema }),
  controller.saveDiagnosis
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

export default router;
