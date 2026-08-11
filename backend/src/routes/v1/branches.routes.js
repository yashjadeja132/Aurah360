import { Router } from 'express';
import BranchController from '../../controllers/BranchController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  createBranchSchema,
  updateBranchSchema,
  listBranchQuerySchema,
  idParamSchema,
  branchSettingsSchema,
  transferBranchSchema,
  deactivateBranchSchema,
} from '../../validators/branch.validator.js';

const router = Router();
const branchController = new BranchController();

router.use(authenticate);

router.get(
  '/',
  requirePermission(PERMISSIONS.BRANCHES_VIEW, PERMISSIONS.BRANCHES_ALL),
  validate({ query: listBranchQuerySchema }),
  branchController.list
);

router.post(
  '/',
  requirePermission(PERMISSIONS.BRANCHES_CREATE, PERMISSIONS.BRANCHES_MANAGE, PERMISSIONS.BRANCHES_ALL),
  validate({ body: createBranchSchema }),
  branchController.create
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.BRANCHES_VIEW, PERMISSIONS.BRANCHES_ALL),
  validate({ params: idParamSchema }),
  branchController.getById
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.BRANCHES_EDIT, PERMISSIONS.BRANCHES_MANAGE, PERMISSIONS.BRANCHES_ALL),
  validate({ params: idParamSchema, body: updateBranchSchema }),
  branchController.update
);

router.patch(
  '/:id/settings',
  requirePermission(PERMISSIONS.BRANCHES_EDIT, PERMISSIONS.BRANCHES_MANAGE, PERMISSIONS.BRANCHES_ALL),
  validate({ params: idParamSchema, body: branchSettingsSchema }),
  branchController.updateSettings
);

router.post(
  '/:id/activate',
  requirePermission(PERMISSIONS.BRANCHES_EDIT, PERMISSIONS.BRANCHES_MANAGE, PERMISSIONS.BRANCHES_ALL),
  validate({ params: idParamSchema }),
  branchController.activate
);

router.post(
  '/:id/deactivate',
  requirePermission(PERMISSIONS.BRANCHES_EDIT, PERMISSIONS.BRANCHES_MANAGE, PERMISSIONS.BRANCHES_ALL),
  validate({ params: idParamSchema, body: deactivateBranchSchema }),
  branchController.deactivate
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.BRANCHES_DELETE, PERMISSIONS.BRANCHES_MANAGE, PERMISSIONS.BRANCHES_ALL),
  validate({ params: idParamSchema }),
  branchController.softDelete
);

router.post(
  '/:id/transfer',
  requirePermission(PERMISSIONS.BRANCHES_MANAGE, PERMISSIONS.BRANCHES_ALL),
  validate({ params: idParamSchema, body: transferBranchSchema }),
  branchController.transfer
);

export default router;
