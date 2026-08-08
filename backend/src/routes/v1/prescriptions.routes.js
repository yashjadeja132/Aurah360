import { Router } from 'express';
import PrescriptionController from '../../controllers/PrescriptionController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  createPrescriptionSchema,
  updatePrescriptionSchema,
  prescriptionIdParamSchema,
  consultationIdParamSchema,
  patientIdParamSchema,
  doctorQuerySchema,
  medicineSearchQuerySchema,
  medicineListQuerySchema,
  createMedicineSchema,
  updateMedicineSchema,
  templateCreateSchema,
  applyTemplateSchema,
  finalizePrescriptionSchema,
  createInteractionRuleSchema,
  updateInteractionRuleSchema,
} from '../../validators/prescription.validator.js';

const router = Router();
const controller = new PrescriptionController();

router.use(authenticate);

// Medicines
router.get(
  '/medicines/search',
  requirePermission(PERMISSIONS.PRESCRIPTION_VIEW, PERMISSIONS.PRESCRIPTION_CREATE, PERMISSIONS.PRESCRIPTION_ALL),
  validate({ query: medicineSearchQuerySchema }),
  controller.searchMedicines
);

router.get(
  '/medicines',
  requirePermission(PERMISSIONS.PRESCRIPTION_VIEW, PERMISSIONS.PRESCRIPTION_ALL),
  validate({ query: medicineListQuerySchema }),
  controller.listMedicines
);

router.post(
  '/medicines',
  requirePermission(PERMISSIONS.PRESCRIPTION_CREATE, PERMISSIONS.PRESCRIPTION_ALL),
  validate({ body: createMedicineSchema }),
  controller.createMedicine
);

router.get(
  '/medicines/:id',
  requirePermission(PERMISSIONS.PRESCRIPTION_VIEW, PERMISSIONS.PRESCRIPTION_ALL),
  validate({ params: prescriptionIdParamSchema }),
  controller.getMedicine
);

router.patch(
  '/medicines/:id',
  requirePermission(PERMISSIONS.PRESCRIPTION_EDIT, PERMISSIONS.PRESCRIPTION_ALL),
  validate({ params: prescriptionIdParamSchema, body: updateMedicineSchema }),
  controller.updateMedicine
);

/**
 * RX-SAFETY — drug-interaction rule set (admin-maintained; ships EMPTY on purpose, see
 * DrugInteractionRule.model.js). Registered before `/:id` so the literal path wins.
 */
router.get(
  '/interaction-rules',
  requirePermission(
    PERMISSIONS.PRESCRIPTION_SAFETY_RULES_VIEW,
    PERMISSIONS.PRESCRIPTION_SAFETY_RULES_MANAGE
  ),
  controller.listInteractionRules
);

router.post(
  '/interaction-rules',
  requirePermission(PERMISSIONS.PRESCRIPTION_SAFETY_RULES_MANAGE),
  validate({ body: createInteractionRuleSchema }),
  controller.createInteractionRule
);

router.patch(
  '/interaction-rules/:id',
  requirePermission(PERMISSIONS.PRESCRIPTION_SAFETY_RULES_MANAGE),
  validate({ params: prescriptionIdParamSchema, body: updateInteractionRuleSchema }),
  controller.updateInteractionRule
);

// Templates / favorites
router.get(
  '/templates',
  requirePermission(PERMISSIONS.PRESCRIPTION_VIEW, PERMISSIONS.PRESCRIPTION_ALL),
  validate({ query: doctorQuerySchema.pick({ doctorId: true }) }),
  controller.listTemplates
);

router.post(
  '/templates',
  requirePermission(PERMISSIONS.PRESCRIPTION_CREATE, PERMISSIONS.PRESCRIPTION_EDIT, PERMISSIONS.PRESCRIPTION_ALL),
  validate({ body: templateCreateSchema }),
  controller.createTemplate
);

router.delete(
  '/templates/:id',
  requirePermission(PERMISSIONS.PRESCRIPTION_EDIT, PERMISSIONS.PRESCRIPTION_ALL),
  validate({ params: prescriptionIdParamSchema }),
  controller.deleteTemplate
);

router.post(
  '/templates/:id/apply',
  requirePermission(PERMISSIONS.PRESCRIPTION_CREATE, PERMISSIONS.PRESCRIPTION_ALL),
  validate({ params: prescriptionIdParamSchema, body: applyTemplateSchema }),
  controller.applyTemplate
);

router.get(
  '/recent-medicines',
  requirePermission(PERMISSIONS.PRESCRIPTION_VIEW, PERMISSIONS.PRESCRIPTION_ALL),
  validate({ query: doctorQuerySchema.pick({ doctorId: true }) }),
  controller.recentMedicines
);

router.get(
  '/doctor',
  requirePermission(PERMISSIONS.PRESCRIPTION_VIEW, PERMISSIONS.PRESCRIPTION_ALL),
  validate({ query: doctorQuerySchema }),
  controller.listByDoctor
);

router.get(
  '/consultation/:consultationId',
  requirePermission(PERMISSIONS.PRESCRIPTION_VIEW, PERMISSIONS.PRESCRIPTION_ALL),
  validate({ params: consultationIdParamSchema }),
  controller.listByConsultation
);

router.get(
  '/patient/:patientId',
  requirePermission(PERMISSIONS.PRESCRIPTION_VIEW, PERMISSIONS.PRESCRIPTION_ALL),
  validate({ params: patientIdParamSchema }),
  controller.listByPatient
);

router.post(
  '/',
  requirePermission(PERMISSIONS.PRESCRIPTION_CREATE, PERMISSIONS.PRESCRIPTION_ALL),
  validate({ body: createPrescriptionSchema }),
  controller.create
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.PRESCRIPTION_VIEW, PERMISSIONS.PRESCRIPTION_ALL),
  validate({ params: prescriptionIdParamSchema }),
  controller.getById
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.PRESCRIPTION_EDIT, PERMISSIONS.PRESCRIPTION_ALL),
  validate({ params: prescriptionIdParamSchema, body: updatePrescriptionSchema }),
  controller.update
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.PRESCRIPTION_EDIT, PERMISSIONS.PRESCRIPTION_ALL),
  validate({ params: prescriptionIdParamSchema }),
  controller.remove
);

// RX-SAFETY — read-only preflight so the editor can show the block before the doctor tries.
router.get(
  '/:id/safety-check',
  requirePermission(PERMISSIONS.PRESCRIPTION_VIEW, PERMISSIONS.PRESCRIPTION_ALL),
  validate({ params: prescriptionIdParamSchema }),
  controller.safetyCheck
);

router.post(
  '/:id/finalize',
  requirePermission(PERMISSIONS.PRESCRIPTION_FINALIZE, PERMISSIONS.PRESCRIPTION_ALL),
  validate({ params: prescriptionIdParamSchema, body: finalizePrescriptionSchema }),
  controller.finalize
);

router.post(
  '/:id/duplicate',
  requirePermission(PERMISSIONS.PRESCRIPTION_CREATE, PERMISSIONS.PRESCRIPTION_ALL),
  validate({ params: prescriptionIdParamSchema }),
  controller.duplicate
);

router.get(
  '/:id/print',
  requirePermission(PERMISSIONS.PRESCRIPTION_PRINT, PERMISSIONS.PRESCRIPTION_ALL),
  validate({ params: prescriptionIdParamSchema }),
  controller.print
);

export default router;
