import { Router } from 'express';
import LoyaltyController from '../../controllers/LoyaltyController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  idParamSchema,
  patientIdParamSchema,
  updateSettingsSchema,
  ruleListQuerySchema,
  createRuleSchema,
  addRuleVersionSchema,
  previewRuleSchema,
  upsertTierSchema,
  campaignListQuerySchema,
  createCampaignSchema,
  campaignStatusSchema,
  adjustmentQueueQuerySchema,
  decisionSchema,
  createAdjustmentSchema,
  ledgerQuerySchema,
  dashboardQuerySchema,
} from '../../validators/loyalty.validator.js';

const router = Router();
const controller = new LoyaltyController();

const settingsView = [PERMISSIONS.LOYALTY_SETTINGS_VIEW, PERMISSIONS.LOYALTY_ALL];
const settingsManage = [PERMISSIONS.LOYALTY_SETTINGS_MANAGE, PERMISSIONS.LOYALTY_ALL];
const rulesView = [PERMISSIONS.LOYALTY_RULES_VIEW, PERMISSIONS.LOYALTY_ALL];
const rulesManage = [PERMISSIONS.LOYALTY_RULES_MANAGE, PERMISSIONS.LOYALTY_ALL];
const balanceView = [PERMISSIONS.LOYALTY_BALANCE_VIEW, PERMISSIONS.LOYALTY_ALL];
const adjust = [PERMISSIONS.LOYALTY_ADJUST, PERMISSIONS.LOYALTY_ADJUST_APPROVE, PERMISSIONS.LOYALTY_ALL];
const adjustApprove = [PERMISSIONS.LOYALTY_ADJUST_APPROVE, PERMISSIONS.LOYALTY_ALL];
// The frontend admits settings/rules viewers onto the loyalty dashboard, which reads this
// summary — so they must not 403 on it. It exposes aggregate program figures only, no PHI.
const reportsView = [
  PERMISSIONS.LOYALTY_REPORTS_VIEW,
  PERMISSIONS.LOYALTY_SETTINGS_VIEW,
  PERMISSIONS.LOYALTY_RULES_VIEW,
  PERMISSIONS.LOYALTY_ALL,
];
const campaignsManage = [PERMISSIONS.LOYALTY_CAMPAIGNS_MANAGE, PERMISSIONS.LOYALTY_ALL];

router.use(authenticate);

// LOY-001
router.get('/settings', requirePermission(...settingsView), controller.getSettings);
router.put('/settings', requirePermission(...settingsManage), validate({ body: updateSettingsSchema }), controller.updateSettings);

// LOY-002
router.get('/rules', requirePermission(...rulesView), validate({ query: ruleListQuerySchema }), controller.listRules);
router.post('/rules', requirePermission(...rulesManage), validate({ body: createRuleSchema }), controller.createRule);
// Dry-run preview calculator — declared before '/rules/:id' so 'preview' is never read as an id.
router.post('/rules/preview', requirePermission(...rulesManage), validate({ body: previewRuleSchema }), controller.previewRule);
router.get('/rules/:id', requirePermission(...rulesView), validate({ params: idParamSchema }), controller.getRule);
router.post(
  '/rules/:id/versions',
  requirePermission(...rulesManage),
  validate({ params: idParamSchema, body: addRuleVersionSchema }),
  controller.addRuleVersion
);

// LOY-012
router.get('/tiers', requirePermission(...rulesView), controller.listTiers);
router.post('/tiers', requirePermission(...rulesManage), validate({ body: upsertTierSchema }), controller.createTier);
router.patch(
  '/tiers/:id',
  requirePermission(...rulesManage),
  validate({ params: idParamSchema, body: upsertTierSchema.partial() }),
  controller.updateTier
);

// LOY-013
router.get('/campaigns', requirePermission(...rulesView), validate({ query: campaignListQuerySchema }), controller.listCampaigns);
router.post('/campaigns', requirePermission(...campaignsManage), validate({ body: createCampaignSchema }), controller.createCampaign);
router.post(
  '/campaigns/:id/status',
  requirePermission(...campaignsManage),
  validate({ params: idParamSchema, body: campaignStatusSchema }),
  controller.updateCampaignStatus
);

// LOY-008
router.get(
  '/adjustments/queue',
  requirePermission(...adjustApprove),
  validate({ query: adjustmentQueueQuerySchema }),
  controller.listAdjustmentQueue
);
router.post(
  '/adjustments/:id/approve',
  requirePermission(...adjustApprove),
  validate({ params: idParamSchema, body: decisionSchema }),
  controller.approveAdjustment
);
router.post(
  '/adjustments/:id/reject',
  requirePermission(...adjustApprove),
  validate({ params: idParamSchema, body: decisionSchema }),
  controller.rejectAdjustment
);

// Patient balance/ledger/tier/adjustment (LOY-003/005/008/012)
router.get(
  '/patients/:patientId/balance',
  requirePermission(...balanceView),
  validate({ params: patientIdParamSchema }),
  controller.getPatientBalance
);
router.get(
  '/patients/:patientId/ledger',
  requirePermission(...balanceView),
  validate({ params: patientIdParamSchema, query: ledgerQuerySchema }),
  controller.getPatientLedger
);
router.get(
  '/patients/:patientId/tier',
  requirePermission(...balanceView),
  validate({ params: patientIdParamSchema }),
  controller.getPatientTierProgress
);
router.post(
  '/patients/:patientId/adjustments',
  requirePermission(...adjust),
  validate({ params: patientIdParamSchema, body: createAdjustmentSchema }),
  controller.createPatientAdjustment
);

// LOY-014
router.get('/reports/summary', requirePermission(...reportsView), validate({ query: dashboardQuerySchema }), controller.getDashboardSummary);

export default router;
