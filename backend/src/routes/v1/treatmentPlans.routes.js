import { Router } from 'express';
import TreatmentPlanController from '../../controllers/TreatmentPlanController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  createTreatmentPlanSchema,
  updateTreatmentPlanSchema,
  treatmentPlanIdParamSchema,
  consultationIdParamSchema,
  patientIdParamSchema,
  consentIdParamSchema,
  doctorQuerySchema,
  applyProtocolSchema,
  applyPackageSchema,
  rejectPlanSchema,
  acceptConsentSchema,
  protocolListQuerySchema,
  createProtocolSchema,
  updateProtocolSchema,
  createProtocolVersionSchema,
  createPackageSchema,
  updatePackageSchema,
  transferPackageOwnershipSchema,
} from '../../validators/treatmentPlan.validator.js';

const router = Router();
const controller = new TreatmentPlanController();

const view = [PERMISSIONS.TREATMENT_PLAN_VIEW, PERMISSIONS.TREATMENT_PLAN_ALL];
const create = [PERMISSIONS.TREATMENT_PLAN_CREATE, PERMISSIONS.TREATMENT_PLAN_ALL];
const edit = [PERMISSIONS.TREATMENT_PLAN_EDIT, PERMISSIONS.TREATMENT_PLAN_ALL];
const approve = [PERMISSIONS.TREATMENT_PLAN_APPROVE, PERMISSIONS.TREATMENT_PLAN_ALL];
const accept = [PERMISSIONS.TREATMENT_PLAN_ACCEPT, PERMISSIONS.TREATMENT_PLAN_ALL];

router.use(authenticate);

// Protocols (static paths first)
router.get(
  '/protocols',
  requirePermission(...view),
  validate({ query: protocolListQuerySchema }),
  controller.listProtocols
);
router.post(
  '/protocols',
  requirePermission(...create, ...edit),
  validate({ body: createProtocolSchema }),
  controller.createProtocol
);
router.get(
  '/protocols/:id',
  requirePermission(...view),
  validate({ params: treatmentPlanIdParamSchema }),
  controller.getProtocol
);
router.patch(
  '/protocols/:id',
  requirePermission(...edit),
  validate({ params: treatmentPlanIdParamSchema, body: updateProtocolSchema }),
  controller.updateProtocol
);
router.post(
  '/protocols/:id/version',
  requirePermission(...edit),
  validate({ params: treatmentPlanIdParamSchema, body: createProtocolVersionSchema }),
  controller.createProtocolVersion
);

// Packages
router.get(
  '/packages',
  requirePermission(...view),
  validate({ query: protocolListQuerySchema }),
  controller.listPackages
);
router.post(
  '/packages',
  requirePermission(...create, ...edit),
  validate({ body: createPackageSchema }),
  controller.createPackage
);
router.get(
  '/packages/:id',
  requirePermission(...view),
  validate({ params: treatmentPlanIdParamSchema }),
  controller.getPackage
);
router.patch(
  '/packages/:id',
  requirePermission(...edit),
  validate({ params: treatmentPlanIdParamSchema, body: updatePackageSchema }),
  controller.updatePackage
);

router.get(
  '/doctor',
  requirePermission(...view),
  validate({ query: doctorQuerySchema }),
  controller.listByDoctor
);
router.get(
  '/consultation/:consultationId',
  requirePermission(...view),
  validate({ params: consultationIdParamSchema }),
  controller.listByConsultation
);
router.get(
  '/patient/:patientId',
  requirePermission(...view),
  validate({ params: patientIdParamSchema }),
  controller.listByPatient
);

router.post(
  '/',
  requirePermission(...create),
  validate({ body: createTreatmentPlanSchema }),
  controller.create
);

router.get(
  '/:id',
  requirePermission(...view),
  validate({ params: treatmentPlanIdParamSchema }),
  controller.getById
);
router.patch(
  '/:id',
  requirePermission(...edit),
  validate({ params: treatmentPlanIdParamSchema, body: updateTreatmentPlanSchema }),
  controller.update
);
router.delete(
  '/:id',
  requirePermission(...edit),
  validate({ params: treatmentPlanIdParamSchema }),
  controller.remove
);

router.post(
  '/:id/protocol',
  requirePermission(...edit),
  validate({ params: treatmentPlanIdParamSchema, body: applyProtocolSchema }),
  controller.applyProtocol
);
router.post(
  '/:id/package',
  requirePermission(...edit),
  validate({ params: treatmentPlanIdParamSchema, body: applyPackageSchema }),
  controller.applyPackage
);
router.delete(
  '/:id/package',
  requirePermission(...edit),
  validate({ params: treatmentPlanIdParamSchema }),
  controller.clearPackage
);

router.post(
  '/:id/recommend',
  requirePermission(...edit),
  validate({ params: treatmentPlanIdParamSchema }),
  controller.recommend
);
router.post(
  '/:id/approve',
  requirePermission(...approve),
  validate({ params: treatmentPlanIdParamSchema }),
  controller.approve
);
router.post(
  '/:id/accept',
  requirePermission(...accept),
  validate({ params: treatmentPlanIdParamSchema }),
  controller.accept
);
router.post(
  '/:id/reject',
  requirePermission(...approve, ...accept),
  validate({ params: treatmentPlanIdParamSchema, body: rejectPlanSchema }),
  controller.reject
);
router.post(
  '/:id/cancel',
  requirePermission(...edit),
  validate({ params: treatmentPlanIdParamSchema }),
  controller.cancel
);
router.post(
  '/:id/complete',
  requirePermission(...edit),
  validate({ params: treatmentPlanIdParamSchema }),
  controller.complete
);
router.post(
  '/:id/transfer-package',
  requirePermission(...edit),
  validate({ params: treatmentPlanIdParamSchema, body: transferPackageOwnershipSchema }),
  controller.transferPackageOwnership
);

router.get(
  '/:id/consents',
  requirePermission(...view),
  validate({ params: treatmentPlanIdParamSchema }),
  controller.listConsents
);
router.post(
  '/:id/consents/:consentId/accept',
  requirePermission(...edit, ...accept),
  validate({ params: consentIdParamSchema, body: acceptConsentSchema }),
  controller.acceptConsent
);

router.get(
  '/:id/print',
  requirePermission(...view),
  validate({ params: treatmentPlanIdParamSchema }),
  controller.print
);

export default router;
