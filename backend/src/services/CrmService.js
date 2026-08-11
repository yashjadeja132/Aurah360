import ApiError from '../libs/ApiError.js';
import {
  LeadRepository,
  LeadFollowUpRepository,
  LeadTaskRepository,
} from '../repositories/CrmRepository.js';
import MasterRepository from '../repositories/MasterRepository.js';
import BranchRepository from '../repositories/BranchRepository.js';
import PatientService from './PatientService.js';
import AuditService from './AuditService.js';
import { eventBus } from '../events/eventBus.js';
import { emitQueueEvent, SOCKET_EVENTS } from '../socket/index.js';
import { generateLeadNumber } from '../helpers/leadNumber.helper.js';
import { scheduleFollowUpReminder } from '../queues/crmJobs.js';
import {
  CRM_EVENTS,
  LEAD_PRIORITY,
  LEAD_STATUS,
  LEAD_STATUS_TRANSITIONS,
  LEAD_TASK_STATUS,
} from '../enums/crm.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { MASTER_TYPES } from '../constants/masterTypes.js';

/**
 * CRM & Lead Management.
 * Conversion ALWAYS reuses PatientService.create — never duplicates registration.
 */
class CrmService {
  constructor() {
    this.leadRepo = new LeadRepository();
    this.followUpRepo = new LeadFollowUpRepository();
    this.taskRepo = new LeadTaskRepository();
    this.masterRepo = new MasterRepository();
    this.branchRepo = new BranchRepository();
    this.patientService = new PatientService();
    this.auditService = new AuditService();
  }

  #mapLead(doc, extras = {}) {
    if (!doc) return null;
    const extra = { ...extras };
    if (doc.branchId?.name || doc.branchId?.displayName) {
      extra.branch = {
        id: doc.branchId._id.toString(),
        name: doc.branchId.displayName || doc.branchId.name,
      };
      extra.branchId = doc.branchId._id.toString();
    }
    if (doc.assignedTo?.firstName) {
      extra.assignee = {
        id: doc.assignedTo._id.toString(),
        fullName: `${doc.assignedTo.firstName} ${doc.assignedTo.lastName || ''}`.trim(),
        role: doc.assignedTo.role,
      };
      extra.assignedTo = doc.assignedTo._id.toString();
    }
    if (doc.sourceId?.name) {
      extra.sourceMaster = {
        id: doc.sourceId._id.toString(),
        name: doc.sourceId.name,
        code: doc.sourceId.code,
      };
      extra.sourceId = doc.sourceId._id.toString();
    }
    if (doc.convertedPatientId?.mrn) {
      extra.convertedPatient = {
        id: doc.convertedPatientId._id.toString(),
        mrn: doc.convertedPatientId.mrn,
        fullName: `${doc.convertedPatientId.firstName} ${doc.convertedPatientId.lastName || ''}`.trim(),
      };
      extra.convertedPatientId = doc.convertedPatientId._id.toString();
    }
    return doc.toSafeObject(extra);
  }

  #mapFollowUp(doc) {
    if (!doc) return null;
    const extra = {};
    if (doc.assignedTo?.firstName) {
      extra.assignee = {
        id: doc.assignedTo._id.toString(),
        fullName: `${doc.assignedTo.firstName} ${doc.assignedTo.lastName || ''}`.trim(),
      };
      extra.assignedTo = doc.assignedTo._id.toString();
    }
    return doc.toSafeObject(extra);
  }

  #mapTask(doc) {
    if (!doc) return null;
    const extra = {};
    if (doc.assignedTo?.firstName) {
      extra.assignee = {
        id: doc.assignedTo._id.toString(),
        fullName: `${doc.assignedTo.firstName} ${doc.assignedTo.lastName || ''}`.trim(),
        role: doc.assignedTo.role,
      };
      extra.assignedTo = doc.assignedTo._id.toString();
    }
    if (doc.leadId?.leadNumber) {
      extra.lead = {
        id: doc.leadId._id.toString(),
        leadNumber: doc.leadId.leadNumber,
        fullName: `${doc.leadId.firstName} ${doc.leadId.lastName || ''}`.trim(),
        phone: doc.leadId.phone,
        status: doc.leadId.status,
      };
      extra.leadId = doc.leadId._id.toString();
    }
    return doc.toSafeObject(extra);
  }

  async #resolveSource(sourceId, sourceName) {
    if (sourceId) {
      const master = await this.masterRepo.findByIdNotDeleted(sourceId);
      if (!master || master.type !== MASTER_TYPES.LEAD_SOURCE) {
        throw ApiError.badRequest('Invalid lead source (use Masters LEAD_SOURCE)');
      }
      return { sourceId: master._id, source: master.name };
    }
    if (sourceName) {
      const masters = await this.masterRepo.findMany(
        { type: MASTER_TYPES.LEAD_SOURCE, deletedAt: null, isActive: true },
        { limit: 50 }
      );
      const match = masters.find(
        (m) =>
          m.name?.toLowerCase() === String(sourceName).toLowerCase() ||
          m.code?.toLowerCase() === String(sourceName).toLowerCase()
      );
      if (match) return { sourceId: match._id, source: match.name };
      return { sourceId: null, source: sourceName };
    }
    return { sourceId: null, source: null };
  }

  #assertTransition(from, to) {
    if (from === to) return;
    const allowed = LEAD_STATUS_TRANSITIONS[from] || [];
    if (!allowed.includes(to)) {
      throw ApiError.badRequest(`Cannot transition lead from ${from} to ${to}`);
    }
  }

  /**
   * SEC-030 — the branch filter is folded into the LOOKUP so an out-of-branch lead is
   * indistinguishable from a non-existent one (404, never 403).
   */
  async #findScoped(id, branchId) {
    const filter = { _id: id, deletedAt: null };
    if (branchId) filter.branchId = branchId;
    return this.leadRepo.model.findOne(filter).exec();
  }

  async #assertScoped(id, branchId) {
    const lead = await this.#findScoped(id, branchId);
    if (!lead) throw ApiError.notFound('Lead not found');
    return lead;
  }

  async create(payload, actorId, req = null, { branchId = null } = {}) {
    if (!payload.firstName) throw ApiError.badRequest('firstName is required');
    if (!payload.phone) throw ApiError.badRequest('phone is required');
    // A branch-scoped user creates leads in their OWN branch. 403 rather than 404: the caller
    // named a branch id, not a record id, and branch ids are already visible to them.
    if (branchId && payload.branchId && String(payload.branchId) !== String(branchId)) {
      throw ApiError.forbidden('branchId is outside your branch scope', 'BRANCH_SCOPE_VIOLATION');
    }
    if (branchId) payload = { ...payload, branchId };
    if (!payload.branchId) throw ApiError.badRequest('branchId is required');

    const branch = await this.branchRepo.findByIdNotDeleted(payload.branchId);
    if (!branch) throw ApiError.badRequest('Invalid branch');

    const { sourceId, source } = await this.#resolveSource(payload.sourceId, payload.source);

    const lead = await this.leadRepo.create({
      leadNumber: await generateLeadNumber(),
      firstName: payload.firstName,
      lastName: payload.lastName || null,
      phone: payload.phone,
      alternatePhone: payload.alternatePhone || null,
      email: payload.email || null,
      gender: payload.gender || null,
      age: payload.age ?? null,
      city: payload.city || null,
      sourceId,
      source,
      campaign: payload.campaign || null,
      branchId: payload.branchId,
      assignedTo: payload.assignedTo || null,
      interestedServices: payload.interestedServices || [],
      budget: payload.budget ?? null,
      priority: payload.priority || LEAD_PRIORITY.MEDIUM,
      status: payload.assignedTo ? LEAD_STATUS.ASSIGNED : LEAD_STATUS.NEW,
      remarks: payload.remarks || null,
      nextFollowUp: payload.nextFollowUp ? new Date(payload.nextFollowUp) : null,
      createdBy: actorId,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.LEAD_CREATED, {
      actorId,
      metadata: { leadId: lead._id.toString(), leadNumber: lead.leadNumber },
      req,
    });

    const eventPayload = {
      leadId: lead._id.toString(),
      leadNumber: lead.leadNumber,
      branchId: lead.branchId.toString(),
      status: lead.status,
    };
    eventBus.emitDomain(CRM_EVENTS.LEAD_CREATED, eventPayload);
    emitQueueEvent(SOCKET_EVENTS.LEAD_CREATED, eventPayload);

    if (lead.assignedTo) {
      eventBus.emitDomain(CRM_EVENTS.LEAD_ASSIGNED, {
        ...eventPayload,
        assignedTo: lead.assignedTo.toString(),
      });
    }

    if (lead.nextFollowUp) {
      await scheduleFollowUpReminder(lead._id.toString(), lead.nextFollowUp);
    }

    return this.getById(lead._id.toString());
  }

  async getById(id, { branchId = null } = {}) {
    const doc = await this.leadRepo.findByIdPopulated(id, { branchId });
    if (!doc) throw ApiError.notFound('Lead not found');
    const followUps = await this.followUpRepo.listByLead(doc._id);
    const tasks = await this.taskRepo.list({ leadId: doc._id, limit: 50 });
    return this.#mapLead(doc, {
      followUps: followUps.map((f) => this.#mapFollowUp(f)),
      tasks: tasks.items.map((t) => this.#mapTask(t)),
    });
  }

  async list(query = {}) {
    const limit = Math.min(Number(query.limit) || 50, 200);
    const page = Math.max(Number(query.page) || 1, 1);
    const { items, total } = await this.leadRepo.list({
      branchId: query.branchId || null,
      status: query.status || null,
      assignedTo: query.assignedTo || null,
      source: query.source || null,
      q: query.q || null,
      priority: query.priority || null,
      followUpBefore: query.followUpBefore || null,
      followUpAfter: query.followUpAfter || null,
      limit,
      skip: (page - 1) * limit,
    });
    return {
      items: items.map((l) => this.#mapLead(l)),
      meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async update(id, payload, actorId, { branchId = null } = {}) {
    const lead = await this.#assertScoped(id, branchId);
    if ([LEAD_STATUS.WON, LEAD_STATUS.JUNK].includes(lead.status) && !payload.force) {
      throw ApiError.forbidden('Cannot edit won/junk leads');
    }

    const updates = { updatedBy: actorId };
    for (const f of [
      'firstName',
      'lastName',
      'phone',
      'alternatePhone',
      'email',
      'gender',
      'age',
      'city',
      'campaign',
      'budget',
      'priority',
      'remarks',
      'lostReason',
    ]) {
      if (payload[f] !== undefined) updates[f] = payload[f];
    }
    if (payload.interestedServices) updates.interestedServices = payload.interestedServices;
    if (payload.nextFollowUp !== undefined) {
      updates.nextFollowUp = payload.nextFollowUp ? new Date(payload.nextFollowUp) : null;
    }
    if (payload.sourceId !== undefined || payload.source !== undefined) {
      const resolved = await this.#resolveSource(payload.sourceId, payload.source);
      updates.sourceId = resolved.sourceId;
      updates.source = resolved.source;
    }

    await this.leadRepo.updateById(id, updates);
    if (updates.nextFollowUp) {
      await scheduleFollowUpReminder(id, updates.nextFollowUp);
    }
    return this.getById(id);
  }

  async assign(id, { assignedTo }, actorId, req = null, { branchId = null } = {}) {
    const lead = await this.#assertScoped(id, branchId);
    if (!assignedTo) throw ApiError.badRequest('assignedTo is required');

    const updates = {
      assignedTo,
      updatedBy: actorId,
    };
    if (lead.status === LEAD_STATUS.NEW) {
      updates.status = LEAD_STATUS.ASSIGNED;
    }

    await this.leadRepo.updateById(id, updates);

    await this.auditService.record(AUDIT_ACTIONS.LEAD_ASSIGNED, {
      actorId,
      metadata: { leadId: id, assignedTo },
      req,
    });

    const eventPayload = {
      leadId: id,
      leadNumber: lead.leadNumber,
      assignedTo,
      branchId: lead.branchId.toString(),
    };
    eventBus.emitDomain(CRM_EVENTS.LEAD_ASSIGNED, eventPayload);
    emitQueueEvent(SOCKET_EVENTS.LEAD_ASSIGNED, eventPayload);

    return this.getById(id);
  }

  async changeStatus(id, { status, lostReason }, actorId, req = null, { branchId = null } = {}) {
    const lead = await this.#assertScoped(id, branchId);
    if (!status) throw ApiError.badRequest('status is required');
    this.#assertTransition(lead.status, status);

    const updates = { status, updatedBy: actorId };
    if (status === LEAD_STATUS.LOST) {
      updates.lostReason = lostReason || lead.lostReason || 'Not specified';
    }

    await this.leadRepo.updateById(id, updates);

    if (status === LEAD_STATUS.LOST) {
      await this.auditService.record(AUDIT_ACTIONS.LEAD_LOST, {
        actorId,
        metadata: { leadId: id, lostReason: updates.lostReason },
        req,
      });
    }

    return this.getById(id);
  }

  async pipeline(branchId = null) {
    const leads = await this.leadRepo.pipeline(branchId);
    const columns = {};
    for (const s of Object.values(LEAD_STATUS)) {
      if (s === LEAD_STATUS.JUNK) continue;
      columns[s] = [];
    }
    for (const lead of leads) {
      if (!columns[lead.status]) columns[lead.status] = [];
      columns[lead.status].push(this.#mapLead(lead));
    }
    return { columns };
  }

  async addFollowUp(leadId, payload, actorId, req = null, { branchId = null } = {}) {
    const lead = await this.#assertScoped(leadId, branchId);
    if (!payload.type) throw ApiError.badRequest('type is required');

    const followUp = await this.followUpRepo.create({
      leadId,
      date: payload.date ? new Date(payload.date) : new Date(),
      type: payload.type,
      notes: payload.notes || null,
      outcome: payload.outcome || null,
      nextFollowUp: payload.nextFollowUp ? new Date(payload.nextFollowUp) : null,
      assignedTo: payload.assignedTo || lead.assignedTo || actorId,
      createdBy: actorId,
    });

    const leadUpdates = { updatedBy: actorId };
    if (followUp.nextFollowUp) {
      leadUpdates.nextFollowUp = followUp.nextFollowUp;
      await scheduleFollowUpReminder(leadId, followUp.nextFollowUp);
    }
    if (
      lead.status === LEAD_STATUS.NEW ||
      lead.status === LEAD_STATUS.ASSIGNED
    ) {
      leadUpdates.status = LEAD_STATUS.CONTACTED;
    }
    await this.leadRepo.updateById(leadId, leadUpdates);

    await this.auditService.record(AUDIT_ACTIONS.LEAD_FOLLOW_UP_ADDED, {
      actorId,
      metadata: { leadId, followUpId: followUp._id.toString(), type: payload.type },
      req,
    });

    return {
      followUp: this.#mapFollowUp(followUp),
      lead: await this.getById(leadId),
    };
  }

  /**
   * Convert lead → Patient via PatientService.create (no duplicated registration).
   */
  async convert(id, payload = {}, actorId, req = null, { branchId = null } = {}) {
    const lead = await this.#assertScoped(id, branchId);
    if (lead.convertedPatientId) {
      throw ApiError.forbidden('Lead already converted');
    }
    if ([LEAD_STATUS.LOST, LEAD_STATUS.JUNK].includes(lead.status)) {
      throw ApiError.forbidden('Cannot convert lost/junk lead');
    }

    const patientPayload = {
      firstName: payload.firstName || lead.firstName,
      lastName: payload.lastName || lead.lastName || '.',
      gender: payload.gender || lead.gender || 'OTHER',
      mobile: payload.mobile || lead.phone,
      email: payload.email || lead.email || null,
      primaryBranchId: payload.primaryBranchId || lead.branchId.toString(),
      leadSourceId: lead.sourceId?.toString?.() || lead.sourceId || null,
      primaryDoctorId: payload.primaryDoctorId || null,
      address: { city: payload.city || lead.city || null },
      dateOfBirth: payload.dateOfBirth || null,
      notes: payload.notes || `Converted from ${lead.leadNumber}`,
      allowDuplicate: payload.allowDuplicate === true,
      // LOY Flow C — a counsellor converting a lead can enter the referring patient's code on
      // the new patient's behalf; always staff-entered here, so it is always audited (see
      // PatientService.create / ReferralService.registerReferral).
      referralCode: payload.referralCode || null,
      referralCreatedByStaff: true,
    };

    const patient = await this.patientService.create(patientPayload, actorId, req);

    await this.leadRepo.updateById(id, {
      status: LEAD_STATUS.WON,
      convertedPatientId: patient.id,
      convertedAt: new Date(),
      updatedBy: actorId,
      remarks: payload.remarks || lead.remarks,
    });

    await this.auditService.record(AUDIT_ACTIONS.LEAD_CONVERTED, {
      actorId,
      metadata: {
        leadId: id,
        leadNumber: lead.leadNumber,
        patientId: patient.id,
        mrn: patient.mrn,
      },
      req,
    });

    const eventPayload = {
      leadId: id,
      leadNumber: lead.leadNumber,
      patientId: patient.id,
      mrn: patient.mrn,
      branchId: lead.branchId.toString(),
    };
    eventBus.emitDomain(CRM_EVENTS.LEAD_CONVERTED, eventPayload);
    emitQueueEvent(SOCKET_EVENTS.LEAD_CONVERTED, eventPayload);

    return {
      lead: await this.getById(id),
      patient,
    };
  }

  // —— Tasks ——
  /**
   * SEC-030 — `LeadTask` carries no branch column of its own; a task belongs to a lead and
   * inherits that lead's branch. So the caller's branch is translated into the set of lead ids
   * they may see, and the task query is filtered to those. Resolving ids rather than adding a
   * denormalised `branchId` to LeadTask keeps one source of truth for a task's branch (moving a
   * lead cannot leave its tasks pointing at the old site).
   */
  async #leadIdsInBranch(branchId) {
    return this.leadRepo.model.distinct('_id', { branchId, deletedAt: null });
  }

  async createTask(payload, actorId, { branchId = null } = {}) {
    if (!payload.leadId) throw ApiError.badRequest('leadId is required');
    if (!payload.title) throw ApiError.badRequest('title is required');
    // 404, not 403: an out-of-branch lead must not be confirmed to exist.
    await this.#assertScoped(payload.leadId, branchId);

    const task = await this.taskRepo.create({
      leadId: payload.leadId,
      title: payload.title,
      description: payload.description || null,
      assigneeRole: payload.assigneeRole || null,
      assignedTo: payload.assignedTo || null,
      dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
      reminderAt: payload.reminderAt ? new Date(payload.reminderAt) : null,
      status: LEAD_TASK_STATUS.PENDING,
      createdBy: actorId,
      updatedBy: actorId,
    });

    return this.#mapTask(
      await this.taskRepo.model
        .findById(task._id)
        .populate('assignedTo', 'firstName lastName role')
        .populate('leadId', 'leadNumber firstName lastName phone status')
        .exec()
    );
  }

  async updateTask(id, payload, actorId, { branchId = null } = {}) {
    const task = await this.taskRepo.findByIdNotDeleted(id);
    // The task's branch is its lead's branch; an out-of-branch task reads as "not found".
    if (!task) throw ApiError.notFound('Task not found');
    if (branchId && !(await this.#findScoped(task.leadId, branchId))) {
      throw ApiError.notFound('Task not found');
    }
    const updates = { updatedBy: actorId };
    for (const f of ['title', 'description', 'assigneeRole', 'assignedTo', 'status']) {
      if (payload[f] !== undefined) updates[f] = payload[f];
    }
    if (payload.dueDate !== undefined) {
      updates.dueDate = payload.dueDate ? new Date(payload.dueDate) : null;
    }
    if (payload.reminderAt !== undefined) {
      updates.reminderAt = payload.reminderAt ? new Date(payload.reminderAt) : null;
    }
    if (payload.status === LEAD_TASK_STATUS.DONE) updates.completedAt = new Date();
    await this.taskRepo.updateById(id, updates);
    const refreshed = await this.taskRepo.model
      .findById(id)
      .populate('assignedTo', 'firstName lastName role')
      .populate('leadId', 'leadNumber firstName lastName phone status')
      .exec();
    return this.#mapTask(refreshed);
  }

  async listTasks(query = {}) {
    const limit = Math.min(Number(query.limit) || 50, 100);
    const page = Math.max(Number(query.page) || 1, 1);
    const { items, total } = await this.taskRepo.list({
      // null = no branch restriction (OWNER/ADMIN); otherwise only this branch's leads' tasks.
      leadIdsIn: query.branchId ? await this.#leadIdsInBranch(query.branchId) : null,
      leadId: query.leadId || null,
      assignedTo: query.assignedTo || null,
      status: query.status || null,
      limit,
      skip: (page - 1) * limit,
    });
    return {
      items: items.map((t) => this.#mapTask(t)),
      meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    };
  }

  /** Placeholder communication log — no external integrations */
  async logCommunication(
    leadId,
    { channel, notes, direction = 'OUTBOUND' },
    actorId,
    req = null,
    scope = {}
  ) {
    const typeMap = {
      WHATSAPP: 'WHATSAPP',
      SMS: 'SMS',
      EMAIL: 'EMAIL',
      PHONE: 'CALL',
      CALL: 'CALL',
    };
    return this.addFollowUp(
      leadId,
      {
        type: typeMap[String(channel || 'CALL').toUpperCase()] || 'CALL',
        notes: `[${direction} placeholder] ${notes || ''}`.trim(),
        outcome: 'Logged (no integration)',
        date: new Date(),
      },
      actorId,
      req,
      scope
    );
  }

  async dashboard(branchId = null) {
    const filter = { deletedAt: null };
    if (branchId) filter.branchId = branchId;

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const [total, won, lost, todayFollowUps, overdue, byStatus] = await Promise.all([
      this.leadRepo.count(filter),
      this.leadRepo.count({ ...filter, status: LEAD_STATUS.WON }),
      this.leadRepo.count({ ...filter, status: LEAD_STATUS.LOST }),
      this.leadRepo.count({
        ...filter,
        nextFollowUp: { $gte: startOfDay, $lte: endOfDay },
        status: { $nin: [LEAD_STATUS.WON, LEAD_STATUS.LOST, LEAD_STATUS.JUNK] },
      }),
      this.leadRepo.count({
        ...filter,
        nextFollowUp: { $lt: startOfDay },
        status: { $nin: [LEAD_STATUS.WON, LEAD_STATUS.LOST, LEAD_STATUS.JUNK] },
      }),
      this.leadRepo.model.aggregate([
        { $match: filter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const funnel = {};
    for (const row of byStatus) funnel[row._id] = row.count;

    const open = total - won - lost;
    const conversionRate = total > 0 ? Math.round((won / total) * 1000) / 10 : 0;

    const todayList = await this.leadRepo.list({
      branchId,
      followUpAfter: startOfDay,
      followUpBefore: endOfDay,
      limit: 20,
    });
    const overdueList = await this.leadRepo.dueFollowUps({
      before: startOfDay,
      branchId,
    });

    return {
      summary: {
        total,
        open,
        won,
        lost,
        todayFollowUps,
        overdue,
        conversionRate,
      },
      funnel,
      todayFollowUps: todayList.items.map((l) => this.#mapLead(l)),
      overdue: overdueList.slice(0, 20).map((l) => this.#mapLead(l)),
    };
  }

  async reports(type, query = {}) {
    const match = { deletedAt: null };
    if (query.branchId) match.branchId = query.branchId;

    if (type === 'source') {
      const rows = await this.leadRepo.model.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$source',
            total: { $sum: 1 },
            won: { $sum: { $cond: [{ $eq: ['$status', LEAD_STATUS.WON] }, 1, 0] } },
          },
        },
        { $sort: { total: -1 } },
      ]);
      return {
        items: rows.map((r) => ({
          source: r._id || 'Unknown',
          total: r.total,
          won: r.won,
          conversionPercent: r.total ? Math.round((r.won / r.total) * 1000) / 10 : 0,
        })),
      };
    }

    if (type === 'conversion') {
      const total = await this.leadRepo.count(match);
      const won = await this.leadRepo.count({ ...match, status: LEAD_STATUS.WON });
      return {
        total,
        won,
        conversionPercent: total ? Math.round((won / total) * 1000) / 10 : 0,
      };
    }

    if (type === 'counsellor') {
      const rows = await this.leadRepo.model.aggregate([
        { $match: { ...match, assignedTo: { $ne: null } } },
        {
          $group: {
            _id: '$assignedTo',
            total: { $sum: 1 },
            won: { $sum: { $cond: [{ $eq: ['$status', LEAD_STATUS.WON] }, 1, 0] } },
            lost: { $sum: { $cond: [{ $eq: ['$status', LEAD_STATUS.LOST] }, 1, 0] } },
          },
        },
        { $sort: { won: -1 } },
      ]);
      return {
        items: rows.map((r) => ({
          assignedTo: r._id?.toString(),
          total: r.total,
          won: r.won,
          lost: r.lost,
          conversionPercent: r.total ? Math.round((r.won / r.total) * 1000) / 10 : 0,
        })),
      };
    }

    if (type === 'lost-reasons') {
      const rows = await this.leadRepo.model.aggregate([
        { $match: { ...match, status: LEAD_STATUS.LOST } },
        { $group: { _id: '$lostReason', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);
      return {
        items: rows.map((r) => ({
          reason: r._id || 'Not specified',
          count: r.count,
        })),
      };
    }

    throw ApiError.badRequest('Unknown report type');
  }

  /** Called by BullMQ worker for due/missed follow-ups */
  async processFollowUpReminders() {
    const due = await this.leadRepo.dueFollowUps({ before: new Date() });
    for (const lead of due) {
      const payload = {
        leadId: lead._id.toString(),
        leadNumber: lead.leadNumber,
        nextFollowUp: lead.nextFollowUp,
        assignedTo: lead.assignedTo?._id?.toString() || lead.assignedTo?.toString() || null,
        branchId: lead.branchId?.toString?.() || lead.branchId,
      };
      eventBus.emitDomain(CRM_EVENTS.FOLLOW_UP_DUE, payload);
      emitQueueEvent(SOCKET_EVENTS.FOLLOW_UP_DUE, payload);
    }
    return { processed: due.length };
  }
}

export default CrmService;
