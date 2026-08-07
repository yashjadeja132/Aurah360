import mongoose from 'mongoose';
import BaseRepository from './BaseRepository.js';
import QueueEntry from '../models/QueueEntry.model.js';
import { ACTIVE_QUEUE_STATUSES, QUEUE_STATUS } from '../enums/queue.js';

class QueueRepository extends BaseRepository {
  constructor() {
    super(QueueEntry);
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  async findByAppointment(appointmentId) {
    return this.model.findOne({ appointmentId, deletedAt: null }).exec();
  }

  async findTodayByBranch(branchId, date = new Date()) {
    const { start, end } = dayBounds(date);
    return this.model
      .find({
        branchId,
        deletedAt: null,
        queueDate: { $gte: start, $lte: end },
      })
      .sort({ priorityWeight: 1, sortOrder: 1, arrivalTime: 1 })
      .exec();
  }

  async findDoctorQueue(doctorId, date = new Date(), { activeOnly = false } = {}) {
    const { start, end } = dayBounds(date);
    const filter = {
      doctorId,
      deletedAt: null,
      queueDate: { $gte: start, $lte: end },
    };
    if (activeOnly) filter.queueStatus = { $in: ACTIVE_QUEUE_STATUSES };
    return this.model
      .find(filter)
      .sort({ priorityWeight: 1, sortOrder: 1, arrivalTime: 1 })
      .exec();
  }

  async findNextWaiting(doctorId, date = new Date()) {
    const { start, end } = dayBounds(date);
    return this.model
      .findOne({
        doctorId,
        deletedAt: null,
        queueDate: { $gte: start, $lte: end },
        queueStatus: QUEUE_STATUS.WAITING,
      })
      .sort({ priorityWeight: 1, sortOrder: 1, arrivalTime: 1 })
      .exec();
  }

  async countByStatus(branchId, date = new Date()) {
    const { start, end } = dayBounds(date);
    const rows = await this.model.aggregate([
      {
        $match: {
          branchId: new mongoose.Types.ObjectId(String(branchId)),
          deletedAt: null,
          queueDate: { $gte: start, $lte: end },
        },
      },
      { $group: { _id: '$queueStatus', count: { $sum: 1 } } },
    ]);
    return Object.fromEntries(rows.map((r) => [r._id, r.count]));
  }

  async findByIdPopulated(id) {
    return this.model
      .findOne({ _id: id, deletedAt: null })
      .populate('patientId', 'mrn firstName lastName mobile isVip photo dateOfBirth')
      .populate({
        path: 'doctorId',
        select: 'doctorCode specialization userId',
        populate: { path: 'userId', select: 'firstName lastName' },
      })
      .populate('branchId', 'name displayName branchCode')
      .populate('appointmentId', 'appointmentNumber startTime endTime status appointmentDate source')
      .exec();
  }

  async maxSortOrder(doctorId, date = new Date()) {
    const { start, end } = dayBounds(date);
    const row = await this.model
      .findOne({
        doctorId,
        deletedAt: null,
        queueDate: { $gte: start, $lte: end },
      })
      .sort({ sortOrder: -1 })
      .select('sortOrder')
      .exec();
    return row?.sortOrder ?? 0;
  }
}

function dayBounds(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export default QueueRepository;
