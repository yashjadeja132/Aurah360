import ApiError from '../libs/ApiError.js';
import PatientRepository from '../repositories/PatientRepository.js';
import BranchRepository from '../repositories/BranchRepository.js';
import DoctorRepository from '../repositories/DoctorRepository.js';
import MasterRepository from '../repositories/MasterRepository.js';
import PatientTimelineService from './PatientTimelineService.js';
import PatientDuplicateService from './PatientDuplicateService.js';
import AuditService from './AuditService.js';
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

  async create(payload, actorId, req = null) {
    await this.#assertBranch(payload.primaryBranchId);
    await this.#assertDoctor(payload.primaryDoctorId);
    await this.#assertLeadSource(payload.leadSourceId);

    const mrn = await generateMrn();
    const patientCode = payload.patientCode || (await generatePatientCode(mrn));

    const patient = await this.patientRepository.create({
      ...payload,
      mrn,
      patientCode,
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
