import { Router } from 'express';
import MasterController from '../../controllers/MasterController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  masterTypeParamSchema,
  masterIdParamSchema,
  listMasterQuerySchema,
  getCreateMasterSchema,
  getUpdateMasterSchema,
} from '../../validators/master.validator.js';

const router = Router();
const masterController = new MasterController();

router.use(authenticate);

/** Dynamic body validation based on master slug */
const validateCreateBody = (req, res, next) => {
  const schema = getCreateMasterSchema(req.params.masterType);
  return validate({ params: masterTypeParamSchema, body: schema })(req, res, next);
};

const validateUpdateBody = (req, res, next) => {
  const schema = getUpdateMasterSchema(req.params.masterType);
  return validate({ params: masterIdParamSchema, body: schema })(req, res, next);
};

// SEC-030 — this dropdown-population endpoint additionally accepts the narrow MASTERS_LOOKUP
// grant, so clinical roles can fill service/lead-source pickers without holding MASTERS_VIEW
// (which also unlocks the admin Masters browse/detail reads). Existing MASTERS_VIEW /
// MASTERS_ALL holders are unaffected.
router.get(
  '/:masterType/active',
  requirePermission(
    PERMISSIONS.MASTERS_LOOKUP,
    PERMISSIONS.MASTERS_VIEW,
    PERMISSIONS.MASTERS_ALL
  ),
  validate({ params: masterTypeParamSchema }),
  masterController.listActive
);

router.get(
  '/:masterType',
  requirePermission(PERMISSIONS.MASTERS_VIEW, PERMISSIONS.MASTERS_ALL),
  validate({ params: masterTypeParamSchema, query: listMasterQuerySchema }),
  masterController.list
);

router.post(
  '/:masterType',
  requirePermission(PERMISSIONS.MASTERS_CREATE, PERMISSIONS.MASTERS_ALL),
  validateCreateBody,
  masterController.create
);

router.get(
  '/:masterType/:id',
  requirePermission(PERMISSIONS.MASTERS_VIEW, PERMISSIONS.MASTERS_ALL),
  validate({ params: masterIdParamSchema }),
  masterController.getById
);

router.patch(
  '/:masterType/:id',
  requirePermission(PERMISSIONS.MASTERS_EDIT, PERMISSIONS.MASTERS_ALL),
  validateUpdateBody,
  masterController.update
);

router.post(
  '/:masterType/:id/activate',
  requirePermission(PERMISSIONS.MASTERS_EDIT, PERMISSIONS.MASTERS_ALL),
  validate({ params: masterIdParamSchema }),
  masterController.activate
);

router.post(
  '/:masterType/:id/deactivate',
  requirePermission(PERMISSIONS.MASTERS_EDIT, PERMISSIONS.MASTERS_ALL),
  validate({ params: masterIdParamSchema }),
  masterController.deactivate
);

router.delete(
  '/:masterType/:id',
  requirePermission(PERMISSIONS.MASTERS_DELETE, PERMISSIONS.MASTERS_ALL),
  validate({ params: masterIdParamSchema }),
  masterController.softDelete
);

export default router;
