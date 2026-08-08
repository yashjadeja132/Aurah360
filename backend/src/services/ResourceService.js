import RoomRepository from '../repositories/RoomRepository.js';
import DeviceRepository from '../repositories/DeviceRepository.js';
import StaffSkillRepository from '../repositories/StaffSkillRepository.js';
import ApiError from '../libs/ApiError.js';
import AuditService from './AuditService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { RESOURCE_STATUS } from '../enums/resource.js';

/** Rooms, devices and staff-skills — the resource layer appointments/treatments reserve against. */
class ResourceService {
  constructor() {
    this.roomRepository = new RoomRepository();
    this.deviceRepository = new DeviceRepository();
    this.skillRepository = new StaffSkillRepository();
    this.auditService = new AuditService();
  }

  /**
   * SEC-030 — single-record branch gate. `branchId` is the caller's resolved scope, or null for
   * OWNER/ADMIN. A resource in another branch reads as NOT FOUND, never 403.
   */
  #assertInScope(doc, branchId, notFoundMessage) {
    if (!branchId || !doc) return doc;
    if (String(doc.branchId) !== String(branchId)) throw ApiError.notFound(notFoundMessage);
    return doc;
  }

  #assertWriteBranch(payloadBranchId, branchId) {
    if (payloadBranchId === undefined) return;
    if (branchId && String(payloadBranchId) !== String(branchId)) {
      throw ApiError.forbidden('branchId is outside your branch scope', 'BRANCH_SCOPE_VIOLATION');
    }
  }

  // --- Rooms -------------------------------------------------------------
  async listRooms(query = {}) {
    const filter = { deletedAt: null };
    if (query.branchId) filter.branchId = query.branchId;
    if (query.status) filter.status = query.status;
    if (query.isActive !== undefined) filter.isActive = query.isActive === 'true' || query.isActive === true;
    const rooms = await this.roomRepository.findManyNotDeleted(filter, { sort: { name: 1 } });
    return rooms.map((r) => r.toSafeObject());
  }

  async createRoom(payload, actorId, req = null, { branchId = null } = {}) {
    this.#assertWriteBranch(payload.branchId, branchId);
    const room = await this.roomRepository.create({ ...payload, createdBy: actorId });
    await this.auditService.record(AUDIT_ACTIONS.RESOURCE_CREATED, {
      actorId,
      metadata: { type: 'ROOM', roomId: room._id.toString() },
      req,
    });
    return room.toSafeObject();
  }

  async updateRoomStatus(id, { status, reason }, actorId, req = null, { branchId = null } = {}) {
    const room = await this.roomRepository.findByIdNotDeleted(id);
    if (!room) throw ApiError.notFound('Room not found');
    this.#assertInScope(room, branchId, 'Room not found');
    room.status = status;
    room.statusReason = reason || null;
    room.statusUpdatedAt = new Date();
    room.updatedBy = actorId;
    await room.save();
    await this.auditService.record(AUDIT_ACTIONS.RESOURCE_STATUS_CHANGED, {
      actorId,
      metadata: { type: 'ROOM', roomId: id, status },
      req,
    });
    return room.toSafeObject();
  }

  async updateRoom(id, payload, actorId, { branchId = null } = {}) {
    const room = await this.roomRepository.findByIdNotDeleted(id);
    if (!room) throw ApiError.notFound('Room not found');
    this.#assertInScope(room, branchId, 'Room not found');
    // ...and a scoped caller may not push the room OUT of their branch either.
    this.#assertWriteBranch(payload.branchId, branchId);
    Object.assign(room, payload, { updatedBy: actorId });
    await room.save();
    return room.toSafeObject();
  }

  /**
   * NOTE (scoped follow-up): this is a STATUS check only — "is this room in service" — not a
   * time-based availability check. It does not consider whether the room is already reserved for
   * an overlapping appointment or treatment session. See resolveRoomRef below and the
   * reservation follow-up noted on resolveDeviceRef.
   */
  async isRoomAvailable(roomId) {
    if (!roomId) return true;
    const room = await this.roomRepository.findByIdNotDeleted(roomId);
    if (!room || !room.isActive) return false;
    return room.status === RESOURCE_STATUS.AVAILABLE;
  }

  /**
   * RSC-001 — status gate + the room's booking policy in one call, so callers that reserve a room
   * get both "is it in service" and the `capacity` / `cleaningBufferMinutes` they must honour
   * without a second lookup. Throws for an out-of-service room; returns the Room document.
   */
  async assertRoomBookable(roomId) {
    if (!roomId) return null;
    const room = await this.roomRepository.findByIdNotDeleted(roomId);
    if (!room || !room.isActive || room.status !== RESOURCE_STATUS.AVAILABLE) {
      throw ApiError.conflict('Selected room is not in service', 'ROOM_UNAVAILABLE');
    }
    return room;
  }

  /**
   * TRT-003 — resolve a room reference from either a real ObjectId or the free-text room label
   * that older callers (and the treatment-session `roomId` field) still carry. Returns the Room
   * document or null when the label does not correspond to a managed resource.
   *
   * This is what makes the treatment-session ROOM hard stop able to fire at all: the gate keys
   * off `roomRef`, and before this existed nothing ever produced one.
   */
  async resolveRoom(roomIdOrName, branchId = null) {
    if (!roomIdOrName) return null;
    const raw = String(roomIdOrName).trim();
    if (!raw) return null;

    if (/^[a-f\d]{24}$/i.test(raw)) {
      const byId = await this.roomRepository.findByIdNotDeleted(raw);
      if (byId) return byId;
    }

    const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exact = new RegExp(`^${escaped}$`, 'i');
    const filter = { deletedAt: null, $or: [{ name: exact }, { code: exact }] };
    if (branchId) filter.branchId = branchId;
    const matches = await this.roomRepository.findMany(filter, { limit: 2 });
    // Ambiguous labels are treated as unresolved — guessing which room was meant would be worse
    // than surfacing it as unverifiable.
    return matches.length === 1 ? matches[0] : null;
  }

  // --- Devices -------------------------------------------------------------
  async listDevices(query = {}) {
    const filter = { deletedAt: null };
    if (query.branchId) filter.branchId = query.branchId;
    if (query.status) filter.status = query.status;
    if (query.capability) filter.capability = query.capability;
    const devices = await this.deviceRepository.findManyNotDeleted(filter, { sort: { name: 1 } });
    return devices.map((d) => d.toSafeObject());
  }

  async createDevice(payload, actorId, { branchId = null } = {}) {
    this.#assertWriteBranch(payload.branchId, branchId);
    const device = await this.deviceRepository.create({ ...payload, createdBy: actorId });
    return device.toSafeObject();
  }

  async updateDeviceStatus(id, { status, reason }, actorId, req = null, { branchId = null } = {}) {
    const device = await this.deviceRepository.findByIdNotDeleted(id);
    if (!device) throw ApiError.notFound('Device not found');
    this.#assertInScope(device, branchId, 'Device not found');
    device.status = status;
    device.statusReason = reason || null;
    device.statusUpdatedAt = new Date();
    if (status === RESOURCE_STATUS.MAINTENANCE) device.lastMaintenanceAt = new Date();
    device.updatedBy = actorId;
    await device.save();
    await this.auditService.record(AUDIT_ACTIONS.RESOURCE_STATUS_CHANGED, {
      actorId,
      metadata: { type: 'DEVICE', deviceId: id, status },
      req,
    });
    return device.toSafeObject();
  }

  async updateDevice(id, payload, actorId, { branchId = null } = {}) {
    const device = await this.deviceRepository.findByIdNotDeleted(id);
    if (!device) throw ApiError.notFound('Device not found');
    this.#assertInScope(device, branchId, 'Device not found');
    this.#assertWriteBranch(payload.branchId, branchId);
    Object.assign(device, payload, { updatedBy: actorId });
    await device.save();
    return device.toSafeObject();
  }

  /**
   * NOTE (scoped follow-up): status-only, exactly like isRoomAvailable. A device that is AVAILABLE
   * but already committed to an overlapping appointment or treatment session still reports true —
   * treatment sessions are not visible to AppointmentConflictService, so a device can currently be
   * double-booked across an appointment and a session. Closing that needs real time-boxed
   * reservations (a resource-reservation collection + a shared overlap checker), which is a larger
   * change than wiring these gates and is intentionally NOT attempted here.
   */
  async isDeviceAvailable(deviceId, at = new Date()) {
    if (!deviceId) return true;
    const device = await this.deviceRepository.findByIdNotDeleted(deviceId);
    if (!device || !device.isActive) return false;
    if (device.status !== RESOURCE_STATUS.AVAILABLE) return false;
    return !isMaintenanceOverdue(device, at);
  }

  /**
   * RSC-001 — device counterpart of assertRoomBookable, and the enforcement point for
   * `nextMaintenanceDueAt`.
   *
   * `at` is the moment the device would actually be USED (the appointment's start), not "now":
   * a device due for service next Friday must stay bookable for Thursday and stop being bookable
   * for the following Monday. An unset `nextMaintenanceDueAt` means "no maintenance schedule
   * configured" and never blocks anything.
   */
  async assertDeviceBookable(deviceId, at = new Date()) {
    if (!deviceId) return null;
    const device = await this.deviceRepository.findByIdNotDeleted(deviceId);
    if (!device || !device.isActive || device.status !== RESOURCE_STATUS.AVAILABLE) {
      throw ApiError.conflict('Selected device is not in service', 'DEVICE_UNAVAILABLE');
    }
    if (isMaintenanceOverdue(device, at)) {
      throw ApiError.conflict(
        `Device "${device.name}" is due for maintenance on `
          + `${device.nextMaintenanceDueAt.toISOString().slice(0, 10)} and cannot be booked for a `
          + 'later time — record the maintenance and update the device\'s nextMaintenanceDueAt, '
          + 'or book a different device',
        'DEVICE_MAINTENANCE_OVERDUE'
      );
    }
    return device;
  }

  /** TRT-003 — device counterpart of resolveRoom (id, code or name; also matches capability tags). */
  async resolveDevice(deviceIdOrName, branchId = null) {
    if (!deviceIdOrName) return null;
    const raw = String(deviceIdOrName).trim();
    if (!raw) return null;

    if (/^[a-f\d]{24}$/i.test(raw)) {
      const byId = await this.deviceRepository.findByIdNotDeleted(raw);
      if (byId) return byId;
    }

    const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exact = new RegExp(`^${escaped}$`, 'i');
    const filter = {
      deletedAt: null,
      $or: [{ name: exact }, { code: exact }, { serialNumber: exact }, { tags: exact }],
    };
    if (branchId) filter.branchId = branchId;
    const matches = await this.deviceRepository.findMany(filter, { limit: 2 });
    return matches.length === 1 ? matches[0] : null;
  }

  // --- Staff skills -------------------------------------------------------------
  /**
   * `StaffSkill.branchId` is NULLABLE and null means "valid at every branch" — that is exactly how
   * `StaffSkillRepository#findValidSkill` reads it (`$or: [{ branchId }, { branchId: null }]`).
   * A plain `branchId: mine` equality filter would therefore hide every organisation-wide
   * credential from the branch that actually relies on it, so the branch filter here matches the
   * enforcement semantics: my branch's grants PLUS the org-wide ones.
   */
  async listSkills(query = {}) {
    const filter = {};
    if (query.userId) filter.userId = query.userId;
    if (query.branchId) filter.$or = [{ branchId: query.branchId }, { branchId: null }];
    const skills = await this.skillRepository.findMany(filter, { sort: { createdAt: -1 } });
    return skills.map((s) => s.toSafeObject());
  }

  async grantSkill(payload, actorId, { branchId = null } = {}) {
    /**
     * A branch-scoped manager may grant a credential for their OWN branch only. Note that a null
     * `branchId` on a grant means "every branch" — issuing one is an organisation-wide act, so it
     * stays with OWNER/ADMIN rather than being the accidental default for a branch manager who
     * simply omitted the field.
     */
    if (branchId && String(payload.branchId ?? '') !== String(branchId)) {
      throw ApiError.forbidden(
        'A skill grant must name your own branchId — organisation-wide grants are '
          + 'restricted to administrators',
        'BRANCH_SCOPE_VIOLATION'
      );
    }
    // RSC-001 — a supervision-required grant with nobody to supervise is unenforceable by
    // construction, so it is rejected at configuration time rather than silently at booking time.
    if (payload.requiresSupervision) {
      if (!payload.supervisorId) {
        throw ApiError.badRequest(
          'A skill grant marked requiresSupervision must name a supervisorId',
          null,
          'SUPERVISOR_REQUIRED'
        );
      }
      if (String(payload.supervisorId) === String(payload.userId)) {
        throw ApiError.badRequest(
          'A supervised operator cannot be their own supervisor — name a different supervisorId',
          null,
          'SUPERVISOR_INVALID'
        );
      }
    }
    const skill = await this.skillRepository.create({ ...payload, createdBy: actorId });
    return skill.toSafeObject();
  }

  async revokeSkill(id, actorId, { branchId = null } = {}) {
    // Scope is checked BEFORE the write: `updateById` would otherwise have already suspended
    // another branch's credential by the time we noticed.
    if (branchId) {
      const existing = await this.skillRepository.findById(id);
      // An org-wide grant (branchId null) is not this branch's to revoke; 404, not 403.
      if (!existing || String(existing.branchId ?? '') !== String(branchId)) {
        throw ApiError.notFound('Skill grant not found');
      }
    }
    const skill = await this.skillRepository.updateById(id, { status: 'SUSPENDED', updatedBy: actorId });
    if (!skill) throw ApiError.notFound('Skill grant not found');
    return skill.toSafeObject();
  }

  /**
   * TRT-003 — validate a user is credentialed (and not expired) for a protocol skill,
   * optionally scoped to a branch. Throws ApiError.conflict with a HARD_STOP code on failure.
   */
  async assertOperatorSkilled(userId, skillCode, branchId = null, { supervisorUserId = null } = {}) {
    if (!skillCode) return true;
    const skill = await this.skillRepository.findValidSkill(userId, skillCode, branchId);
    if (!skill) {
      throw ApiError.conflict(
        `Operator is not credentialed for "${skillCode}"`,
        'OPERATOR_SKILL_MISSING'
      );
    }
    if (!skill.isValidNow()) {
      throw ApiError.conflict(
        `Operator's credential for "${skillCode}" has expired`,
        'OPERATOR_SKILL_EXPIRED'
      );
    }

    /**
     * RSC-001 — supervision. `requiresSupervision` defaults to false, so this whole branch is
     * inert for every ordinary grant: an unsupervised skill behaves exactly as before.
     *
     * When a grant IS marked supervision-required, the operator may only work under a named
     * supervisor — either one supplied by the caller for this specific piece of work, or the
     * standing `supervisorId` on the grant. The supervisor must themselves hold a currently-valid
     * grant for the same skill that is NOT itself supervision-required (a trainee cannot supervise
     * a trainee).
     */
    if (skill.requiresSupervision) {
      const supervisorId = supervisorUserId || skill.supervisorId;
      if (!supervisorId) {
        throw ApiError.conflict(
          `"${skillCode}" is granted to this operator under supervision, but no supervisor is `
            + 'assigned — set a supervisorId on the skill grant or assign a supervising operator',
          'OPERATOR_SUPERVISION_REQUIRED'
        );
      }
      if (String(supervisorId) === String(userId)) {
        throw ApiError.conflict(
          `"${skillCode}" requires supervision — the operator cannot supervise themselves; `
            + 'assign a different supervisor on the skill grant',
          'OPERATOR_SUPERVISOR_NOT_QUALIFIED'
        );
      }
      const supervisorSkill = await this.skillRepository.findValidSkill(
        supervisorId,
        skillCode,
        branchId
      );
      if (!supervisorSkill || !supervisorSkill.isValidNow() || supervisorSkill.requiresSupervision) {
        throw ApiError.conflict(
          `The assigned supervisor is not independently credentialed for "${skillCode}" — grant `
            + 'the supervisor an active, unsupervised credential for this skill or name a '
            + 'different supervisor',
          'OPERATOR_SUPERVISOR_NOT_QUALIFIED'
        );
      }
    }
    return true;
  }
}

/**
 * `nextMaintenanceDueAt` unset (the default) means no maintenance schedule is configured for this
 * device — explicitly NOT a restriction. Only a configured due date that has already passed by the
 * moment of use blocks.
 */
function isMaintenanceOverdue(device, at) {
  if (!device.nextMaintenanceDueAt) return false;
  const useMoment = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(useMoment.getTime())) return false;
  return device.nextMaintenanceDueAt.getTime() <= useMoment.getTime();
}

export default ResourceService;
