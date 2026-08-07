import { Router } from 'express';
import ResourceController from '../../controllers/ResourceController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { idParamSchema } from '../../validators/common.js';
import {
  createRoomSchema,
  updateRoomSchema,
  roomStatusSchema,
  createDeviceSchema,
  updateDeviceSchema,
  deviceStatusSchema,
  grantSkillSchema,
  listResourceQuerySchema,
  listSkillsQuerySchema,
} from '../../validators/resource.validator.js';

const router = Router();
const controller = new ResourceController();

const view = [PERMISSIONS.RESOURCES_VIEW, PERMISSIONS.RESOURCES_ALL];
const manage = [PERMISSIONS.RESOURCES_MANAGE, PERMISSIONS.RESOURCES_ALL];

router.use(authenticate);

router.get('/rooms', requirePermission(...view), validate({ query: listResourceQuerySchema }), controller.listRooms);
router.post('/rooms', requirePermission(...manage), validate({ body: createRoomSchema }), controller.createRoom);
router.patch('/rooms/:id', requirePermission(...manage), validate({ params: idParamSchema, body: updateRoomSchema }), controller.updateRoom);
router.post('/rooms/:id/status', requirePermission(...manage), validate({ params: idParamSchema, body: roomStatusSchema }), controller.updateRoomStatus);

router.get('/devices', requirePermission(...view), validate({ query: listResourceQuerySchema }), controller.listDevices);
router.post('/devices', requirePermission(...manage), validate({ body: createDeviceSchema }), controller.createDevice);
router.patch('/devices/:id', requirePermission(...manage), validate({ params: idParamSchema, body: updateDeviceSchema }), controller.updateDevice);
router.post('/devices/:id/status', requirePermission(...manage), validate({ params: idParamSchema, body: deviceStatusSchema }), controller.updateDeviceStatus);

router.get('/skills', requirePermission(...view), validate({ query: listSkillsQuerySchema }), controller.listSkills);
router.post('/skills', requirePermission(...manage), validate({ body: grantSkillSchema }), controller.grantSkill);
router.post('/skills/:id/revoke', requirePermission(...manage), validate({ params: idParamSchema }), controller.revokeSkill);

export default router;
