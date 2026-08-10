import ApiError from '../libs/ApiError.js';
import {
  TreatmentPlanRepository,
  TreatmentProtocolRepository,
  TreatmentPackageRepository,
  ConsentRecordRepository,
} from '../repositories/TreatmentPlanRepository.js';
import ConsultationRepository from '../repositories/ConsultationRepository.js';
import AuditService from './AuditService.js';
import {
  generateTreatmentPlanNumber,
  generateProtocolCode,
  generatePackageCode,
} from '../helpers/treatmentPlanNumber.helper.js';
import {
  CONSENT_STATUS,
  CONSENT_TYPE,
  CONSENT_TYPE_LIST,
  EDITABLE_TREATMENT_PLAN_STATUSES,
  TREATMENT_PLAN_PRIORITY,
  TREATMENT_PLAN_STATUS,
} from '../enums/treatmentPlan.js';
import { CONSULTATION_STATUS } from '../enums/consultation.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import logger from '../libs/logger.js';

const CONSENT_TITLES = Object.freeze({
  [CONSENT_TYPE.LASER]: 'Laser Treatment Consent',
  [CONSENT_TYPE.PHOTOGRAPHY]: 'Clinical Photography Consent',
  [CONSENT_TYPE.TREATMENT]: 'General Treatment Consent',
  [CONSENT_TYPE.PROCEDURE]: 'Procedure Consent',
});

const CONSENT_BODIES = Object.freeze({
  [CONSENT_TYPE.LASER]:
    'I understand the nature of laser treatment, possible side effects, and aftercare requirements.',
  [CONSENT_TYPE.PHOTOGRAPHY]:
    'I consent to clinical photographs being taken for documentation and treatment planning.',
  [CONSENT_TYPE.TREATMENT]:
    'I consent to the recommended treatment plan and acknowledge risks and expected outcomes.',
  [CONSENT_TYPE.PROCEDURE]:
    'I consent to the proposed procedure(s) as explained by my doctor.',
});

/**
 * Treatment Planning only — does not create sessions, billing, or inventory movements.
 */
class TreatmentPlanService {
  constructor() {
    this.planRepository = new TreatmentPlanRepository();
    this.protocolRepository = new TreatmentProtocolRepository();
    this.packageRepository = new TreatmentPackageRepository();
    this.consentRepository = new ConsentRecordRepository();
    this.consultationRepository = new ConsultationRepository();
    this.auditService = new AuditService();
  }

  #map(doc, consents = null) {
    if (!doc) return null;
    const extra = {};
    if (doc.patientId?.firstName) {
      extra.patient = {
        id: doc.patientId._id.toString(),
        mrn: doc.patientId.mrn,
        fullName: [doc.patientId.firstName, doc.patientId.lastName].filter(Boolean).join(' '),
        mobile: doc.patientId.mobile,
        dateOfBirth: doc.patientId.dateOfBirth,
        gender: doc.patientId.gender,
      };
      extra.patientId = doc.patientId._id.toString();
    }
    if (doc.doctorId?.doctorCode) {
      const u = doc.doctorId.userId;
      extra.doctor = {
        id: doc.doctorId._id.toString(),
        doctorCode: doc.doctorId.doctorCode,
        name: u ? `${u.firstName} ${u.lastName}`.trim() : null,
        specialization: doc.doctorId.specialization,
      };
      extra.doctorId = doc.doctorId._id.toString();
    }
    if (doc.branchId?.name || doc.branchId?.displayName) {
      extra.branch = {
        id: doc.branchId._id.toString(),
        name: doc.branchId.displayName || doc.branchId.name,
        branchCode: doc.branchId.branchCode,
        address: doc.branchId.address,
        phone: doc.branchId.phone,
      };
      extra.branchId = doc.branchId._id.toString();
    }
    if (doc.consultationId?.consultationNumber) {
      extra.consultation = {
        id: doc.consultationId._id.toString(),
        consultationNumber: doc.consultationId.consultationNumber,
        status: doc.consultationId.status,
      };
      extra.consultationId = doc.consultationId._id.toString();
    }
    if (doc.protocolId?.name || doc.protocolId?.protocolCode) {
      extra.protocol = {
        id: doc.protocolId._id.toString(),
        protocolCode: doc.protocolId.protocolCode,
        name: doc.protocolId.name,
        category: doc.protocolId.category,
      };
      extra.protocolId = doc.protocolId._id.toString();
    }
    if (consents) {
      extra.consents = consents.map((c) => c.toSafeObject());
    }
    return doc.toSafeObject(extra);
  }

  async #assertConsultationUsable(consultationId) {
    const consultation = await this.consultationRepository.findByIdNotDeleted(consultationId);
    if (!consultation) throw ApiError.notFound('Consultation not found');
    if (!consultation.patientId) throw ApiError.badRequest('Consultation has no patient');
    if (!consultation.doctorId) throw ApiError.badRequest('Consultation has no doctor');
    if (consultation.locked || consultation.status === CONSULTATION_STATUS.LOCKED) {
      throw ApiError.forbidden('Consultation is locked — treatment plans cannot be changed');
    }
    return consultation;
  }

  #assertEditable(plan) {
    if (!EDITABLE_TREATMENT_PLAN_STATUSES.includes(plan.status)) {
      throw ApiError.forbidden('Plan cannot be edited after Accepted');
    }
  }

  #normalizeItems(items = []) {
    if (!Array.isArray(items)) return [];
    return items
      .filter((raw) => raw?.procedureName?.trim())
      .map((raw) => ({
        serviceId: raw.serviceId || null,
        procedureName: raw.procedureName.trim(),
        sessionCount: Number(raw.sessionCount) > 0 ? Number(raw.sessionCount) : 1,
        sessionDuration: Number(raw.sessionDuration) > 0 ? Number(raw.sessionDuration) : 30,
        frequency: raw.frequency || null,
        deviceRequired: raw.deviceRequired || null,
        roomRequired: raw.roomRequired || null,
        technicianRequired: raw.technicianRequired !== false,
        consumables: Array.isArray(raw.consumables)
          ? raw.consumables.map((c) => String(c).trim()).filter(Boolean)
          : typeof raw.consumables === 'string' && raw.consumables.trim()
            ? raw.consumables.split(',').map((c) => c.trim()).filter(Boolean)
            : [],
        preInstructions: raw.preInstructions || null,
        postInstructions: raw.postInstructions || null,
        notes: raw.notes || null,
        protocolId: raw.protocolId || null,
        patchTestRequired: raw.patchTestRequired || false,
        consentRequired: raw.consentRequired !== false,
        requiredSkillCode: raw.requiredSkillCode || null,
        parameters: raw.parameters || {},
      }));
  }

  async #ensureDefaultConsents(plan, actorId, types = CONSENT_TYPE_LIST) {
    const existing = await this.consentRepository.findByPlan(plan._id);
    const have = new Set(existing.map((c) => c.consentType));
    for (const type of types) {
      if (have.has(type)) continue;
      await this.consentRepository.create({
        treatmentPlanId: plan._id,
        patientId: plan.patientId,
        consentType: type,
        status: CONSENT_STATUS.PENDING,
        title: CONSENT_TITLES[type],
        body: CONSENT_BODIES[type],
        createdBy: actorId,
        updatedBy: actorId,
      });
    }
  }

  async create(payload, actorId, req = null) {
    const { consultationId } = payload;
    if (!consultationId) throw ApiError.badRequest('consultationId is required');
    if (!payload.title?.trim()) throw ApiError.badRequest('title is required');

    const consultation = await this.#assertConsultationUsable(consultationId);
    const items = this.#normalizeItems(payload.items || []);

    const plan = await this.planRepository.create({
      planNumber: await generateTreatmentPlanNumber(),
      consultationId: consultation._id,
      patientId: consultation.patientId,
      doctorId: consultation.doctorId,
      branchId: consultation.branchId,
      title: payload.title.trim(),
      description: payload.description || null,
      category: payload.category || 'Other',
      clinicalGoal: payload.clinicalGoal || null,
      estimatedDuration: payload.estimatedDuration || null,
      estimatedSessions: payload.estimatedSessions || items.reduce((s, i) => s + (i.sessionCount || 0), 0) || 1,
      status: TREATMENT_PLAN_STATUS.DRAFT,
      priority: payload.priority || TREATMENT_PLAN_PRIORITY.NORMAL,
      remarks: payload.remarks || null,
      diagnosisSummary: payload.diagnosisSummary || null,
      protocolId: payload.protocolId || null,
      items,
      goals: {
        expectedResults: payload.goals?.expectedResults || null,
        clinicalObjectives: payload.goals?.clinicalObjectives || null,
        beforePhotosReference: payload.goals?.beforePhotosReference || null,
        reviewDate: payload.goals?.reviewDate || null,
      },
      followUp: {
        reviewAfterDays: payload.followUp?.reviewAfterDays ?? null,
        reviewAfterSession: payload.followUp?.reviewAfterSession ?? null,
      },
      createdBy: actorId,
      updatedBy: actorId,
    });

    await this.#ensureDefaultConsents(plan, actorId);

    await this.auditService.record(AUDIT_ACTIONS.TREATMENT_PLAN_CREATED, {
      actorId,
      metadata: {
        treatmentPlanId: plan._id.toString(),
        planNumber: plan.planNumber,
        consultationId,
      },
      req,
    });

    if (payload.protocolId) {
      await this.auditService.record(AUDIT_ACTIONS.PROTOCOL_SELECTED, {
        actorId,
        metadata: {
          treatmentPlanId: plan._id.toString(),
          protocolId: payload.protocolId,
        },
        req,
      });
    }

    return this.getById(plan._id.toString());
  }

  async getById(id) {
    const doc = await this.planRepository.findByIdPopulated(id);
    if (!doc) throw ApiError.notFound('Treatment plan not found');
    const consents = await this.consentRepository.findByPlan(doc._id);
    return this.#map(doc, consents);
  }

  async listByConsultation(consultationId) {
    const rows = await this.planRepository.findByConsultation(consultationId);
    return Promise.all(rows.map((r) => this.getById(r._id.toString())));
  }

  async listByPatient(patientId) {
    const rows = await this.planRepository.findByPatient(patientId);
    return Promise.all(rows.map((r) => this.getById(r._id.toString())));
  }

  async listByDoctor(doctorId, opts = {}) {
    const rows = await this.planRepository.findByDoctor(doctorId, opts);
    return Promise.all(rows.map((r) => this.getById(r._id.toString())));
  }

  async update(id, payload, actorId, _req = null) {
    const plan = await this.planRepository.findByIdNotDeleted(id);
    if (!plan) throw ApiError.notFound('Treatment plan not found');
    this.#assertEditable(plan);
    await this.#assertConsultationUsable(plan.consultationId);

    const updates = { updatedBy: actorId };
    const fields = [
      'title',
      'description',
      'category',
      'clinicalGoal',
      'estimatedDuration',
      'estimatedSessions',
      'priority',
      'remarks',
      'diagnosisSummary',
    ];
    for (const f of fields) {
      if (payload[f] !== undefined) updates[f] = payload[f];
    }
    if (payload.items) updates.items = this.#normalizeItems(payload.items);
    if (payload.goals) {
      updates.goals = {
        expectedResults: payload.goals.expectedResults ?? plan.goals?.expectedResults ?? null,
        clinicalObjectives:
          payload.goals.clinicalObjectives ?? plan.goals?.clinicalObjectives ?? null,
        beforePhotosReference:
          payload.goals.beforePhotosReference ?? plan.goals?.beforePhotosReference ?? null,
        reviewDate: payload.goals.reviewDate ?? plan.goals?.reviewDate ?? null,
      };
    }
    if (payload.followUp) {
      updates.followUp = {
        reviewAfterDays:
          payload.followUp.reviewAfterDays ?? plan.followUp?.reviewAfterDays ?? null,
        reviewAfterSession:
          payload.followUp.reviewAfterSession ?? plan.followUp?.reviewAfterSession ?? null,
      };
    }

    await this.planRepository.updateById(id, updates);
    return this.getById(id);
  }

  async deleteDraft(id, actorId) {
    const plan = await this.planRepository.findByIdNotDeleted(id);
    if (!plan) throw ApiError.notFound('Treatment plan not found');
    if (plan.status !== TREATMENT_PLAN_STATUS.DRAFT) {
      throw ApiError.forbidden('Only draft plans can be deleted');
    }
    await this.planRepository.updateById(id, {
      deletedAt: new Date(),
      deletedBy: actorId,
      updatedBy: actorId,
    });
    return { id };
  }

  async applyProtocol(id, protocolId, actorId, req = null) {
    const plan = await this.planRepository.findByIdNotDeleted(id);
    if (!plan) throw ApiError.notFound('Treatment plan not found');
    this.#assertEditable(plan);
    await this.#assertConsultationUsable(plan.consultationId);

    const protocol = await this.protocolRepository.findByIdNotDeleted(protocolId);
    if (!protocol || !protocol.isActive) throw ApiError.notFound('Protocol not found');

    const items = this.#normalizeItems(
      (protocol.items || []).map((item) => ({
        ...item.toObject?.() ?? item,
        protocolId: protocol._id,
      }))
    );

    await this.planRepository.updateById(id, {
      protocolId: protocol._id,
      title: plan.title || protocol.name,
      category: protocol.category || plan.category,
      clinicalGoal: protocol.clinicalGoal || plan.clinicalGoal,
      estimatedDuration: protocol.estimatedDuration || plan.estimatedDuration,
      estimatedSessions: protocol.estimatedSessions || plan.estimatedSessions,
      description: plan.description || protocol.description,
      items,
      updatedBy: actorId,
    });

    const consentTypes =
      protocol.defaultConsents?.length > 0 ? protocol.defaultConsents : CONSENT_TYPE_LIST;
    await this.#ensureDefaultConsents(
      await this.planRepository.findByIdNotDeleted(id),
      actorId,
      consentTypes
    );

    await this.auditService.record(AUDIT_ACTIONS.PROTOCOL_SELECTED, {
      actorId,
      metadata: {
        treatmentPlanId: id,
        protocolId,
        protocolCode: protocol.protocolCode,
      },
      req,
    });

    return this.getById(id);
  }

  async applyPackage(id, packageId, actorId, req = null) {
    const plan = await this.planRepository.findByIdNotDeleted(id);
    if (!plan) throw ApiError.notFound('Treatment plan not found');
    this.#assertEditable(plan);

    const pkg = await this.packageRepository.findByIdNotDeleted(packageId);
    if (!pkg || !pkg.isActive) throw ApiError.notFound('Package not found');

    const maximumSessions = pkg.maximumSessions;
    await this.planRepository.updateById(id, {
      packageSnapshot: {
        packageId: pkg._id,
        packageName: pkg.name,
        packagePrice: pkg.packagePrice,
        discount: pkg.discount || 0,
        validityDays: pkg.validityDays,
        maximumSessions,
        unusedSessions: maximumSessions,
      },
      estimatedSessions: plan.estimatedSessions || maximumSessions,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.PACKAGE_ADDED, {
      actorId,
      metadata: {
        treatmentPlanId: id,
        packageId,
        packageName: pkg.name,
        packagePrice: pkg.packagePrice,
      },
      req,
    });

    return this.getById(id);
  }

  async clearPackage(id, actorId) {
    const plan = await this.planRepository.findByIdNotDeleted(id);
    if (!plan) throw ApiError.notFound('Treatment plan not found');
    this.#assertEditable(plan);
    await this.planRepository.updateById(id, {
      packageSnapshot: null,
      updatedBy: actorId,
    });
    return this.getById(id);
  }

  /**
   * Simple package-branch transfer (batch fix — deliberately NOT a request/approve/dispatch
   * workflow like StockTransferRequest). Reassigns which branch "owns" an in-progress plan's
   * package for reporting/consumption purposes. No pricing reconciliation between branches is
   * performed — that is explicitly out of scope.
   */
  async transferPackageOwnership(planId, targetBranchId, { reason } = {}, actorId, req = null) {
    if (!reason || !String(reason).trim()) {
      throw ApiError.badRequest('A reason is required to transfer package ownership');
    }
    if (!targetBranchId) {
      throw ApiError.badRequest('targetBranchId is required');
    }

    const plan = await this.planRepository.findByIdNotDeleted(planId);
    if (!plan) throw ApiError.notFound('Treatment plan not found');
    if (plan.status !== TREATMENT_PLAN_STATUS.ACCEPTED) {
      throw ApiError.badRequest('Only in-progress (accepted) plans can be transferred between branches');
    }

    const oldBranchId = plan.branchId ? plan.branchId.toString() : null;

    await this.planRepository.updateById(planId, {
      branchId: targetBranchId,
      updatedBy: actorId,
    });

    if (plan.packageSnapshot?.packageId) {
      try {
        await this.packageRepository.model
          .findByIdAndUpdate(plan.packageSnapshot.packageId, {
            $set: { branchId: targetBranchId, updatedBy: actorId },
          })
          .exec();
      } catch (err) {
        // Non-fatal: the plan-level branchId is the source of truth for this simple workflow;
        // failing to sync the catalog package's branchId is logged rather than blocking.
        logger.error('TreatmentPlanService.transferPackageOwnership: failed to sync package branchId', {
          treatmentPlanId: planId,
          packageId: plan.packageSnapshot.packageId?.toString?.(),
          error: err.message,
        });
      }
    }

    await this.auditService.record(AUDIT_ACTIONS.TREATMENT_PLAN_BRANCH_TRANSFERRED, {
      actorId,
      metadata: {
        treatmentPlanId: planId,
        oldBranchId,
        newBranchId: targetBranchId.toString(),
        reason,
      },
      req,
    });

    return this.getById(planId);
  }

  async recommend(id, actorId) {
    const plan = await this.planRepository.findByIdNotDeleted(id);
    if (!plan) throw ApiError.notFound('Treatment plan not found');
    if (plan.status !== TREATMENT_PLAN_STATUS.DRAFT) {
      throw ApiError.badRequest('Only draft plans can be marked recommended');
    }
    if (!plan.items?.length) throw ApiError.badRequest('Add at least one procedure before recommending');

    await this.planRepository.updateById(id, {
      status: TREATMENT_PLAN_STATUS.RECOMMENDED,
      recommendedAt: new Date(),
      updatedBy: actorId,
    });
    return this.getById(id);
  }

  async approve(id, actorId, req = null) {
    const plan = await this.planRepository.findByIdNotDeleted(id);
    if (!plan) throw ApiError.notFound('Treatment plan not found');
    if (
      ![TREATMENT_PLAN_STATUS.DRAFT, TREATMENT_PLAN_STATUS.RECOMMENDED].includes(plan.status)
    ) {
      throw ApiError.badRequest('Only draft or recommended plans can be approved');
    }
    if (!plan.items?.length) throw ApiError.badRequest('Cannot approve an empty plan');

    await this.planRepository.updateById(id, {
      status: TREATMENT_PLAN_STATUS.APPROVED,
      approvedAt: new Date(),
      approvedBy: actorId,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.TREATMENT_PLAN_APPROVED, {
      actorId,
      metadata: { treatmentPlanId: id, planNumber: plan.planNumber },
      req,
    });

    return this.getById(id);
  }

  async accept(id, actorId, req = null) {
    const plan = await this.planRepository.findByIdNotDeleted(id);
    if (!plan) throw ApiError.notFound('Treatment plan not found');
    if (plan.status !== TREATMENT_PLAN_STATUS.APPROVED) {
      throw ApiError.badRequest('Only approved plans can be accepted');
    }

    const consents = await this.consentRepository.findByPlan(plan._id);
    const pending = consents.filter((c) => c.status !== CONSENT_STATUS.ACCEPTED);
    if (pending.length) {
      throw ApiError.badRequest('All required consents must be accepted before plan acceptance');
    }

    await this.planRepository.updateById(id, {
      status: TREATMENT_PLAN_STATUS.ACCEPTED,
      acceptedAt: new Date(),
      acceptedBy: actorId,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.TREATMENT_PLAN_ACCEPTED, {
      actorId,
      metadata: { treatmentPlanId: id, planNumber: plan.planNumber },
      req,
    });

    return this.getById(id);
  }

  async reject(id, { reason = null } = {}, actorId) {
    const plan = await this.planRepository.findByIdNotDeleted(id);
    if (!plan) throw ApiError.notFound('Treatment plan not found');
    if (
      ![
        TREATMENT_PLAN_STATUS.DRAFT,
        TREATMENT_PLAN_STATUS.RECOMMENDED,
        TREATMENT_PLAN_STATUS.APPROVED,
      ].includes(plan.status)
    ) {
      throw ApiError.badRequest('Plan cannot be rejected in its current status');
    }
    await this.planRepository.updateById(id, {
      status: TREATMENT_PLAN_STATUS.REJECTED,
      rejectedAt: new Date(),
      rejectionReason: reason,
      updatedBy: actorId,
    });
    return this.getById(id);
  }

  async cancel(id, actorId) {
    const plan = await this.planRepository.findByIdNotDeleted(id);
    if (!plan) throw ApiError.notFound('Treatment plan not found');
    if (
      [TREATMENT_PLAN_STATUS.COMPLETED, TREATMENT_PLAN_STATUS.CANCELLED].includes(plan.status)
    ) {
      throw ApiError.badRequest('Plan is already closed');
    }
    await this.planRepository.updateById(id, {
      status: TREATMENT_PLAN_STATUS.CANCELLED,
      cancelledAt: new Date(),
      updatedBy: actorId,
    });
    return this.getById(id);
  }

  async complete(id, actorId) {
    const plan = await this.planRepository.findByIdNotDeleted(id);
    if (!plan) throw ApiError.notFound('Treatment plan not found');
    if (plan.status !== TREATMENT_PLAN_STATUS.ACCEPTED) {
      throw ApiError.badRequest('Only accepted plans can be marked completed');
    }
    await this.planRepository.updateById(id, {
      status: TREATMENT_PLAN_STATUS.COMPLETED,
      completedAt: new Date(),
      updatedBy: actorId,
    });
    return this.getById(id);
  }

  async acceptConsent(planId, consentId, payload, actorId, req = null) {
    const plan = await this.planRepository.findByIdNotDeleted(planId);
    if (!plan) throw ApiError.notFound('Treatment plan not found');
    this.#assertEditable(plan);

    const consent = await this.consentRepository.findByIdNotDeleted(consentId);
    if (!consent || consent.treatmentPlanId.toString() !== planId) {
      throw ApiError.notFound('Consent record not found');
    }

    await this.consentRepository.updateById(consentId, {
      status: CONSENT_STATUS.ACCEPTED,
      signatureData: payload.signatureData || 'E_SIGN_PLACEHOLDER',
      signedByName: payload.signedByName || null,
      witnessName: payload.witnessName || null,
      signedAt: new Date(),
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.CONSENT_ACCEPTED, {
      actorId,
      metadata: {
        treatmentPlanId: planId,
        consentId,
        consentType: consent.consentType,
      },
      req,
    });

    return this.getById(planId);
  }

  async listConsents(planId) {
    const plan = await this.planRepository.findByIdNotDeleted(planId);
    if (!plan) throw ApiError.notFound('Treatment plan not found');
    const rows = await this.consentRepository.findByPlan(planId);
    return rows.map((r) => r.toSafeObject());
  }

  async getPrintData(id, actorId, req = null) {
    await this.getById(id);
    const current = await this.planRepository.findByIdNotDeleted(id);
    await this.planRepository.updateById(id, {
      printedAt: new Date(),
      printCount: (current?.printCount || 0) + 1,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.TREATMENT_PLAN_PRINTED, {
      actorId,
      metadata: { treatmentPlanId: id },
      req,
    });

    return {
      plan: await this.getById(id),
      printMeta: {
        printedAt: new Date().toISOString(),
        clinicLogoPlaceholder: true,
        qrPlaceholder: true,
        signatureLabel: 'Doctor Signature / Patient Signature',
      },
    };
  }

  // —— Protocols ——
  async listProtocols(query = {}) {
    const rows = await this.protocolRepository.listActive(query);
    return rows.map((r) => r.toSafeObject());
  }

  async getProtocol(id) {
    const row = await this.protocolRepository.findByIdNotDeleted(id);
    if (!row) throw ApiError.notFound('Protocol not found');
    return row.toSafeObject();
  }

  async createProtocol(payload, actorId) {
    const row = await this.protocolRepository.create({
      protocolCode: payload.protocolCode || (await generateProtocolCode()),
      name: payload.name,
      category: payload.category || 'Other',
      description: payload.description || null,
      clinicalGoal: payload.clinicalGoal || null,
      estimatedDuration: payload.estimatedDuration || null,
      estimatedSessions: payload.estimatedSessions || 1,
      items: this.#normalizeItems(payload.items || []),
      defaultConsents: payload.defaultConsents || CONSENT_TYPE_LIST,
      isActive: payload.isActive !== false,
      createdBy: actorId,
      updatedBy: actorId,
    });
    return row.toSafeObject();
  }

  /**
   * Lighter, non-versioning path — for genuinely non-clinical metadata edits only
   * (display name typo fix, category relabel, active/inactive toggle, which consent
   * types default onto plans). Deliberately does NOT accept items/clinicalGoal/
   * estimatedDuration/estimatedSessions/contraindicationQuestions/age restrictions —
   * any change to actual treatment content must go through createNewProtocolVersion()
   * so completed sessions' protocolVersionSnapshot stays meaningful (§10.2 versioning).
   */
  async updateProtocol(id, payload, actorId) {
    const row = await this.protocolRepository.findByIdNotDeleted(id);
    if (!row) throw ApiError.notFound('Protocol not found');
    const updates = { updatedBy: actorId };
    for (const f of ['name', 'category', 'description', 'defaultConsents', 'isActive']) {
      if (payload[f] !== undefined) updates[f] = payload[f];
    }
    await this.protocolRepository.updateById(id, updates);
    return this.getProtocol(id);
  }

  /**
   * §10.2 versioning — creates a NEW TreatmentProtocol document carrying the clinical
   * changes, instead of mutating the existing one in place. The old document is left
   * completely untouched so any already-completed session's protocolVersionSnapshot
   * (pinned at session-start time in TreatmentSessionService.start()) keeps pointing at
   * the exact content it was actually run with. Use this for any change to clinical
   * content: items (parameters/consumables/pre/post instructions), clinicalGoal,
   * estimatedDuration/estimatedSessions, contraindicationQuestions, age restrictions.
   *
   * approvedBy/approvedAt are reset to null on the new version — clinical content
   * changes require re-approval before the protocol should be trusted again (follows
   * the same convention as TreatmentPlanService.approve() gating on an explicit
   * approvedBy/approvedAt pair).
   */
  async createNewProtocolVersion(protocolId, changes, actorId) {
    const current = await this.protocolRepository.findByIdNotDeleted(protocolId);
    if (!current) throw ApiError.notFound('Protocol not found');

    const carryOver = [
      'protocolCode',
      'name',
      'category',
      'description',
      'clinicalGoal',
      'estimatedDuration',
      'estimatedSessions',
      'defaultConsents',
      'contraindicationQuestions',
      'ageRestrictionMin',
      'ageRestrictionMax',
      'isActive',
    ];
    const next = {};
    for (const f of carryOver) {
      next[f] = current[f];
    }
    for (const f of carryOver) {
      if (changes[f] !== undefined) next[f] = changes[f];
    }
    next.items = changes.items ? this.#normalizeItems(changes.items) : current.items;

    const newVersion = await this.protocolRepository.create({
      ...next,
      // A distinct protocolCode is required (unique index) — suffix the version so the
      // lineage stays discoverable while remaining unique per document.
      protocolCode: `${current.protocolCode}-V${(current.version || 1) + 1}`,
      version: (current.version || 1) + 1,
      previousVersionId: current._id,
      effectiveFrom: new Date(),
      approvedBy: null,
      approvedAt: null,
      createdBy: actorId,
      updatedBy: actorId,
    });

    return this.getProtocol(newVersion._id.toString());
  }

  // —— Packages ——
  async listPackages(query = {}) {
    const rows = await this.packageRepository.listActive(query);
    return rows.map((r) => r.toSafeObject());
  }

  async getPackage(id) {
    const row = await this.packageRepository.findByIdNotDeleted(id);
    if (!row) throw ApiError.notFound('Package not found');
    return row.toSafeObject();
  }

  async createPackage(payload, actorId) {
    const row = await this.packageRepository.create({
      packageCode: payload.packageCode || (await generatePackageCode()),
      name: payload.name,
      category: payload.category || 'Other',
      description: payload.description || null,
      packagePrice: payload.packagePrice,
      discount: payload.discount || 0,
      validityDays: payload.validityDays || 90,
      maximumSessions: payload.maximumSessions,
      protocolId: payload.protocolId || null,
      isActive: payload.isActive !== false,
      createdBy: actorId,
      updatedBy: actorId,
    });
    return row.toSafeObject();
  }

  async updatePackage(id, payload, actorId) {
    const row = await this.packageRepository.findByIdNotDeleted(id);
    if (!row) throw ApiError.notFound('Package not found');
    const updates = { updatedBy: actorId };
    for (const f of [
      'name',
      'category',
      'description',
      'packagePrice',
      'discount',
      'validityDays',
      'maximumSessions',
      'protocolId',
      'isActive',
    ]) {
      if (payload[f] !== undefined) updates[f] = payload[f];
    }
    await this.packageRepository.updateById(id, updates);
    return this.getPackage(id);
  }
}

export default TreatmentPlanService;
