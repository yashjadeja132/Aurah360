import ApiError from '../libs/ApiError.js';
import {
  TreatmentSessionRepository,
  TreatmentSessionLogRepository,
} from '../repositories/TreatmentSessionRepository.js';
import TreatmentPlanRepository from '../repositories/TreatmentPlanRepository.js';
import { InvoiceRepository } from '../repositories/BillingRepository.js';
import { ClinicalPhotoRepository } from '../repositories/ConsultationClinicalRepository.js';
import AuditService from './AuditService.js';
import ResourceService from './ResourceService.js';
import InventoryService from './InventoryService.js';
import LocalStorage from '../storage/LocalStorage.js';
import ConsentRecord from '../models/ConsentRecord.model.js';
import PatchTest from '../models/PatchTest.model.js';
import TreatmentProtocol from '../models/TreatmentProtocol.model.js';
import logger from '../libs/logger.js';
import LoyaltyLedgerEntry from '../models/LoyaltyLedgerEntry.model.js';
import LoyaltyLedgerService from './LoyaltyLedgerService.js';
import { LOYALTY_ENTRY_TYPE, LOYALTY_SOURCE_REF_TYPE } from '../enums/loyalty.js';
import { eventBus } from '../events/eventBus.js';
import { emitQueueEvent, SOCKET_EVENTS } from '../socket/index.js';
import { generateSessionNumber } from '../helpers/treatmentSessionNumber.helper.js';
import {
  SESSION_ALLOWED_PAYMENT_STATUSES,
  TREATMENT_SESSION_EVENTS,
  TREATMENT_SESSION_STATUS,
  HARD_STOP_TYPE,
} from '../enums/treatmentSession.js';
import { TREATMENT_PLAN_STATUS, CONSENT_STATUS } from '../enums/treatmentPlan.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { PHOTO_TYPE } from '../enums/consultation.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { hasAnyPermission } from '../helpers/permission.helper.js';

/**
 * Treatment Execution — creates sessions from accepted plans.
 * Does NOT modify Billing invoices — that remains strictly out of scope here.
 * On completion, does decrement the parent plan's packageSnapshot.unusedSessions
 * (package-booked plans only) and deduct real inventory stock for consumables used.
 * Both are best-effort/compensating side effects (this codebase does not use Mongo
 * transactions anywhere — see BillingService.refund() for the same sequential pattern);
 * failures are logged loudly rather than rolling back the already-completed session.
 */
class TreatmentSessionService {
  constructor() {
    this.sessionRepository = new TreatmentSessionRepository();
    this.logRepository = new TreatmentSessionLogRepository();
    this.planRepository = new TreatmentPlanRepository();
    this.invoiceRepository = new InvoiceRepository();
    this.photoRepository = new ClinicalPhotoRepository();
    this.auditService = new AuditService();
    this.storage = new LocalStorage();
    this.resourceService = new ResourceService();
    this.inventoryService = new InventoryService();
    this.loyaltyLedgerService = new LoyaltyLedgerService();
  }

  /**
   * TRT-006 — hard-stop preflight before a session may start. Returns the list of blocking
   * stops; an authorized override (with reason) is recorded on the session and audited.
   */
  async #assertHardStops(session, plan, actorId, req, override) {
    const stops = [];

    const consents = await ConsentRecord.find({ treatmentPlanId: plan._id, deletedAt: null }).exec();
    const hasUnsignedConsent = consents.length > 0 && consents.some((c) => c.status !== CONSENT_STATUS.ACCEPTED);
    if (hasUnsignedConsent) stops.push({ type: 'CONSENT_MISSING', message: 'Treatment consent is not signed' });

    let protocol = null;
    if (session.protocolId) {
      protocol = await TreatmentProtocol.findById(session.protocolId).exec();
      const requiresPatchTest = (protocol?.items || []).some((i) => i.patchTestRequired);
      if (requiresPatchTest) {
        const patchTest = await PatchTest.findOne({
          patientId: session.patientId,
          protocolId: session.protocolId,
        })
          .sort({ testedAt: -1 })
          .exec();
        if (!patchTest) {
          stops.push({ type: 'PATCH_TEST_MISSING', message: 'A patch test is required before this treatment' });
        } else if (patchTest.result === 'POSITIVE') {
          stops.push({ type: 'PATCH_TEST_POSITIVE', message: 'Patch test reaction was positive' });
        } else if (!patchTest.isValidNow()) {
          stops.push({ type: 'PATCH_TEST_MISSING', message: 'Patch test result is missing, pending or expired' });
        }
      }
    }

    if (session.roomRef && !(await this.resourceService.isRoomAvailable(session.roomRef))) {
      stops.push({ type: 'ROOM_UNAVAILABLE', message: 'Assigned room is not in service' });
    }
    if (session.deviceRef && !(await this.resourceService.isDeviceAvailable(session.deviceRef))) {
      stops.push({ type: 'DEVICE_UNAVAILABLE', message: 'Assigned device is not in service' });
    }

    const requiredSkillCode = (protocol?.items || []).find((i) => i.requiredSkillCode)?.requiredSkillCode;
    if (requiredSkillCode) {
      // technicianId is a direct User ref; doctorId refers to a Doctor document (not User),
      // so only technicianId can be checked against StaffSkill.userId here.
      const operatorUserId = session.technicianId || null;
      if (operatorUserId) {
        try {
          await this.resourceService.assertOperatorSkilled(operatorUserId, requiredSkillCode, session.branchId);
        } catch (err) {
          if (err?.code === 'OPERATOR_SKILL_MISSING') {
            stops.push({ type: HARD_STOP_TYPE.OPERATOR_SKILL_MISSING, message: err.message });
          } else if (err?.code === 'OPERATOR_SKILL_EXPIRED') {
            stops.push({ type: HARD_STOP_TYPE.OPERATOR_SKILL_EXPIRED, message: err.message });
          } else {
            throw err;
          }
        }
      }
    }

    if (!stops.length) return { protocol, overrides: [] };

    const canOverride = hasAnyPermission(req?.auth?.permissions || [], [
      PERMISSIONS.TREATMENT_HARD_STOP_OVERRIDE,
    ]);
    if (!override?.reason || !canOverride) {
      throw ApiError.conflict(
        `Treatment cannot start: ${stops.map((s) => s.message).join('; ')}`,
        'HARD_STOP_BLOCKED'
      );
    }

    const overrides = stops.map((s) => ({
      type: s.type,
      reason: override.reason,
      overriddenBy: actorId,
      overriddenAt: new Date(),
    }));

    await this.auditService.record(AUDIT_ACTIONS.TREATMENT_HARD_STOP_OVERRIDDEN, {
      actorId,
      metadata: { sessionId: session._id.toString(), stops: stops.map((s) => s.type), reason: override.reason },
      req,
    });

    return { protocol, overrides };
  }

  #map(doc, logs = null, progress = null) {
    if (!doc) return null;
    const extra = {};
    if (doc.patientId?.firstName) {
      extra.patient = {
        id: doc.patientId._id.toString(),
        mrn: doc.patientId.mrn,
        fullName: [doc.patientId.firstName, doc.patientId.lastName].filter(Boolean).join(' '),
        mobile: doc.patientId.mobile,
      };
      extra.patientId = doc.patientId._id.toString();
    }
    if (doc.doctorId?.doctorCode) {
      const u = doc.doctorId.userId;
      extra.doctor = {
        id: doc.doctorId._id.toString(),
        doctorCode: doc.doctorId.doctorCode,
        name: u ? `${u.firstName} ${u.lastName}`.trim() : null,
      };
      extra.doctorId = doc.doctorId._id.toString();
    }
    if (doc.technicianId?.firstName) {
      extra.technician = {
        id: doc.technicianId._id.toString(),
        fullName: `${doc.technicianId.firstName} ${doc.technicianId.lastName || ''}`.trim(),
        role: doc.technicianId.role,
      };
      extra.technicianId = doc.technicianId._id.toString();
    }
    if (doc.branchId?.name || doc.branchId?.displayName) {
      extra.branch = {
        id: doc.branchId._id.toString(),
        name: doc.branchId.displayName || doc.branchId.name,
      };
      extra.branchId = doc.branchId._id.toString();
    }
    if (doc.treatmentPlanId?.planNumber) {
      extra.treatmentPlan = {
        id: doc.treatmentPlanId._id.toString(),
        planNumber: doc.treatmentPlanId.planNumber,
        title: doc.treatmentPlanId.title,
        status: doc.treatmentPlanId.status,
        estimatedSessions: doc.treatmentPlanId.estimatedSessions,
      };
      extra.treatmentPlanId = doc.treatmentPlanId._id.toString();
    }
    if (doc.invoiceId?.invoiceNumber) {
      extra.invoice = {
        id: doc.invoiceId._id.toString(),
        invoiceNumber: doc.invoiceId.invoiceNumber,
        paymentStatus: doc.invoiceId.paymentStatus,
        status: doc.invoiceId.status,
        total: doc.invoiceId.total,
        paidAmount: doc.invoiceId.paidAmount,
        balanceAmount: doc.invoiceId.balanceAmount,
      };
      extra.invoiceId = doc.invoiceId._id.toString();
    }
    if (logs) extra.logs = logs.map((l) => l.toSafeObject());
    if (progress) extra.progress = progress;
    return doc.toSafeObject(extra);
  }

  #sessionLimit(plan) {
    if (plan.packageSnapshot?.maximumSessions) return Number(plan.packageSnapshot.maximumSessions);
    if (plan.estimatedSessions) return Number(plan.estimatedSessions);
    const fromItems = (plan.items || []).reduce((s, i) => s + (Number(i.sessionCount) || 0), 0);
    return fromItems > 0 ? fromItems : 1;
  }

  async #assertPaymentGate(plan, invoiceId) {
    if (plan.status !== TREATMENT_PLAN_STATUS.ACCEPTED) {
      throw ApiError.forbidden('Treatment plan must be Accepted before sessions can start');
    }
    if (!invoiceId) throw ApiError.badRequest('invoiceId is required');

    const invoice = await this.invoiceRepository.findByIdNotDeleted(invoiceId);
    if (!invoice) throw ApiError.badRequest('Invoice does not exist');
    if (String(invoice.patientId) !== String(plan.patientId)) {
      throw ApiError.badRequest('Invoice patient does not match treatment plan');
    }
    if (!SESSION_ALLOWED_PAYMENT_STATUSES.includes(invoice.paymentStatus)) {
      throw ApiError.forbidden(
        `Invoice payment status must be Paid or Partial (got ${invoice.paymentStatus})`
      );
    }
    return invoice;
  }

  async #assertCanCreateSession(plan, invoiceId) {
    await this.#assertPaymentGate(plan, invoiceId);

    const limit = this.#sessionLimit(plan);
    const used = await this.sessionRepository.countForPlan(plan._id);
    if (used >= limit) {
      throw ApiError.forbidden(`Session limit reached (${used}/${limit})`);
    }

    return { limit, used };
  }

  async getProgress(treatmentPlanId) {
    const plan = await this.planRepository.findByIdNotDeleted(treatmentPlanId);
    if (!plan) throw ApiError.notFound('Treatment plan not found');

    const limit = this.#sessionLimit(plan);
    const completed = await this.sessionRepository.countCompletedForPlan(plan._id);
    const used = await this.sessionRepository.countForPlan(plan._id);
    const remaining = Math.max(0, limit - used);
    const completionPercent = limit > 0 ? Math.min(100, Math.round((completed / limit) * 100)) : 0;

    const sessions = await this.sessionRepository.findByPlan(plan._id);
    const scheduled = sessions
      .filter((s) => s.scheduledDate && s.status !== TREATMENT_SESSION_STATUS.CANCELLED)
      .map((s) => s.scheduledDate)
      .sort((a, b) => b - a);
    const expectedEndDate = scheduled[0] || null;

    return {
      treatmentPlanId: plan._id.toString(),
      planNumber: plan.planNumber,
      title: plan.title,
      planStatus: plan.status,
      totalSessions: limit,
      completedSessions: completed,
      usedSessions: used,
      remainingSessions: remaining,
      completionPercent,
      expectedEndDate,
      sessions: sessions.map((s) => ({
        id: s._id.toString(),
        sessionNumber: s.sessionNumber,
        sessionIndex: s.sessionIndex,
        status: s.status,
        scheduledDate: s.scheduledDate,
        completedAt: s.completedAt,
      })),
    };
  }

  async getById(id) {
    const doc = await this.sessionRepository.findByIdPopulated(id);
    if (!doc) throw ApiError.notFound('Treatment session not found');
    const logs = await this.logRepository.findBySession(doc._id);
    const progress = await this.getProgress(doc.treatmentPlanId._id || doc.treatmentPlanId);
    return this.#map(doc, logs, progress);
  }

  async list(query = {}) {
    const limit = Math.min(Number(query.limit) || 50, 100);
    const page = Math.max(Number(query.page) || 1, 1);
    const skip = (page - 1) * limit;
    const { items, total } = await this.sessionRepository.list({
      treatmentPlanId: query.treatmentPlanId || null,
      patientId: query.patientId || null,
      doctorId: query.doctorId || null,
      technicianId: query.technicianId || null,
      branchId: query.branchId || null,
      status: query.status || null,
      limit,
      skip,
    });
    const mapped = await Promise.all(
      items.map(async (row) => {
        const populated = await this.sessionRepository.findByIdPopulated(row._id);
        return this.#map(populated);
      })
    );
    return { items: mapped, meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 } };
  }

  async create(payload, actorId, req = null) {
    if (!payload.treatmentPlanId) throw ApiError.badRequest('treatmentPlanId is required');
    const plan = await this.planRepository.findByIdNotDeleted(payload.treatmentPlanId);
    if (!plan) throw ApiError.notFound('Treatment plan not found');

    const invoiceId = payload.invoiceId || null;
    const { used } = await this.#assertCanCreateSession(plan, invoiceId);

    const session = await this.sessionRepository.create({
      sessionNumber: await generateSessionNumber(),
      treatmentPlanId: plan._id,
      patientId: plan.patientId,
      doctorId: plan.doctorId,
      technicianId: payload.technicianId || null,
      branchId: plan.branchId,
      appointmentId: payload.appointmentId || null,
      invoiceId,
      protocolId: plan.protocolId || payload.protocolId || null,
      status: TREATMENT_SESSION_STATUS.SCHEDULED,
      sessionIndex: used + 1,
      scheduledDate: payload.scheduledDate ? new Date(payload.scheduledDate) : null,
      roomId: payload.roomId || null,
      deviceId: payload.deviceId || null,
      remarks: payload.remarks || null,
      notes: payload.notes || null,
      followUp: {
        nextSessionDate: payload.followUp?.nextSessionDate || null,
        reviewDate: payload.followUp?.reviewDate || null,
        notes: payload.followUp?.notes || null,
      },
      createdBy: actorId,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.TREATMENT_SESSION_CREATED, {
      actorId,
      metadata: {
        sessionId: session._id.toString(),
        sessionNumber: session.sessionNumber,
        treatmentPlanId: plan._id.toString(),
      },
      branchId: session.branchId,
      resourceType: 'TreatmentSession',
      resourceId: session._id.toString(),
      req,
    });

    return this.getById(session._id.toString());
  }

  async update(id, payload, actorId) {
    const session = await this.sessionRepository.findByIdNotDeleted(id);
    if (!session) throw ApiError.notFound('Treatment session not found');
    if (
      [TREATMENT_SESSION_STATUS.COMPLETED, TREATMENT_SESSION_STATUS.CANCELLED].includes(
        session.status
      )
    ) {
      throw ApiError.forbidden('Cannot edit completed or cancelled sessions');
    }

    const updates = { updatedBy: actorId };
    for (const f of [
      'technicianId',
      'appointmentId',
      'roomId',
      'deviceId',
      'remarks',
      'notes',
      'complications',
      'outcome',
    ]) {
      if (payload[f] !== undefined) updates[f] = payload[f];
    }
    if (payload.scheduledDate !== undefined) {
      updates.scheduledDate = payload.scheduledDate ? new Date(payload.scheduledDate) : null;
    }
    if (payload.consumables) {
      updates.consumables = Array.isArray(payload.consumables)
        ? payload.consumables
        : String(payload.consumables)
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean);
    }
    if (payload.deviceUsage) {
      updates.deviceUsage = {
        device: payload.deviceUsage.device ?? session.deviceUsage?.device ?? null,
        machine: payload.deviceUsage.machine ?? session.deviceUsage?.machine ?? null,
        laserHead: payload.deviceUsage.laserHead ?? session.deviceUsage?.laserHead ?? null,
        settings: payload.deviceUsage.settings ?? session.deviceUsage?.settings ?? {},
      };
    }
    if (payload.followUp) {
      updates.followUp = {
        nextSessionDate:
          payload.followUp.nextSessionDate ?? session.followUp?.nextSessionDate ?? null,
        reviewDate: payload.followUp.reviewDate ?? session.followUp?.reviewDate ?? null,
        notes: payload.followUp.notes ?? session.followUp?.notes ?? null,
      };
    }

    await this.sessionRepository.updateById(id, updates);
    return this.getById(id);
  }

  async checkIn(id, actorId) {
    const session = await this.sessionRepository.findByIdNotDeleted(id);
    if (!session) throw ApiError.notFound('Treatment session not found');
    if (session.status !== TREATMENT_SESSION_STATUS.SCHEDULED) {
      throw ApiError.badRequest('Only scheduled sessions can be checked in');
    }
    await this.sessionRepository.updateById(id, {
      status: TREATMENT_SESSION_STATUS.CHECKED_IN,
      updatedBy: actorId,
    });
    return this.getById(id);
  }

  async start(id, payload = {}, actorId, req = null) {
    const session = await this.sessionRepository.findByIdNotDeleted(id);
    if (!session) throw ApiError.notFound('Treatment session not found');
    if (
      ![TREATMENT_SESSION_STATUS.SCHEDULED, TREATMENT_SESSION_STATUS.CHECKED_IN].includes(
        session.status
      )
    ) {
      throw ApiError.badRequest('Session cannot be started from current status');
    }

    // Re-validate payment gate on start (do not re-check session limit)
    const plan = await this.planRepository.findByIdNotDeleted(session.treatmentPlanId);
    await this.#assertPaymentGate(plan, session.invoiceId);

    const { protocol, overrides } = await this.#assertHardStops(session, plan, actorId, req, payload.override);

    const startedAt = new Date();
    await this.sessionRepository.updateById(id, {
      status: TREATMENT_SESSION_STATUS.IN_PROGRESS,
      startedAt,
      technicianId: payload.technicianId || session.technicianId || actorId,
      protocolVersionSnapshot: protocol
        ? { protocolId: protocol._id.toString(), version: protocol.version, snapshotAt: new Date() }
        : session.protocolVersionSnapshot,
      ...(overrides.length ? { $push: { hardStopOverrides: { $each: overrides } } } : {}),
      deviceUsage: payload.deviceUsage
        ? {
            device: payload.deviceUsage.device || null,
            machine: payload.deviceUsage.machine || null,
            laserHead: payload.deviceUsage.laserHead || null,
            settings: payload.deviceUsage.settings || {},
          }
        : session.deviceUsage,
      updatedBy: actorId,
    });

    await this.logRepository.create({
      treatmentSessionId: session._id,
      startTime: startedAt,
      operatorId: payload.technicianId || session.technicianId || actorId,
      operatorName: payload.operatorName || null,
      deviceUsed: payload.deviceUsage?.device || session.deviceId || null,
      machineSettings: payload.deviceUsage?.settings || {},
      consumables: payload.consumables || [],
      notes: 'Session started',
      createdBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.TREATMENT_SESSION_STARTED, {
      actorId,
      metadata: { sessionId: id, sessionNumber: session.sessionNumber },
      branchId: session.branchId,
      resourceType: 'TreatmentSession',
      resourceId: id,
      req,
    });

    const eventPayload = {
      sessionId: id,
      sessionNumber: session.sessionNumber,
      treatmentPlanId: session.treatmentPlanId.toString(),
      patientId: session.patientId.toString(),
      doctorId: session.doctorId.toString(),
      branchId: session.branchId.toString(),
    };
    eventBus.emitDomain(TREATMENT_SESSION_EVENTS.STARTED, eventPayload);
    emitQueueEvent(SOCKET_EVENTS.TREATMENT_SESSION_STARTED, eventPayload);

    return this.getById(id);
  }

  /**
   * Decrement the parent plan's packageSnapshot.unusedSessions by 1 on successful completion.
   * No-op for pay-per-session plans (no packageSnapshot / non-numeric unusedSessions).
   * The $gt: 0 guard makes this idempotent against double-decrement (defense in depth on top
   * of the IN_PROGRESS status check in complete() that already blocks re-completion) and
   * prevents the counter from ever going negative.
   */
  async #decrementPackageBalance(session, actorId) {
    try {
      const plan = await this.planRepository.findByIdNotDeleted(session.treatmentPlanId);
      if (!plan?.packageSnapshot || typeof plan.packageSnapshot.unusedSessions !== 'number') {
        return;
      }
      const updated = await this.planRepository.model
        .findOneAndUpdate(
          { _id: plan._id, 'packageSnapshot.unusedSessions': { $gt: 0 } },
          { $inc: { 'packageSnapshot.unusedSessions': -1 }, $set: { updatedBy: actorId } },
          { new: true }
        )
        .exec();
      if (!updated) {
        logger.warn(
          'TreatmentSessionService.complete: packageSnapshot.unusedSessions already 0 — skipped decrement',
          { treatmentPlanId: plan._id.toString(), sessionId: session._id.toString() }
        );
      }
    } catch (err) {
      logger.error(
        'TreatmentSessionService.complete: failed to decrement packageSnapshot.unusedSessions',
        {
          sessionId: session._id.toString(),
          treatmentPlanId: session.treatmentPlanId?.toString?.(),
          error: err.message,
        }
      );
    }
  }

  /**
   * Deduct real inventory stock for consumables actually used on this session, via
   * InventoryService.consumeForTreatment (the existing, only sanctioned entry point for
   * stock mutation). Falls back to the protocol's default consumables list when neither the
   * completion payload nor the session recorded any actual-usage override. Consumables are
   * free-text names (no inventoryItemId on the session/protocol schemas) so each name is
   * resolved to an InventoryItem by exact case-insensitive match within the session's branch;
   * unmatched names are logged and skipped rather than blocking session completion.
   */
  async #consumeSessionInventory(session, consumables, actorId, req) {
    let names = Array.isArray(consumables) ? consumables.filter(Boolean) : [];

    if (!names.length && session.protocolId) {
      try {
        const protocol = await TreatmentProtocol.findById(session.protocolId).exec();
        names = (protocol?.items || []).flatMap((i) => i.consumables || []);
      } catch (err) {
        logger.error(
          'TreatmentSessionService.complete: failed to load protocol default consumables',
          { sessionId: session._id.toString(), error: err.message }
        );
      }
    }
    if (!names.length) return;

    const quantityByName = new Map();
    for (const raw of names) {
      const name = String(raw).trim();
      if (!name) continue;
      quantityByName.set(name, (quantityByName.get(name) || 0) + 1);
    }

    for (const [name, quantity] of quantityByName.entries()) {
      try {
        const item = await this.inventoryService.findItemByName(name, session.branchId);
        if (!item) {
          logger.warn(
            'TreatmentSessionService.complete: no matching inventory item for consumable — stock not deducted',
            { sessionId: session._id.toString(), branchId: session.branchId.toString(), consumable: name }
          );
          continue;
        }
        await this.inventoryService.consumeForTreatment({
          inventoryItemId: item._id.toString(),
          quantity,
          treatmentSessionId: session._id.toString(),
          actorId,
          req,
        });
      } catch (err) {
        logger.error('TreatmentSessionService.complete: failed to deduct inventory for consumable', {
          sessionId: session._id.toString(),
          consumable: name,
          error: err.message,
        });
      }
    }
  }

  async complete(id, payload = {}, actorId, req = null) {
    const session = await this.sessionRepository.findByIdNotDeleted(id);
    if (!session) throw ApiError.notFound('Treatment session not found');
    if (session.status !== TREATMENT_SESSION_STATUS.IN_PROGRESS) {
      throw ApiError.badRequest('Only in-progress sessions can be completed');
    }

    const completedAt = new Date();
    const duration = session.startedAt
      ? Math.round((completedAt - new Date(session.startedAt)) / 60000)
      : payload.duration || null;

    const finalConsumables = payload.consumables || session.consumables;

    await this.sessionRepository.updateById(id, {
      status: TREATMENT_SESSION_STATUS.COMPLETED,
      completedAt,
      duration,
      complications: payload.complications ?? session.complications,
      outcome: payload.outcome ?? session.outcome,
      consumables: finalConsumables,
      notes: payload.notes ?? session.notes,
      followUp: payload.followUp
        ? {
            nextSessionDate: payload.followUp.nextSessionDate || null,
            reviewDate: payload.followUp.reviewDate || null,
            notes: payload.followUp.notes || null,
          }
        : session.followUp,
      deviceUsage: payload.deviceUsage
        ? {
            device: payload.deviceUsage.device || null,
            machine: payload.deviceUsage.machine || null,
            laserHead: payload.deviceUsage.laserHead || null,
            settings: payload.deviceUsage.settings || {},
          }
        : session.deviceUsage,
      updatedBy: actorId,
    });

    await this.logRepository.create({
      treatmentSessionId: session._id,
      startTime: session.startedAt,
      endTime: completedAt,
      operatorId: session.technicianId || actorId,
      deviceUsed: payload.deviceUsage?.device || session.deviceUsage?.device || null,
      machineSettings: payload.deviceUsage?.settings || session.deviceUsage?.settings || {},
      consumables: finalConsumables || [],
      complications: payload.complications || null,
      outcome: payload.outcome || null,
      notes: 'Session completed',
      createdBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.TREATMENT_SESSION_COMPLETED, {
      actorId,
      metadata: { sessionId: id, sessionNumber: session.sessionNumber },
      branchId: session.branchId,
      resourceType: 'TreatmentSession',
      resourceId: id,
      req,
    });

    const eventPayload = {
      sessionId: id,
      sessionNumber: session.sessionNumber,
      treatmentPlanId: session.treatmentPlanId.toString(),
      patientId: session.patientId.toString(),
      doctorId: session.doctorId.toString(),
      branchId: session.branchId.toString(),
    };
    eventBus.emitDomain(TREATMENT_SESSION_EVENTS.COMPLETED, eventPayload);
    emitQueueEvent(SOCKET_EVENTS.TREATMENT_SESSION_COMPLETED, eventPayload);

    // Package balance + inventory stock — best-effort side effects, run after the session is
    // already durably marked COMPLETED above. Billing/invoices remain untouched (out of scope).
    await this.#decrementPackageBalance(session, actorId);
    await this.#consumeSessionInventory(session, finalConsumables, actorId, req);

    // Progress only — do NOT mutate treatment plan document further
    const progress = await this.getProgress(session.treatmentPlanId);
    if (progress.completedSessions >= progress.totalSessions && progress.totalSessions > 0) {
      eventBus.emitDomain(TREATMENT_SESSION_EVENTS.PLAN_COMPLETED, {
        treatmentPlanId: session.treatmentPlanId.toString(),
        completedSessions: progress.completedSessions,
        totalSessions: progress.totalSessions,
        patientId: session.patientId.toString(),
      });
    }

    return this.getById(id);
  }

  async cancel(id, actorId, req = null) {
    const session = await this.sessionRepository.findByIdNotDeleted(id);
    if (!session) throw ApiError.notFound('Treatment session not found');
    if (session.status === TREATMENT_SESSION_STATUS.COMPLETED) {
      throw ApiError.badRequest('Cannot cancel a completed session');
    }
    await this.sessionRepository.updateById(id, {
      status: TREATMENT_SESSION_STATUS.CANCELLED,
      updatedBy: actorId,
    });
    await this.auditService.record(AUDIT_ACTIONS.TREATMENT_SESSION_CANCELLED, {
      actorId,
      metadata: { sessionId: id },
      branchId: session.branchId,
      resourceType: 'TreatmentSession',
      resourceId: id,
      req,
    });
    return this.getById(id);
  }

  /**
   * Reverse a completed session back to a re-doable state (IN_PROGRESS — the state complete()
   * requires and from which the session was originally completed), re-crediting the package
   * session it consumed. Mirrors/inverts #decrementPackageBalance; only the embedded
   * packageSnapshot.unusedSessions counter is touched (this codebase has no separate
   * per-session TreatmentPackage document to reconcile — see #decrementPackageBalance).
   */
  async reverseSessionCompletion(id, { reason } = {}, actorId, req = null) {
    if (!reason || !String(reason).trim()) {
      throw ApiError.badRequest('A reason is required to reverse a session completion');
    }
    const session = await this.sessionRepository.findByIdNotDeleted(id);
    if (!session) throw ApiError.notFound('Treatment session not found');
    if (session.status !== TREATMENT_SESSION_STATUS.COMPLETED) {
      throw ApiError.badRequest('Only completed sessions can be reversed');
    }

    try {
      const plan = await this.planRepository.findByIdNotDeleted(session.treatmentPlanId);
      if (plan?.packageSnapshot && typeof plan.packageSnapshot.unusedSessions === 'number') {
        const max = plan.packageSnapshot.maximumSessions;
        const filter = { _id: plan._id };
        if (typeof max === 'number') {
          filter['packageSnapshot.unusedSessions'] = { $lt: max };
        }
        const updated = await this.planRepository.model
          .findOneAndUpdate(
            filter,
            { $inc: { 'packageSnapshot.unusedSessions': 1 }, $set: { updatedBy: actorId } },
            { new: true }
          )
          .exec();
        if (!updated) {
          logger.warn(
            'TreatmentSessionService.reverseSessionCompletion: packageSnapshot.unusedSessions already at max — skipped re-credit',
            { treatmentPlanId: plan._id.toString(), sessionId: session._id.toString() }
          );
        }
      }
    } catch (err) {
      logger.error(
        'TreatmentSessionService.reverseSessionCompletion: failed to re-credit packageSnapshot.unusedSessions',
        {
          sessionId: session._id.toString(),
          treatmentPlanId: session.treatmentPlanId?.toString?.(),
          error: err.message,
        }
      );
    }

    await this.sessionRepository.updateById(id, {
      status: TREATMENT_SESSION_STATUS.IN_PROGRESS,
      completedAt: null,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.TREATMENT_SESSION_COMPLETION_REVERSED, {
      actorId,
      metadata: { sessionId: id, sessionNumber: session.sessionNumber, reason },
      branchId: session.branchId,
      resourceType: 'TreatmentSession',
      resourceId: id,
      req,
    });

    // LOY-006 — best-effort/non-blocking: claw back only points EARNED (CREDIT) for this
    // session, never any DEBIT_REDEEM entries. Mirrors BillingService's clawback wiring on
    // refund()/voidDraft() — logs and swallows failures so it never blocks the reversal.
    await this.#clawbackEarnedLoyaltyPoints(session, `Session completion reversed — ${reason}`, actorId, req);

    return this.getById(id);
  }

  /**
   * LOY-006 — sums CREDIT (earned) points sourced to this session, subtracts anything already
   * clawed back for it, and claws back the remainder. Never touches DEBIT_REDEEM entries.
   */
  async #clawbackEarnedLoyaltyPoints(session, reasonNote, actorId, req) {
    try {
      const [creditRows, clawedRows] = await Promise.all([
        LoyaltyLedgerEntry.aggregate([
          {
            $match: {
              sourceRefType: LOYALTY_SOURCE_REF_TYPE.TREATMENT_SESSION,
              sourceRefId: session._id,
              entryType: LOYALTY_ENTRY_TYPE.CREDIT,
            },
          },
          { $group: { _id: null, total: { $sum: '$points' } } },
        ]),
        LoyaltyLedgerEntry.aggregate([
          {
            $match: {
              sourceRefType: LOYALTY_SOURCE_REF_TYPE.TREATMENT_SESSION,
              sourceRefId: session._id,
              entryType: LOYALTY_ENTRY_TYPE.DEBIT_CLAWBACK,
            },
          },
          { $group: { _id: null, total: { $sum: '$points' } } },
        ]),
      ]);
      const totalEarned = creditRows[0]?.total || 0;
      const alreadyClawed = clawedRows[0]?.total || 0;
      const remaining = totalEarned - alreadyClawed;
      if (remaining <= 0) return;

      await this.loyaltyLedgerService.clawback({
        branchId: session.branchId,
        patientId: session.patientId,
        points: remaining,
        sourceRefType: LOYALTY_SOURCE_REF_TYPE.TREATMENT_SESSION,
        sourceRefId: session._id,
        reasonNote,
        createdBy: actorId,
        actorReq: req,
      });
    } catch (err) {
      logger.error('TreatmentSessionService: loyalty clawback failed (non-blocking)', {
        sessionId: session._id.toString(),
        error: err.message,
      });
    }
  }

  async skip(id, actorId, req = null) {
    const session = await this.sessionRepository.findByIdNotDeleted(id);
    if (!session) throw ApiError.notFound('Treatment session not found');
    if (
      ![TREATMENT_SESSION_STATUS.SCHEDULED, TREATMENT_SESSION_STATUS.CHECKED_IN].includes(
        session.status
      )
    ) {
      throw ApiError.badRequest('Only scheduled/checked-in sessions can be skipped');
    }
    await this.sessionRepository.updateById(id, {
      status: TREATMENT_SESSION_STATUS.SKIPPED,
      updatedBy: actorId,
    });
    await this.auditService.record(AUDIT_ACTIONS.TREATMENT_SESSION_SKIPPED, {
      actorId,
      metadata: { sessionId: id },
      branchId: session.branchId,
      resourceType: 'TreatmentSession',
      resourceId: id,
      req,
    });
    return this.getById(id);
  }

  async reschedule(id, { scheduledDate }, actorId, req = null) {
    const session = await this.sessionRepository.findByIdNotDeleted(id);
    if (!session) throw ApiError.notFound('Treatment session not found');
    if (
      [TREATMENT_SESSION_STATUS.COMPLETED, TREATMENT_SESSION_STATUS.CANCELLED].includes(
        session.status
      )
    ) {
      throw ApiError.badRequest('Cannot reschedule completed/cancelled session');
    }
    if (!scheduledDate) throw ApiError.badRequest('scheduledDate is required');

    await this.sessionRepository.updateById(id, {
      scheduledDate: new Date(scheduledDate),
      status: TREATMENT_SESSION_STATUS.SCHEDULED,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.TREATMENT_SESSION_RESCHEDULED, {
      actorId,
      metadata: { sessionId: id, scheduledDate },
      req,
    });

    return this.getById(id);
  }

  async uploadPhoto(id, { file, photoType = 'BEFORE', title }, actorId, req = null) {
    const session = await this.sessionRepository.findByIdNotDeleted(id);
    if (!session) throw ApiError.notFound('Treatment session not found');
    if (!file?.buffer) throw ApiError.badRequest('File is required');

    const type = String(photoType).toUpperCase() === 'AFTER' ? 'AFTER' : 'BEFORE';
    const saved = await this.storage.save(file.buffer, {
      folder: `treatment-sessions/${id}/photos`,
      filename: `${Date.now()}-${file.originalname.replace(/[^\w.\-]+/g, '_')}`,
      mimeType: file.mimetype,
    });

    // Reuse ClinicalPhoto model when plan has consultationId (additive metadata only)
    let photoId = null;
    const plan = await this.planRepository.findByIdNotDeleted(session.treatmentPlanId);
    if (plan?.consultationId) {
      const photo = await this.photoRepository.create({
        consultationId: plan.consultationId,
        patientId: session.patientId,
        photoType: type === 'AFTER' ? PHOTO_TYPE.AFTER : PHOTO_TYPE.BEFORE,
        title: title || file.originalname,
        storageKey: saved.key,
        originalName: file.originalname,
        mimeType: saved.mimeType,
        size: saved.size,
        metadata: { treatmentSessionId: id, source: 'treatment_session' },
        uploadedBy: actorId,
      });
      photoId = photo._id;
    }

    const ref = {
      photoId,
      storageKey: saved.key,
      originalName: file.originalname,
      mimeType: saved.mimeType,
      title: title || file.originalname,
      photoType: type,
      url: `/uploads/${saved.key}`,
    };

    const field = type === 'AFTER' ? 'photosAfter' : 'photosBefore';
    await this.sessionRepository.updateById(id, {
      $push: { [field]: ref },
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.TREATMENT_SESSION_PHOTO_UPLOADED, {
      actorId,
      metadata: { sessionId: id, photoType: type, storageKey: saved.key },
      req,
    });

    return this.getById(id);
  }

  async getPrintData(id, actorId, req = null) {
    const session = await this.getById(id);
    const progress = session.progress || (await this.getProgress(session.treatmentPlanId));
    await this.auditService.record(AUDIT_ACTIONS.TREATMENT_SESSION_PRINTED, {
      actorId,
      metadata: { sessionId: id },
      req,
    });
    return {
      session,
      progress,
      printMeta: {
        printedAt: new Date().toISOString(),
        qrPlaceholder: true,
      },
    };
  }

  async dashboard({ branchId = null, doctorId = null } = {}) {
    const filter = { deletedAt: null };
    if (branchId) filter.branchId = branchId;
    if (doctorId) filter.doctorId = doctorId;

    const [scheduled, inProgress, completedToday, total] = await Promise.all([
      this.sessionRepository.count({
        ...filter,
        status: {
          $in: [TREATMENT_SESSION_STATUS.SCHEDULED, TREATMENT_SESSION_STATUS.CHECKED_IN],
        },
      }),
      this.sessionRepository.count({ ...filter, status: TREATMENT_SESSION_STATUS.IN_PROGRESS }),
      this.sessionRepository.count({
        ...filter,
        status: TREATMENT_SESSION_STATUS.COMPLETED,
        completedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      }),
      this.sessionRepository.count(filter),
    ]);

    const recent = await this.sessionRepository.list({
      branchId,
      doctorId,
      limit: 10,
      skip: 0,
    });
    const items = await Promise.all(
      recent.items.map(async (r) =>
        this.#map(await this.sessionRepository.findByIdPopulated(r._id))
      )
    );

    return {
      summary: { scheduled, inProgress, completedToday, total },
      recent: items,
    };
  }
}

export default TreatmentSessionService;
