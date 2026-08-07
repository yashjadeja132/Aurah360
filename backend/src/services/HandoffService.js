import HandoffNoteRepository from '../repositories/HandoffNoteRepository.js';
import AuditService from './AuditService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { HANDOFF_URGENCY } from '../enums/patient.js';
import ApiError from '../libs/ApiError.js';
import eventBus from '../events/eventBus.js';

/**
 * Front Desk Handoff Note (§5.3, PAT-006). Free text with a lightweight guardrail against
 * the categories the PRD explicitly prohibits — subjective labels, insults, gossip and
 * unverified diagnosis language. This is a best-effort filter, not a substitute for training.
 */
const PROHIBITED_PATTERNS = [
  /\b(stupid|crazy|liar|lying|drug seek(er|ing)|drama queen|fake)\b/i,
  /\b(diagnos(ed|is)( of| with)?)\b/i, // reception must not record diagnosis language
];

class HandoffService {
  constructor() {
    this.handoffRepository = new HandoffNoteRepository();
    this.auditService = new AuditService();
  }

  #assertCleanNote(note) {
    for (const pattern of PROHIBITED_PATTERNS) {
      if (pattern.test(note)) {
        throw ApiError.badRequest(
          'Handoff notes may not contain subjective labels, insults, gossip, or diagnosis language. Rephrase as an objective observation.',
          null,
          'HANDOFF_CONTENT_BLOCKED'
        );
      }
    }
  }

  async create(payload, actorId, req = null) {
    this.#assertCleanNote(payload.note);
    const note = await this.handoffRepository.create({ ...payload, authorId: actorId });

    await this.auditService.record(AUDIT_ACTIONS.HANDOFF_NOTE_CREATED, {
      actorId,
      metadata: { patientId: payload.patientId, category: payload.category, urgency: payload.urgency },
      req,
    });

    if (payload.urgency === HANDOFF_URGENCY.IMMEDIATE_TRIAGE_ALERT) {
      eventBus.emitDomain('HandoffImmediateTriageAlert', {
        patientId: payload.patientId,
        branchId: payload.branchId,
        assignedDoctorId: payload.assignedDoctorId,
        noteId: note._id.toString(),
      });
    }

    return note.toSafeObject();
  }

  async listForPatient(patientId) {
    const notes = await this.handoffRepository.findForPatient(patientId);
    return notes.map((n) => n.toSafeObject());
  }

  async listUnacknowledgedForDoctor(doctorId) {
    const notes = await this.handoffRepository.findUnacknowledgedForDoctor(doctorId);
    return notes.map((n) => n.toSafeObject());
  }

  async acknowledge(id, { resolutionNote } = {}, actorId, req = null) {
    const note = await this.handoffRepository.findById(id);
    if (!note) throw ApiError.notFound('Handoff note not found');
    note.acknowledgedBy = actorId;
    note.acknowledgedAt = new Date();
    if (resolutionNote) {
      note.resolutionNote = resolutionNote;
      note.resolvedAt = new Date();
    }
    await note.save();

    await this.auditService.record(AUDIT_ACTIONS.HANDOFF_NOTE_ACKNOWLEDGED, {
      actorId,
      metadata: { handoffNoteId: id },
      req,
    });
    return note.toSafeObject();
  }

  /** Amendment history — never silently overwrite the original text (§5.3 Integrity). */
  async amend(id, { text, reason }, actorId, req = null) {
    this.#assertCleanNote(text);
    const note = await this.handoffRepository.findById(id);
    if (!note) throw ApiError.notFound('Handoff note not found');
    note.amendments.push({ text: note.note, amendedBy: actorId, reason });
    note.note = text;
    await note.save();

    await this.auditService.record(AUDIT_ACTIONS.HANDOFF_NOTE_AMENDED, {
      actorId,
      metadata: { handoffNoteId: id, reason },
      req,
    });
    return note.toSafeObject();
  }
}

export default HandoffService;
