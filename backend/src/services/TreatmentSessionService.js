import ApiError from '../libs/ApiError.js';
import {
  TreatmentSessionRepository,
  TreatmentSessionLogRepository,
} from '../repositories/TreatmentSessionRepository.js';
import TreatmentPlanRepository from '../repositories/TreatmentPlanRepository.js';
import { InvoiceRepository } from '../repositories/BillingRepository.js';
import { ClinicalPhotoRepository } from '../repositories/ConsultationClinicalRepository.js';
import AuditService from './AuditService.js';
import ClinicalPhotoPolicyService from './ClinicalPhotoPolicyService.js';
import ResourceService from './ResourceService.js';
import InventoryService from './InventoryService.js';
import LocalStorage from '../storage/LocalStorage.js';
import ConsentRecord from '../models/ConsentRecord.model.js';
import PatchTest from '../models/PatchTest.model.js';
import TreatmentProtocol from '../models/TreatmentProtocol.model.js';
import Patient from '../models/Patient.model.js';
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
  PREFLIGHT_GATE,
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
    // IMG-003/PRV-001 — the same capture policy the consultation path uses (single implementation).
    this.photoPolicy = new ClinicalPhotoPolicyService();
    this.storage = new LocalStorage();
    this.resourceService = new ResourceService();
    this.inventoryService = new InventoryService();
    this.loyaltyLedgerService = new LoyaltyLedgerService();
  }

  /**
   * TRT-006 — is a signed treatment consent REQUIRED for this session?
   *
   * This is knowable from the data: TreatmentProtocol.items[].consentRequired (default true) is the
   * declared requirement, and every protocol reachable from the session or the plan (session.protocolId,
   * plan.protocolId, plan.items[].protocolId) is consulted. A protocol that exists but declares no
   * items is treated as requiring consent — an unpopulated protocol is not a statement that consent
   * is unnecessary.
   *
   * When NO protocol is reachable at all the requirement is genuinely undeclared. The safe default
   * is REQUIRED: a protocol-less plan is exactly the case where nobody has asserted that the
   * procedure is consent-free, and the alternative default silently reopens the P0 hole. Operational
   * consequence: a protocol-less plan with no consent record on file becomes unstartable until the
   * consent record is created — or until a user holding TREATMENT_HARD_STOP_OVERRIDE starts it with
   * a written, audited reason (this gate stays overridable, like the other hard stops).
   */
  async #resolveConsentRequirement(session, plan, sessionProtocol = null) {
    const ids = [session.protocolId, plan.protocolId, ...(plan.items || []).map((i) => i.protocolId)]
      .filter(Boolean)
      .map((v) => v.toString());
    const unique = [...new Set(ids)];
    if (!unique.length) {
      return { required: true, source: 'clinic default (no protocol is attached to this plan)' };
    }

    const protocols = [];
    for (const id of unique) {
      const doc =
        sessionProtocol && sessionProtocol._id.toString() === id
          ? sessionProtocol
          : await TreatmentProtocol.findById(id).exec();
      if (doc) protocols.push(doc);
    }
    if (!protocols.length) {
      return { required: true, source: 'clinic default (protocol referenced by this plan no longer exists)' };
    }

    const requiring = protocols.find((p) =>
      (p.items || []).length ? (p.items || []).some((i) => i.consentRequired !== false) : true
    );
    if (requiring) {
      return { required: true, source: `protocol ${requiring.protocolCode || requiring.name}` };
    }
    return { required: false, source: 'protocol (consent not required)' };
  }

  /**
   * Every TreatmentProtocol reachable from this session/plan (session.protocolId, plan.protocolId,
   * plan.items[].protocolId). Same id set the consent requirement uses — eligibility rules
   * (contraindications, age limits) must be read from exactly the protocols that govern the work.
   */
  async #reachableProtocols(session, plan, sessionProtocol = null) {
    const ids = [session.protocolId, plan.protocolId, ...(plan.items || []).map((i) => i.protocolId)]
      .filter(Boolean)
      .map((v) => v.toString());
    const docs = [];
    for (const id of [...new Set(ids)]) {
      const doc =
        sessionProtocol && sessionProtocol._id.toString() === id
          ? sessionProtocol
          : await TreatmentProtocol.findById(id).exec();
      if (doc) docs.push(doc);
    }
    return docs;
  }

  /**
   * Normalize a contraindication screening payload ({ answers: [{question, answer, note}] }) into
   * the stored shape, stamping who screened and when. Returns null when nothing usable was sent.
   */
  #normalizeScreening(input, actorId) {
    const rows = Array.isArray(input) ? input : input?.answers;
    if (!Array.isArray(rows) || !rows.length) return null;
    const answers = rows
      .filter((a) => a && a.question)
      .map((a) => ({
        question: String(a.question).trim(),
        answer: a.answer === null || a.answer === undefined ? null : Boolean(a.answer),
        note: a.note ? String(a.note) : null,
      }));
    if (!answers.length) return null;
    return { screenedAt: new Date(), screenedBy: actorId || null, answers };
  }

  /**
   * TRT-006 — CONTRAINDICATION gate. The protocol's configured contraindicationQuestions were
   * previously copied around and never evaluated; they are now a real screening requirement.
   *
   * Three outcomes:
   *  - no protocol declares any question → applicable:false (do not invent a screening burden);
   *  - questions declared but unanswered (no screening recorded, or some question left blank) →
   *    blocking CONTRAINDICATION_SCREENING_MISSING, naming the unanswered questions;
   *  - any question answered "yes" (the contraindication IS present) → blocking CONTRAINDICATION.
   *
   * Overridable: a doctor may knowingly proceed with an audited reason (e.g. a contraindication
   * that has since been resolved), exactly like the consent gate.
   */
  #evaluateContraindicationGate(session, protocols) {
    const questions = [
      ...new Set(
        protocols.flatMap((p) => (p.contraindicationQuestions || []).map((q) => String(q).trim()).filter(Boolean))
      ),
    ];

    if (!questions.length) {
      return {
        key: PREFLIGHT_GATE.CONTRAINDICATION,
        label: 'Contraindication screening',
        applicable: false,
        passed: true,
        stopType: null,
        detail: null,
        questions: [],
        resolvedBy: 'No contraindication questions are configured on this protocol',
      };
    }

    const answers = session.contraindicationScreening?.answers || [];
    const byQuestion = new Map(answers.map((a) => [String(a.question).trim(), a]));
    const unanswered = questions.filter((q) => {
      const a = byQuestion.get(q);
      return !a || a.answer === null || a.answer === undefined;
    });
    const positives = questions.filter((q) => byQuestion.get(q)?.answer === true);

    let stop = null;
    if (positives.length) {
      stop = {
        type: HARD_STOP_TYPE.CONTRAINDICATION,
        message: `Contraindication present: ${positives.join('; ')}`,
      };
    } else if (unanswered.length) {
      stop = {
        type: HARD_STOP_TYPE.CONTRAINDICATION_SCREENING_MISSING,
        message:
          `Contraindication screening is incomplete — ${unanswered.length} of ${questions.length} ` +
          `question(s) unanswered: ${unanswered.join('; ')}`,
      };
    }

    return {
      key: PREFLIGHT_GATE.CONTRAINDICATION,
      label: 'Contraindication screening',
      applicable: true,
      passed: !stop,
      stopType: stop?.type || null,
      detail: stop?.message || null,
      questions,
      resolvedBy: positives.length
        ? 'Doctor — review the flagged contraindication before this treatment proceeds'
        : 'Technician or doctor — record the contraindication screening answers on this session',
    };
  }

  /**
   * TRT-006 — AGE_RESTRICTION gate for TreatmentProtocol.ageRestrictionMin/Max.
   *
   * Restrictions from several reachable protocols are combined conservatively (highest declared
   * minimum, lowest declared maximum): if any governing protocol says "18+", the session is 18+.
   * When no protocol declares either bound the gate is applicable:false — an unrestricted protocol
   * must not be turned into an outage.
   *
   * MISSING DATE OF BIRTH → BLOCK (overridable). Skipping would make "not for under-18s" silently
   * unenforceable for exactly the records where age is unverified, which is the failure this whole
   * task exists to remove. It is overridable so front desk can proceed on a documented reason while
   * the DOB is being collected.
   */
  async #evaluateAgeGate(session, protocols) {
    let min = null;
    let max = null;
    for (const p of protocols) {
      if (typeof p.ageRestrictionMin === 'number') min = min === null ? p.ageRestrictionMin : Math.max(min, p.ageRestrictionMin);
      if (typeof p.ageRestrictionMax === 'number') max = max === null ? p.ageRestrictionMax : Math.min(max, p.ageRestrictionMax);
    }

    const base = {
      key: PREFLIGHT_GATE.AGE_RESTRICTION,
      label: 'Patient within protocol age limits',
      ageRestrictionMin: min,
      ageRestrictionMax: max,
    };

    if (min === null && max === null) {
      return {
        ...base,
        applicable: false,
        passed: true,
        stopType: null,
        detail: null,
        resolvedBy: 'No age restriction is configured on this protocol',
      };
    }

    const window = [
      min !== null ? `${min}+` : null,
      max !== null ? `up to ${max}` : null,
    ]
      .filter(Boolean)
      .join(', ');

    const patient = await Patient.findById(session.patientId).exec();
    const age = patient ? patient.computeAge() : null;

    if (age === null) {
      return {
        ...base,
        applicable: true,
        passed: false,
        stopType: HARD_STOP_TYPE.AGE_UNKNOWN,
        detail:
          `This protocol is restricted by age (${window}) but the patient's date of birth is not ` +
          'recorded, so eligibility cannot be verified',
        resolvedBy: 'Front desk — record the patient date of birth on the patient record',
      };
    }

    const tooYoung = min !== null && age < min;
    const tooOld = max !== null && age > max;
    const stop = tooYoung || tooOld;

    return {
      ...base,
      applicable: true,
      patientAge: age,
      passed: !stop,
      stopType: stop ? HARD_STOP_TYPE.AGE_RESTRICTION : null,
      detail: stop
        ? `Patient is ${age}; this protocol is restricted to ${window}`
        : null,
      resolvedBy: 'Doctor — this protocol is not approved for this patient age; select another protocol',
    };
  }

  /**
   * TRT-006 / revenue — PACKAGE_VALIDITY gate for TreatmentPackage.validityDays.
   *
   * ANCHOR: plan acceptance (plan.acceptedAt), falling back to plan.createdAt when a legacy plan
   * has no acceptedAt. TreatmentPackage.validityDays is documented on the model as "validity in
   * days from plan acceptance", and acceptance — not the invoice date, and not the first session —
   * is the moment the patient owns the package, so it is the only anchor that cannot be pushed
   * back indefinitely by simply never booking. Anchoring on the first session would make an
   * unused package immortal, which is the leak being closed.
   *
   * applicable:false for pay-per-session plans and for packages that carry no validityDays.
   */
  #evaluatePackageValidityGate(plan) {
    const snapshot = plan.packageSnapshot || null;
    const validityDays = Number(snapshot?.validityDays);
    const base = {
      key: PREFLIGHT_GATE.PACKAGE_VALIDITY,
      label: 'Package still within validity',
    };

    if (!snapshot || !Number.isFinite(validityDays) || validityDays <= 0) {
      return {
        ...base,
        applicable: false,
        passed: true,
        stopType: null,
        detail: null,
        resolvedBy: 'This plan is not package-booked, or the package carries no validity period',
      };
    }

    const anchor = plan.acceptedAt || plan.createdAt || null;
    if (!anchor) {
      // Nothing to measure from — report it rather than silently passing or blocking.
      return {
        ...base,
        applicable: true,
        passed: true,
        blocking: false,
        detail: 'Package validity could not be measured — the plan has no acceptance or creation date',
        stopType: null,
        resolvedBy: 'Front desk — re-accept the plan so the validity window has a start date',
      };
    }

    const expiresAt = new Date(new Date(anchor).getTime() + validityDays * 24 * 60 * 60 * 1000);
    const expired = Date.now() > expiresAt.getTime();

    return {
      ...base,
      applicable: true,
      passed: !expired,
      stopType: expired ? HARD_STOP_TYPE.PACKAGE_EXPIRED : null,
      packageExpiresAt: expiresAt,
      detail: expired
        ? `Package "${snapshot.packageName || 'package'}" expired on ${expiresAt.toISOString().slice(0, 10)} ` +
          `(${validityDays}-day validity from plan acceptance on ${new Date(anchor).toISOString().slice(0, 10)})`
        : null,
      resolvedBy: 'Cashier / front desk — renew or re-sell the package, or extend its validity',
    };
  }

  /**
   * TRT-006 — the parameters configured on TreatmentProtocol.items[].parameters, surfaced so the
   * execution screen stops inventing its own values. Returned per protocol item and as a merged
   * map used to pre-fill deviceUsage.settings at start() when the caller sends none.
   */
  #protocolParameters(protocols) {
    const items = [];
    const merged = {};
    for (const p of protocols) {
      for (const item of p.items || []) {
        const params = item.parameters && typeof item.parameters === 'object' ? item.parameters : {};
        if (!Object.keys(params).length) continue;
        items.push({
          protocolId: p._id.toString(),
          protocolCode: p.protocolCode || null,
          procedureName: item.procedureName,
          parameters: params,
        });
        Object.assign(merged, params);
      }
    }
    return { items, merged };
  }

  /**
   * TRT-003 — turn whatever the caller supplied (an explicit roomRef/deviceRef ObjectId, or the
   * free-text roomId/deviceId label) into real Room/Device references, scoped to the branch.
   * An explicitly supplied ref must exist — a bad id is rejected rather than silently dropped,
   * because a dropped ref is exactly what made these gates dead code in the first place.
   */
  async #resolveResourceRefs(payload = {}, branchId = null) {
    let roomRef = null;
    let deviceRef = null;

    if (payload.roomRef) {
      const room = await this.resourceService.resolveRoom(payload.roomRef, null);
      if (!room) throw ApiError.badRequest('Room not found for roomRef');
      roomRef = room._id;
    } else if (payload.roomId) {
      const room = await this.resourceService.resolveRoom(payload.roomId, branchId);
      roomRef = room ? room._id : null;
    }

    if (payload.deviceRef) {
      const device = await this.resourceService.resolveDevice(payload.deviceRef, null);
      if (!device) throw ApiError.badRequest('Device not found for deviceRef');
      deviceRef = device._id;
    } else if (payload.deviceId) {
      const device = await this.resourceService.resolveDevice(payload.deviceId, branchId);
      deviceRef = device ? device._id : null;
    }

    return { roomRef, deviceRef };
  }

  /**
   * TRT-003 — shared evaluator for the ROOM and DEVICE gates.
   *
   * Three outcomes:
   *  - a managed resource is assigned (via ref, or resolved from the legacy free-text label) →
   *    blocking gate, hard-stops when the resource is out of service;
   *  - free text is assigned but names no managed resource → evaluated, non-blocking advisory, so
   *    the technician sees that the status could not be verified instead of the gate silently
   *    passing (making this blocking would strand every pre-existing session whose room/device was
   *    only ever typed in as text);
   *  - nothing assigned → not applicable, as before.
   */
  async #evaluateResourceGate({
    key,
    label,
    noun,
    ref,
    freeText,
    branchId,
    resolve,
    isAvailable,
    stopType,
    unavailableDetail,
    resolvedBy,
  }) {
    let resourceId = ref ? ref.toString() : null;
    let resourceLabel = null;

    if (!resourceId && freeText) {
      const resolved = await resolve(freeText, branchId);
      if (resolved) {
        resourceId = resolved._id.toString();
        resourceLabel = resolved.name;
      }
    }

    if (!resourceId) {
      if (freeText) {
        return {
          key,
          label,
          applicable: true,
          evaluated: true,
          passed: true,
          blocking: false,
          overridable: false,
          stopType: null,
          detail: `${noun} "${freeText}" is not a managed resource — its in-service status could not be verified`,
          resolvedBy: `Branch admin — register "${freeText}" in Settings › Resources and re-assign it to this session`,
        };
      }
      return {
        key,
        label,
        applicable: false,
        passed: true,
        stopType: null,
        detail: null,
        resolvedBy,
      };
    }

    const available = await isAvailable(resourceId);
    return {
      key,
      label,
      applicable: true,
      evaluated: true,
      passed: available,
      stopType: available ? null : stopType,
      detail: available
        ? null
        : `${unavailableDetail}${resourceLabel ? ` (${resourceLabel})` : ''}`,
      resolvedBy,
    };
  }

  /**
   * TRT-006 — THE single source of truth for the treatment hard-stop rules. Pure/read-only:
   * evaluates every hard-stop gate and returns them as structured descriptors (in the exact
   * order the stop messages are joined for the blocking error). Both the read-only pre-flight
   * endpoint (getPreflight) and the real start() consume this one method — nothing re-implements
   * the rules, so the checklist the technician sees can never drift from what start() enforces.
   */
  async #evaluateHardStopGates(session, plan) {
    const gates = [];
    const push = (g) => gates.push({ overridable: true, blocking: true, evaluated: true, ...g });

    const protocol = session.protocolId ? await TreatmentProtocol.findById(session.protocolId).exec() : null;

    // TRT-006 (P0) — an ABSENT consent record is not the same as "consent not required". The old
    // `applicable: consents.length > 0` made a plan with no consent record at all pass the gate,
    // so the check only ever caught an *unsigned* consent and never a *missing* one. The
    // requirement is read from the protocol (TreatmentProtocol.items[].consentRequired), and the
    // two failure modes are reported distinctly so the technician knows what to chase.
    const consents = await ConsentRecord.find({ treatmentPlanId: plan._id, deletedAt: null }).exec();
    const { required: consentRequired, source: consentRequirementSource } =
      await this.#resolveConsentRequirement(session, plan, protocol);
    const hasUnsignedConsent = consents.length > 0 && consents.some((c) => c.status !== CONSENT_STATUS.ACCEPTED);
    const consentAbsent = consents.length === 0;

    let consentStop = null;
    if (consentRequired && consentAbsent) {
      consentStop = {
        type: HARD_STOP_TYPE.CONSENT_ABSENT,
        message:
          'No treatment consent record exists for this plan — consent has never been captured, ' +
          `so there is nothing to sign (consent required by ${consentRequirementSource})`,
      };
    } else if (hasUnsignedConsent) {
      consentStop = {
        type: HARD_STOP_TYPE.CONSENT_MISSING,
        message: 'Treatment consent is not signed',
      };
    }
    push({
      key: PREFLIGHT_GATE.CONSENT,
      label: 'Treatment consent signed',
      applicable: consentRequired || consents.length > 0,
      passed: !consentStop,
      stopType: consentStop?.type || null,
      detail: consentStop?.message || null,
      resolvedBy: consentAbsent
        ? 'Doctor or front desk — create the consent record for this plan, then have the patient sign it'
        : 'Doctor or front desk — capture the patient consent for this plan',
    });

    let requiresPatchTest = false;
    let patchTestStop = null;
    if (session.protocolId) {
      requiresPatchTest = (protocol?.items || []).some((i) => i.patchTestRequired);
      if (requiresPatchTest) {
        const patchTest = await PatchTest.findOne({
          patientId: session.patientId,
          protocolId: session.protocolId,
        })
          .sort({ testedAt: -1 })
          .exec();
        if (!patchTest) {
          patchTestStop = {
            type: HARD_STOP_TYPE.PATCH_TEST_MISSING,
            message: 'A patch test is required before this treatment',
          };
        } else if (patchTest.result === 'POSITIVE') {
          patchTestStop = {
            type: HARD_STOP_TYPE.PATCH_TEST_POSITIVE,
            message: 'Patch test reaction was positive',
          };
        } else if (!patchTest.isValidNow()) {
          patchTestStop = {
            type: HARD_STOP_TYPE.PATCH_TEST_MISSING,
            message: 'Patch test result is missing, pending or expired',
          };
        }
      }
    }
    push({
      key: PREFLIGHT_GATE.PATCH_TEST,
      label: 'Patch test valid',
      applicable: requiresPatchTest,
      passed: !patchTestStop,
      stopType: patchTestStop?.type || null,
      detail: patchTestStop?.message || null,
      resolvedBy: 'Doctor or technician — record/repeat the patch test for this protocol',
    });

    // TRT-003 (P0) — these gates used to key off roomRef/deviceRef only, and nothing ever wrote
    // those fields (create() only stored the free-text roomId/deviceId), so both hard stops were
    // dead code that trivially "passed". The refs are now written on create/update, and the free
    // text of pre-existing sessions is resolved to a managed resource here at evaluation time so
    // historical rows evaluate too.
    push(
      await this.#evaluateResourceGate({
        key: PREFLIGHT_GATE.ROOM,
        label: 'Assigned room in service',
        noun: 'Room',
        ref: session.roomRef,
        freeText: session.roomId,
        branchId: session.branchId,
        resolve: (v, b) => this.resourceService.resolveRoom(v, b),
        isAvailable: (id) => this.resourceService.isRoomAvailable(id),
        stopType: HARD_STOP_TYPE.ROOM_UNAVAILABLE,
        unavailableDetail: 'Assigned room is not in service',
        resolvedBy: 'Branch admin — set the room back to Available in Settings › Resources',
      })
    );

    push(
      await this.#evaluateResourceGate({
        key: PREFLIGHT_GATE.DEVICE,
        label: 'Assigned device in service',
        noun: 'Device',
        ref: session.deviceRef,
        freeText: session.deviceId,
        branchId: session.branchId,
        resolve: (v, b) => this.resourceService.resolveDevice(v, b),
        isAvailable: (id) => this.resourceService.isDeviceAvailable(id),
        stopType: HARD_STOP_TYPE.DEVICE_UNAVAILABLE,
        unavailableDetail: 'Assigned device is not in service',
        resolvedBy: 'Branch admin — set the device back to Available in Settings › Resources',
      })
    );

    const requiredSkillCode = (protocol?.items || []).find((i) => i.requiredSkillCode)?.requiredSkillCode;
    let skillStop = null;
    let skillApplicable = false;
    if (requiredSkillCode) {
      // technicianId is a direct User ref; doctorId refers to a Doctor document (not User),
      // so only technicianId can be checked against StaffSkill.userId here.
      const operatorUserId = session.technicianId || null;
      if (operatorUserId) {
        skillApplicable = true;
        try {
          await this.resourceService.assertOperatorSkilled(operatorUserId, requiredSkillCode, session.branchId);
        } catch (err) {
          if (err?.code === 'OPERATOR_SKILL_MISSING') {
            skillStop = { type: HARD_STOP_TYPE.OPERATOR_SKILL_MISSING, message: err.message };
          } else if (err?.code === 'OPERATOR_SKILL_EXPIRED') {
            skillStop = { type: HARD_STOP_TYPE.OPERATOR_SKILL_EXPIRED, message: err.message };
          } else {
            throw err;
          }
        }
      }
    }
    push({
      key: PREFLIGHT_GATE.OPERATOR_CREDENTIAL,
      label: 'Operator credentialed for protocol',
      applicable: skillApplicable,
      passed: !skillStop,
      stopType: skillStop?.type || null,
      detail: skillStop?.message || null,
      requiredSkillCode: requiredSkillCode || null,
      resolvedBy: 'Branch admin — grant/renew the staff skill, or reassign a credentialed technician',
    });

    // TRT-006 (P0) — protocol eligibility. contraindicationQuestions / ageRestrictionMin / Max and
    // the package validityDays were all configured, persisted and shown in the admin UI while no
    // code path read them: staff were told a safety control existed that enforced nothing.
    const protocols = await this.#reachableProtocols(session, plan, protocol);
    push(this.#evaluateContraindicationGate(session, protocols));
    push(await this.#evaluateAgeGate(session, protocols));
    push(this.#evaluatePackageValidityGate(plan));

    return { protocol, protocols, gates, protocolParameters: this.#protocolParameters(protocols) };
  }

  /** Strip internal-only fields so a gate can be returned over HTTP. */
  #publicGate(gate) {
    return {
      key: gate.key,
      label: gate.label,
      applicable: gate.applicable !== false,
      evaluated: gate.evaluated !== false,
      passed: Boolean(gate.passed),
      blocking: gate.blocking !== false,
      overridable: Boolean(gate.overridable),
      detail: gate.detail ?? null,
      resolvedBy: gate.resolvedBy ?? null,
      hardStopType: gate.stopType ?? null,
      ...(gate.requiredSkillCode !== undefined ? { requiredSkillCode: gate.requiredSkillCode } : {}),
      // TRT-006 — eligibility context the execution screen needs to act on the gate.
      ...(gate.questions !== undefined ? { questions: gate.questions } : {}),
      ...(gate.ageRestrictionMin !== undefined ? { ageRestrictionMin: gate.ageRestrictionMin } : {}),
      ...(gate.ageRestrictionMax !== undefined ? { ageRestrictionMax: gate.ageRestrictionMax } : {}),
      ...(gate.patientAge !== undefined ? { patientAge: gate.patientAge } : {}),
      ...(gate.packageExpiresAt !== undefined ? { packageExpiresAt: gate.packageExpiresAt } : {}),
    };
  }

  /**
   * TRT-006 — hard-stop enforcement for start(). Delegates the rules to #evaluateHardStopGates
   * (single source of truth); an authorized override (with reason) is recorded on the session
   * and audited. The blocking error carries the failed gates in `errors` so the UI can render
   * an item-by-item breakdown instead of a generic message.
   */
  async #assertHardStops(session, plan, actorId, req, override) {
    const { protocol, gates, protocolParameters } = await this.#evaluateHardStopGates(session, plan);
    const failed = gates.filter((g) => g.blocking !== false && !g.passed);
    const stops = failed.map((g) => ({ type: g.stopType, message: g.detail }));

    if (!stops.length) return { protocol, protocolParameters, overrides: [] };

    const canOverride = hasAnyPermission(req?.auth?.permissions || [], [
      PERMISSIONS.TREATMENT_HARD_STOP_OVERRIDE,
    ]);
    if (!override?.reason || !canOverride) {
      throw new ApiError(409, `Treatment cannot start: ${stops.map((s) => s.message).join('; ')}`, {
        code: 'HARD_STOP_BLOCKED',
        errors: failed.map((g) => this.#publicGate(g)),
      });
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

    return { protocol, protocolParameters, overrides };
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

  /**
   * Single source of truth for the plan-accepted + invoice payment gates. Evaluates them in the
   * same order and with the same short-circuit semantics as the original #assertPaymentGate: once
   * a gate fails the later ones are reported as not-evaluated (they cannot be evaluated without
   * the earlier result). Each failure carries the exact ApiError #assertPaymentGate must throw.
   */
  async #evaluatePaymentGates(plan, invoiceId) {
    let invoice = null;
    const specs = [
      {
        key: PREFLIGHT_GATE.PLAN_ACCEPTED,
        label: 'Treatment plan accepted',
        resolvedBy: 'Doctor / front desk — get the plan accepted by the patient',
        check: () =>
          plan.status !== TREATMENT_PLAN_STATUS.ACCEPTED
            ? ApiError.forbidden('Treatment plan must be Accepted before sessions can start')
            : null,
      },
      {
        key: PREFLIGHT_GATE.INVOICE_LINKED,
        label: 'Invoice linked to this session',
        resolvedBy: 'Cashier / billing desk — raise or re-link the invoice for this plan',
        check: async () => {
          if (!invoiceId) return ApiError.badRequest('invoiceId is required');
          invoice = await this.invoiceRepository.findByIdNotDeleted(invoiceId);
          if (!invoice) return ApiError.badRequest('Invoice does not exist');
          if (String(invoice.patientId) !== String(plan.patientId)) {
            return ApiError.badRequest('Invoice patient does not match treatment plan');
          }
          return null;
        },
      },
      {
        key: PREFLIGHT_GATE.INVOICE_PAYMENT,
        label: 'Invoice paid or partially paid',
        resolvedBy: 'Cashier — collect payment against the invoice',
        check: () =>
          !SESSION_ALLOWED_PAYMENT_STATUSES.includes(invoice.paymentStatus)
            ? ApiError.forbidden(
                `Invoice payment status must be Paid or Partial (got ${invoice.paymentStatus})`
              )
            : null,
      },
    ];

    const gates = [];
    let blocked = false;
    for (const spec of specs) {
      if (blocked) {
        gates.push({
          key: spec.key,
          label: spec.label,
          resolvedBy: spec.resolvedBy,
          evaluated: false,
          passed: false,
          overridable: false,
          blocking: true,
          detail: 'Not evaluated — an earlier check failed',
        });
        continue;
      }
      const error = await spec.check();
      if (error) blocked = true;
      gates.push({
        key: spec.key,
        label: spec.label,
        resolvedBy: spec.resolvedBy,
        evaluated: true,
        passed: !error,
        overridable: false,
        blocking: true,
        detail: error?.message || null,
        error: error || null,
      });
    }

    return { invoice, gates };
  }

  async #assertPaymentGate(plan, invoiceId) {
    const { invoice, gates } = await this.#evaluatePaymentGates(plan, invoiceId);
    const failed = gates.find((g) => g.error);
    if (failed) {
      // Same statusCode/message/code as before — additionally machine-readable for the UI.
      failed.error.errors = failed.error.errors ?? [this.#publicGate(failed)];
      throw failed.error;
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

    // TRT-003 — resolve the room/device assignment to a real managed resource so the ROOM/DEVICE
    // hard stops can actually evaluate. An explicit roomRef/deviceRef wins; otherwise the
    // free-text label is resolved by code/name within the branch. Unresolvable text is kept as
    // text (the gate then reports it as unverifiable rather than silently passing).
    const { roomRef, deviceRef } = await this.#resolveResourceRefs(payload, plan.branchId);

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
      roomRef,
      deviceRef,
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
    // TRT-003 — keep roomRef/deviceRef in step with any room/device re-assignment so the
    // ROOM/DEVICE hard stops keep evaluating against the real resource.
    if (payload.roomId !== undefined || payload.roomRef !== undefined) {
      updates.roomRef = (
        await this.#resolveResourceRefs(
          { roomId: payload.roomId ?? session.roomId, roomRef: payload.roomRef },
          session.branchId
        )
      ).roomRef;
    }
    if (payload.deviceId !== undefined || payload.deviceRef !== undefined) {
      updates.deviceRef = (
        await this.#resolveResourceRefs(
          { deviceId: payload.deviceId ?? session.deviceId, deviceRef: payload.deviceRef },
          session.branchId
        )
      ).deviceRef;
    }
    if (payload.scheduledDate !== undefined) {
      updates.scheduledDate = payload.scheduledDate ? new Date(payload.scheduledDate) : null;
    }
    // TRT-006 — contraindication screening can also be recorded ahead of time (so the pre-flight
    // checklist the technician reads is already green before they walk into the room).
    if (payload.contraindicationScreening !== undefined) {
      updates.contraindicationScreening =
        this.#normalizeScreening(payload.contraindicationScreening, actorId);
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

  /**
   * TRT-006 — READ-ONLY start pre-flight. Runs exactly the checks start() runs, in the same
   * order, by calling the very same evaluators (#evaluatePaymentGates + #evaluateHardStopGates),
   * and returns them as a structured per-gate checklist. Nothing here is duplicated logic: if a
   * rule changes in the evaluator, both this endpoint and start() change with it.
   */
  async getPreflight(id, req = null) {
    const session = await this.sessionRepository.findByIdNotDeleted(id);
    if (!session) throw ApiError.notFound('Treatment session not found');
    const plan = await this.planRepository.findByIdNotDeleted(session.treatmentPlanId);
    if (!plan) throw ApiError.notFound('Treatment plan not found');

    const statusOk = [
      TREATMENT_SESSION_STATUS.SCHEDULED,
      TREATMENT_SESSION_STATUS.CHECKED_IN,
    ].includes(session.status);
    const statusGate = {
      key: PREFLIGHT_GATE.SESSION_STATUS,
      label: 'Session is startable',
      passed: statusOk,
      overridable: false,
      blocking: true,
      detail: statusOk ? null : 'Session cannot be started from current status',
      resolvedBy: 'Technician / front desk — check the patient in first',
    };

    const { gates: paymentGates, } = await this.#evaluatePaymentGates(plan, session.invoiceId);
    const { gates: hardStopGates, protocolParameters } = await this.#evaluateHardStopGates(session, plan);

    // Advisory only (start() does not enforce it) — flagged blocking:false so it never gates the
    // Begin-procedure button; surfaced because the technician needs to see the package balance.
    const limit = this.#sessionLimit(plan);
    const used = await this.sessionRepository.countForPlan(plan._id);
    const balanceOk = used <= limit;
    const packageGate = {
      key: PREFLIGHT_GATE.PACKAGE_BALANCE,
      label: 'Package / plan sessions remaining',
      passed: balanceOk,
      overridable: false,
      blocking: false,
      detail: balanceOk
        ? `${Math.max(0, limit - used)} of ${limit} session(s) remaining`
        : `Session limit reached (${used}/${limit})`,
      resolvedBy: 'Cashier / front desk — sell or extend the package',
    };

    const gates = [statusGate, ...paymentGates, ...hardStopGates, packageGate].map((g) =>
      this.#publicGate(g)
    );
    const blocking = gates.filter((g) => g.blocking && !g.passed);
    const canOverride = hasAnyPermission(req?.auth?.permissions || [], [
      PERMISSIONS.TREATMENT_HARD_STOP_OVERRIDE,
    ]);
    const allBlockersOverridable = blocking.length > 0 && blocking.every((g) => g.overridable);

    return {
      sessionId: session._id.toString(),
      sessionNumber: session.sessionNumber,
      status: session.status,
      gates,
      /**
       * TRT-006 — the protocol's configured execution parameters, surfaced so the execution screen
       * pre-fills them instead of inventing values (the UI previously hardcoded machine: 'Unit 1').
       * `suggestedSettings` is what start() writes into deviceUsage.settings when the caller sends
       * no settings of its own.
       */
      protocolParameters: protocolParameters?.items || [],
      suggestedSettings: protocolParameters?.merged || {},
      blockingGates: blocking.map((g) => g.key),
      canStart: blocking.length === 0,
      requiresOverride: allBlockersOverridable,
      canOverride,
      canStartWithOverride: allBlockersOverridable && canOverride,
      override: {
        permission: PERMISSIONS.TREATMENT_HARD_STOP_OVERRIDE,
        reasonRequired: true,
        endpoint: `/treatment-sessions/${session._id.toString()}/start`,
        field: 'override.reason',
      },
      evaluatedAt: new Date().toISOString(),
    };
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

    // TRT-006 — screening answers may be captured as part of the start call (the technician answers
    // the protocol's contraindication questions on the execution screen). Record them BEFORE the
    // gates run so the CONTRAINDICATION gate evaluates what was just answered.
    const screening = this.#normalizeScreening(payload.contraindicationScreening, actorId);
    if (screening) {
      session.contraindicationScreening = screening;
      await this.sessionRepository.updateById(id, { contraindicationScreening: screening });
    }

    const { protocol, protocolParameters, overrides } = await this.#assertHardStops(
      session,
      plan,
      actorId,
      req,
      payload.override
    );

    const startedAt = new Date();
    await this.sessionRepository.updateById(id, {
      status: TREATMENT_SESSION_STATUS.IN_PROGRESS,
      startedAt,
      technicianId: payload.technicianId || session.technicianId || actorId,
      protocolVersionSnapshot: protocol
        ? { protocolId: protocol._id.toString(), version: protocol.version, snapshotAt: new Date() }
        : session.protocolVersionSnapshot,
      ...(overrides.length ? { $push: { hardStopOverrides: { $each: overrides } } } : {}),
      // TRT-006 — when the caller supplies no machine settings, fall back to the parameters the
      // protocol actually configures rather than leaving them blank (or letting the UI invent them).
      deviceUsage: {
        device: payload.deviceUsage?.device ?? session.deviceUsage?.device ?? null,
        machine: payload.deviceUsage?.machine ?? session.deviceUsage?.machine ?? null,
        laserHead: payload.deviceUsage?.laserHead ?? session.deviceUsage?.laserHead ?? null,
        settings:
          payload.deviceUsage?.settings && Object.keys(payload.deviceUsage.settings).length
            ? payload.deviceUsage.settings
            : session.deviceUsage?.settings && Object.keys(session.deviceUsage.settings).length
              ? session.deviceUsage.settings
              : protocolParameters?.merged || {},
      },
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

  async uploadPhoto(id, { file, photoType = 'BEFORE', title, bodyRegion = null }, actorId, req = null) {
    const session = await this.sessionRepository.findByIdNotDeleted(id);
    if (!session) throw ApiError.notFound('Treatment session not found');
    if (!file?.buffer) throw ApiError.badRequest('File is required');

    const plan = await this.planRepository.findByIdNotDeleted(session.treatmentPlanId);

    // IMG-003/PRV-001 (P0) — the session capture path used to write patient imagery with NO consent
    // check, NO restricted-body-area check and NO image-type screen, leaving consentVerified at the
    // model default of false. It now goes through exactly the same shared policy as the consultation
    // capture path (ClinicalPhotoPolicyService — one implementation, no copy-paste to drift), gated
    // on the same CONSENT_PURPOSE.CLINICAL_PHOTOGRAPHY grant. Enforced BEFORE any bytes are stored.
    const verified = await this.photoPolicy.assertCaptureAllowed({
      patientId: session.patientId,
      bodyRegion,
      file,
      actorId,
      req,
      metadata: {
        treatmentSessionId: id,
        treatmentPlanId: session.treatmentPlanId?.toString?.() || null,
        consultationId: plan?.consultationId?.toString?.() || null,
      },
    });

    const type = String(photoType).toUpperCase() === 'AFTER' ? 'AFTER' : 'BEFORE';
    const saved = await this.storage.save(file.buffer, {
      folder: `treatment-sessions/${id}/photos`,
      filename: `${Date.now()}-${file.originalname.replace(/[^\w.-]+/g, '_')}`,
      mimeType: file.mimetype,
    });

    // Reuse ClinicalPhoto model when plan has consultationId (additive metadata only)
    let photoId = null;
    if (plan?.consultationId) {
      const photo = await this.photoRepository.create({
        consultationId: plan.consultationId,
        patientId: session.patientId,
        photoType: type === 'AFTER' ? PHOTO_TYPE.AFTER : PHOTO_TYPE.BEFORE,
        title: title || file.originalname,
        bodyRegion: bodyRegion || null,
        storageKey: saved.key,
        originalName: file.originalname,
        mimeType: saved.mimeType,
        size: saved.size,
        metadata: { treatmentSessionId: id, source: 'treatment_session' },
        // Verified against the real ConsentGrant log above — never a caller-supplied flag.
        ...verified,
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
