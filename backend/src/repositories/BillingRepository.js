import BaseRepository from './BaseRepository.js';
import Invoice from '../models/Invoice.model.js';
import Payment from '../models/Payment.model.js';

class InvoiceRepository extends BaseRepository {
  constructor() {
    super(Invoice);
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  async findByIdPopulated(id) {
    return this.model
      .findOne({ _id: id, deletedAt: null })
      .populate('patientId', 'mrn firstName lastName mobile email gender')
      .populate({
        path: 'doctorId',
        select: 'doctorCode specialization userId',
        populate: { path: 'userId', select: 'firstName lastName' },
      })
      .populate('branchId', 'name displayName branchCode address phone email settings currency')
      .populate('consultationId', 'consultationNumber status')
      .populate('treatmentPlanId', 'planNumber title status packageSnapshot')
      .populate('appointmentId', 'appointmentNumber status scheduledStart')
      .exec();
  }

  async list({
    branchId = null,
    patientId = null,
    status = null,
    paymentStatus = null,
    search = null,
    limit = 50,
    skip = 0,
  } = {}) {
    const filter = { deletedAt: null };
    if (branchId) filter.branchId = branchId;
    if (patientId) filter.patientId = patientId;
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (search) {
      filter.invoiceNumber = { $regex: search, $options: 'i' };
    }
    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }
}

class PaymentRepository extends BaseRepository {
  constructor() {
    super(Payment);
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  async findByInvoice(invoiceId) {
    return this.model
      .find({ invoiceId, deletedAt: null })
      .sort({ paidAt: -1 })
      .exec();
  }

  async sumRecordedForInvoice(invoiceId) {
    const rows = await this.model.aggregate([
      {
        $match: {
          invoiceId: typeof invoiceId === 'string' ? new (await import('mongoose')).default.Types.ObjectId(invoiceId) : invoiceId,
          deletedAt: null,
          status: 'RECORDED',
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return rows[0]?.total || 0;
  }
}

export { InvoiceRepository, PaymentRepository };
export default InvoiceRepository;
