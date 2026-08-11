import ApiError from '../libs/ApiError.js';
import PatientRepository from '../repositories/PatientRepository.js';
import BranchRepository from '../repositories/BranchRepository.js';
import DoctorRepository from '../repositories/DoctorRepository.js';
import MasterRepository from '../repositories/MasterRepository.js';
import PatientTimelineService from './PatientTimelineService.js';
import PatientDuplicateService from './PatientDuplicateService.js';
import AuditService from './AuditService.js';
import { eventBus } from '../events/eventBus.js';
import { generateMrn, generatePatientCode } from '../helpers/mrn.helper.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { TIMELINE_EVENT } from '../enums/patient.js';
import { ENTITY_STATUS, PAGINATION } from '../constants/index.js';
import { MASTER_TYPES } from '../constants/masterTypes.js';

class PatientService {
  constructor() {
    this.patientRepository = new PatientRepository();
    this.branchRepository = new BranchRepository();
    this.doctorRepository = new DoctorRepository();
    this.masterRepository = new MasterRepository();
    this.timelineService = new PatientTimelineService();
    this.duplicateService = new PatientDuplicateService();
    this.auditService = new AuditService();
  }

  async #assertBranch(branchId) {
    const branch = await this.branchRepository.findByIdNotDeleted(branchId);
    if (!branch) throw ApiError.badRequest('Invalid primary branch');
    return branch;
  }

  async #assertDoctor(doctorId) {
    if (!doctorId) return null;
    const doctor = await this.doctorRepository.findByIdNotDeleted(doctorId);
    if (!doctor) throw ApiError.badRequest('Invalid primary doctor');
    return doctor;
  }

  async #assertLeadSource(leadSourceId) {
    if (!leadSourceId) return null;
    const master = await this.masterRepository.findByIdNotDeleted(leadSourceId);
    if (!master || master.type !== MASTER_TYPES.LEAD_SOURCE) {
      throw ApiError.badRequest('Invalid lead source');
    }
    return master;
  }

  #mapPatient(doc) {
    const extra = {};
    if (doc.primaryBranchId?.name || doc.primaryBranchId?.displayName) {
      extra.primaryBranch = {
        id: doc.primaryBranchId._id.toString(),
        name: doc.primaryBranchId.displayName || doc.primaryBranchId.name,
        branchCode: doc.primaryBranchId.branchCode,
      };
      extra.primaryBranchId = doc.primaryBranchId._id.toString();
    }
    if (doc.primaryDoctorId?.doctorCode) {
      const u = doc.primaryDoctorId.userId;
      extra.primaryDoctor = {
        id: doc.primaryDoctorId._id.toString(),
        doctorCode: doc.primaryDoctorId.doctorCode,
        specialization: doc.primaryDoctorId.specialization,
        name: u ? `${u.firstName} ${u.lastName}`.trim() : null,
      };
      extra.primaryDoctorId = doc.primaryDoctorId._id.toString();
    }
    if (doc.leadSourceId?.name) {
      extra.leadSource = {
        id: doc.leadSourceId._id.toString(),
        name: doc.leadSourceId.name,
        code: doc.leadSourceId.code,
      };
      extra.leadSourceId = doc.leadSourceId._id.toString();
    }
    return doc.toSafeObject(extra);
  }

  /**
   * PAT-DUP — duplicate detection ran ONLY in the browser (POST /patients/duplicates/check before
   * submit), so it protected the form, not the record: any API client, import job or retried
   * request could mint unlimited duplicates of the same person, splitting their history across
   * MRNs. The check now runs where the record is actually written.
   *
   * It is a 409 with the candidate on it, not a block: real families share a phone number, so the
   * clinic must be able to say "yes, this is a different person" by re-posting with
   * `allowDuplicate: true`. Matching is on mobile OR name+DOB — email alone is intentionally not
   * a bar, since households commonly share one address.
   */
  async #assertNotDuplicate({ mobile, firstName, lastName, dateOfBirth }) {
    const candidates = await this.duplicateService.findDuplicates({
      mobile,
      firstName,
      lastName,
      dateOfBirth,
    });
    if (!candidates.length) return;

    const [likely] = candidates;
    throw new ApiError(409, 'A patient with these details already exists.', {
      code: 'PATIENT_DUPLICATE_SUSPECTED',
      errors: {
        // Named so the caller can show WHO it collided with and offer "this is a different
        // person" — a bare 409 would leave reception unable to act on it.
        matches: candidates.slice(0, 5).map((c) => ({
          id: c.id,
          mrn: c.mrn,
          fullName: [c.firstName, c.lastName].filter(Boolean).join(' '),
          mobile: c.mobile,
          dateOfBirth: c.dateOfBirth,
          matchReasons: c.matchReasons,
        })),
        likelyMatchId: likely.id,
        override: 'Re-submit with allowDuplicate: true to register this patient anyway.',
      },
    });
  }

  async create(payload, actorId, req = null) {
    const { allowDuplicate = false, ...attributes } = payload;

    await this.#assertBranch(attributes.primaryBranchId);
    await this.#assertDoctor(attributes.primaryDoctorId);
    await this.#assertLeadSource(attributes.leadSourceId);

    if (!allowDuplicate) await this.#assertNotDuplicate(attributes);

    const mrn = await generateMrn();
    const patientCode = attributes.patientCode || (await generatePatientCode(mrn));

    const patient = await this.patientRepository.create({
      ...attributes,
      mrn,
      patientCode,
      /**
       * PAT-003 first-touch attribution. Captured ONCE, here, from the source category the record
       * was created with. `update()` strips this key from every payload, so later edits to
       * `sourceCategory` (a patient who arrives via Instagram and is later re-tagged to a referral)
       * can never rewrite where the patient originally came from. Never client-settable: the
       * create validator does not list the field, so an inbound value is dropped before this point.
       */
      firstTouchSourceCategory: attributes.sourceCategory || null,
      email: payload.email || null,
      createdBy: actorId,
      updatedBy: actorId,
      registrationDate: payload.registrationDate || new Date(),
    });

    await this.timelineService.addEvent(patient._id, {
      eventType: TIMELINE_EVENT.PATIENT_REGISTERED,
      title: 'Patient registered',
      description: `${patient.firstName} ${patient.lastName} (${mrn})`,
      actorId,
    });

    if (payload.primaryDoctorId) {
      await this.timelineService.addEvent(patient._id, {
        eventType: TIMELINE_EVENT.DOCTOR_ASSIGNED,
        title: 'Primary doctor assigned',
        metadata: { doctorId: payload.primaryDoctorId },
        actorId,
      });
    }

    await this.auditService.record(AUDIT_ACTIONS.PATIENT_CREATED, {
      actorId,
      metadata: { patientId: patient._id.toString(), mrn },
      resourceType: 'Patient',
      resourceId: patient._id.toString(),
      req,
    });

    return this.#mapPatient(await this.patientRepository.findByIdPopulated(patient._id));
  }

  async update(id, payload, actorId, req = null) {
    const existing = await this.patientRepository.findByIdNotDeleted(id);
    if (!existing) throw ApiError.notFound('Patient not found');

    if (payload.primaryBranchId) await this.#assertBranch(payload.primaryBranchId);
    if (payload.primaryDoctorId !== undefined) await this.#assertDoctor(payload.primaryDoctorId);
    if (payload.leadSourceId !== undefined) await this.#assertLeadSource(payload.leadSourceId);

    const updates = { ...payload, updatedBy: actorId };
    delete updates.mrn;
    delete updates.uuid;
    delete updates.patientCode;
    /**
     * PAT-003 — first touch is immutable. Set once at creation and never rewritten, so marketing
     * attribution reflects where the patient actually came from rather than the last person who
     * edited the source dropdown. Also strip `guardianVerified`: verification is a staff act
     * performed through setGuardianVerified(), never a field anyone can set in a profile edit.
     */
    delete updates.firstTouchSourceCategory;
    delete updates.guardianVerified;

    // Backfill only: records created before first-touch capture existed have it unset, and the
    // earliest source we have is the best available first touch. Never overwrites a set value.
    if (!existing.firstTouchSourceCategory && payload.sourceCategory) {
      updates.firstTouchSourceCategory = payload.sourceCategory;
    }

    // RX-SAFETY — "No Known Drug Allergies" is a clinical assertion, so stamp who confirmed it
    // and when server-side. The prescribing safety check reads this to tell "confirmed none"
    // apart from "never asked" (see PrescriptionSafetyService).
    if (updates.medical && updates.medical.noKnownDrugAllergies === true) {
      updates.medical = {
        ...updates.medical,
        allergiesConfirmedAt: updates.medical.allergiesConfirmedAt || new Date(),
        allergiesConfirmedBy: actorId,
      };
    }

    await this.patientRepository.updateById(id, updates);

    await this.timelineService.addEvent(id, {
      eventType: TIMELINE_EVENT.PROFILE_UPDATED,
      title: 'Profile updated',
      metadata: { fields: Object.keys(payload) },
      actorId,
    });

    if (
      payload.primaryDoctorId !== undefined &&
      String(payload.primaryDoctorId || '') !== String(existing.primaryDoctorId || '')
    ) {
      await this.timelineService.addEvent(id, {
        eventType: TIMELINE_EVENT.DOCTOR_ASSIGNED,
        title: 'Primary doctor changed',
        metadata: { doctorId: payload.primaryDoctorId },
        actorId,
      });
    }

    if (
      payload.primaryBranchId &&
      String(payload.primaryBranchId) !== String(existing.primaryBranchId)
    ) {
      await this.timelineService.addEvent(id, {
        eventType: TIMELINE_EVENT.BRANCH_CHANGED,
        title: 'Primary branch changed',
        metadata: { branchId: payload.primaryBranchId },
        actorId,
      });
    }

    await this.auditService.record(AUDIT_ACTIONS.PATIENT_UPDATED, {
      actorId,
      metadata: { patientId: id, fields: Object.keys(payload) },
      resourceType: 'Patient',
      resourceId: id,
      req,
    });

    // E10 PROFILE_COMPLETION (loyalty) — reception's WEB profile-edit flow is the only place a
    // patient's contact/demographic fields get filled in, so this is the natural trigger point.
    // The listener (backend/src/loyalty/eventSubscriptions.js) decides completeness/one-time-ness;
    // this call site just reports "a profile save happened".
    eventBus.emitDomain('PatientProfileUpdated', {
      patientId: id,
      branchId: (existing.primaryBranchId || payload.primaryBranchId)?.toString?.() || existing.primaryBranchId,
      emittedAt: new Date().toISOString(),
    });

    return this.#mapPatient(await this.patientRepository.findByIdPopulated(id));
  }

  async updateConsent(id, consent, actorId, req = null) {
    const existing = await this.patientRepository.findByIdNotDeleted(id);
    if (!existing) throw ApiError.notFound('Patient not found');

    const next = {
      ...(existing.consent?.toObject?.() || existing.consent || {}),
      ...consent,
      acceptedAt: new Date(),
    };

    await this.patientRepository.updateById(id, { consent: next, updatedBy: actorId });

    await this.timelineService.addEvent(id, {
      eventType: TIMELINE_EVENT.CONSENT_UPDATED,
      title: 'Consent updated',
      actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.PATIENT_CONSENT_UPDATED, {
      actorId,
      metadata: { patientId: id },
      resourceType: 'Patient',
      resourceId: id,
      req,
    });

    return this.#mapPatient(await this.patientRepository.findByIdPopulated(id));
  }

  /**
   * PAT-005 — staff verification of a guardian↔dependent link.
   *
   * `guardianVerified` is the gate PatientPortalService uses before releasing a dependent's
   * clinical record to a guardian's portal login, so it can only ever be set here, by an
   * authenticated staff member holding PATIENTS_EDIT, after they have checked the relationship
   * against ID/consent at the desk. It is stripped from create/update payloads precisely so that
   * nobody can self-assert it.
   */
  async setGuardianVerified(id, { verified, note = null }, actorId, req = null) {
    const existing = await this.patientRepository.findByIdNotDeleted(id);
    if (!existing) throw ApiError.notFound('Patient not found');
    if (!existing.guardianPatientId) {
      throw ApiError.badRequest('This patient has no guardian link to verify.');
    }

    await this.patientRepository.updateById(id, {
      guardianVerified: Boolean(verified),
      updatedBy: actorId,
    });

    await this.timelineService.addEvent(id, {
      eventType: TIMELINE_EVENT.PROFILE_UPDATED,
      title: verified ? 'Guardian link verified' : 'Guardian link verification revoked',
      metadata: { guardianPatientId: existing.guardianPatientId?.toString?.() || null, note },
      actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.PATIENT_UPDATED, {
      actorId,
      metadata: { patientId: id, guardianVerified: Boolean(verified), note },
      resourceType: 'Patient',
      resourceId: id,
      req,
    });

    return this.#mapPatient(await this.patientRepository.findByIdPopulated(id));
  }

  async getById(id) {
    const patient = await this.patientRepository.findByIdPopulated(id);
    if (!patient) throw ApiError.notFound('Patient not found');
    return this.#mapPatient(patient);
  }

  async list(query = {}) {
    const page = Number(query.page) || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(Number(query.limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);

    let isActive;
    let isVip;
    if (query.isActive === 'true') isActive = true;
    if (query.isActive === 'false') isActive = false;
    if (query.isVip === 'true') isVip = true;
    if (query.isVip === 'false') isVip = false;

    const result = await this.patientRepository.paginate({
      page,
      limit,
      search: query.search,
      status: query.status,
      isActive,
      isVip,
      gender: query.gender,
      primaryBranchId: query.branchId || query.primaryBranchId,
      primaryDoctorId: query.doctorId || query.primaryDoctorId,
      leadSourceId: query.leadSourceId,
      tag: query.tag,
      registeredFrom: query.registeredFrom,
      registeredTo: query.registeredTo,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    const items = await Promise.all(
      result.items.map(async (row) => {
        const populated = await this.patientRepository.findByIdPopulated(row._id);
        return this.#mapPatient(populated || row);
      })
    );

    return {
      items,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  async softDelete(id, actorId, req = null) {
    const patient = await this.patientRepository.findByIdNotDeleted(id);
    if (!patient) throw ApiError.notFound('Patient not found');

    await this.patientRepository.updateById(id, {
      deletedAt: new Date(),
      deletedBy: actorId,
      isActive: false,
      status: ENTITY_STATUS.INACTIVE,
      updatedBy: actorId,
      mobile: `DEL_${Date.now()}_${patient.mobile}`.slice(0, 40),
      email: patient.email ? `del_${Date.now()}_${patient.email}`.slice(0, 120) : null,
    });

    await this.auditService.record(AUDIT_ACTIONS.PATIENT_DELETED, {
      actorId,
      metadata: { patientId: id, mrn: patient.mrn },
      resourceType: 'Patient',
      resourceId: id,
      req,
    });

    return true;
  }

  async detectDuplicates(payload) {
    return this.duplicateService.findDuplicates(payload);
  }
}

export default PatientService;
