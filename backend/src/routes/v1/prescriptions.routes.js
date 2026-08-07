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

router.post(
  '/:id/finalize',
  requirePermission(PERMISSIONS.PRESCRIPTION_FINALIZE, PERMISSIONS.PRESCRIPTION_ALL),
  validate({ params: prescriptionIdParamSchema }),
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
