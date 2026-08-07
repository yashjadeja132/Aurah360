/**
 * Module 11 seed — 50 invoices with pending / partial / paid mix.
 * Billing only — no treatment execution, inventory, or pharmacy.
 */
import Invoice from '../models/Invoice.model.js';
import Payment from '../models/Payment.model.js';
import Patient from '../models/Patient.model.js';
import Branch from '../models/Branch.model.js';
import Doctor from '../models/Doctor.model.js';
import TreatmentPlan from '../models/TreatmentPlan.model.js';
import Consultation from '../models/Consultation.model.js';
import {
  generateInvoiceNumber,
  generatePaymentNumber,
  generateReceiptNumber,
} from '../helpers/invoiceNumber.helper.js';
import {
  DISCOUNT_TYPE,
  INVOICE_ITEM_TYPE,
  INVOICE_STATUS,
  PAYMENT_METHOD,
  PAYMENT_RECORD_STATUS,
  PAYMENT_STATUS,
} from '../enums/billing.js';
import logger from '../libs/logger.js';

function round(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export async function seedModule11() {
  const existing = await Invoice.countDocuments({ deletedAt: null });
  if (existing >= 50) {
    logger.info('Module 11 invoices already seeded', { existing });
    return;
  }

  const patients = await Patient.find({ deletedAt: null }).limit(30).exec();
  const branches = await Branch.find({ deletedAt: null }).limit(5).exec();
  const doctors = await Doctor.find({ deletedAt: null }).limit(5).exec();
  const plans = await TreatmentPlan.find({ deletedAt: null }).limit(10).exec();
  const consultations = await Consultation.find({ deletedAt: null }).limit(10).exec();

  if (!patients.length || !branches.length) {
    logger.warn('Module 11 seed skipped — missing patients/branches');
    return;
  }

  const branch = branches[0];
  const taxPercent = branch.settings?.taxPercent ?? 18;
  const toCreate = 50 - existing;

  for (let i = 0; i < toCreate; i += 1) {
    const patient = patients[i % patients.length];
    const doctor = doctors.length ? doctors[i % doctors.length] : null;
    const plan = plans.length ? plans[i % plans.length] : null;
    const consultation = consultations.length ? consultations[i % consultations.length] : null;

    const usePackage = plan?.packageSnapshot?.packageName && i % 3 === 0;
    let items;
    let packageSnapshot = null;

    if (usePackage) {
      const price = Number(plan.packageSnapshot.packagePrice) || 10000;
      const discount = Number(plan.packageSnapshot.discount) || 0;
      packageSnapshot = {
        packageId: plan.packageSnapshot.packageId,
        packageName: plan.packageSnapshot.packageName,
        packagePrice: price,
        discount,
        validityDays: plan.packageSnapshot.validityDays,
        maximumSessions: plan.packageSnapshot.maximumSessions,
        unusedSessions: plan.packageSnapshot.unusedSessions,
      };
      items = [
        {
          itemType: INVOICE_ITEM_TYPE.PACKAGE,
          referenceId: packageSnapshot.packageId,
          description: packageSnapshot.packageName,
          quantity: 1,
          unitPrice: price,
          discount,
          tax: 0,
          total: Math.max(0, price - discount),
        },
      ];
    } else {
      const unitPrice = 500 + (i % 10) * 250;
      items = [
        {
          itemType: i % 2 === 0 ? INVOICE_ITEM_TYPE.CONSULTATION : INVOICE_ITEM_TYPE.SERVICE,
          description: i % 2 === 0 ? 'Consultation fee' : `Clinic service #${(i % 5) + 1}`,
          quantity: 1,
          unitPrice,
          discount: i % 7 === 0 ? 100 : 0,
          tax: 0,
          total: unitPrice,
        },
      ];
    }

    const subtotal = round(items.reduce((s, it) => s + it.quantity * it.unitPrice, 0));
    const itemDisc = round(items.reduce((s, it) => s + (it.discount || 0), 0));
    const discount = itemDisc;
    const taxable = Math.max(0, subtotal - discount);
    const tax = round((taxable * taxPercent) / 100);
    const total = round(taxable + tax);
    items = items.map((it) => {
      const line = it.quantity * it.unitPrice - (it.discount || 0);
      const share = taxable > 0 ? line / taxable : 0;
      const itemTax = round(tax * share);
      return { ...it, tax: itemTax, total: round(line + itemTax) };
    });

    // Mix: pending / partial / paid / draft
    const bucket = i % 5;
    let status = INVOICE_STATUS.FINALIZED;
    let paymentStatus = PAYMENT_STATUS.PENDING;
    let paidAmount = 0;

    if (bucket === 0) {
      status = INVOICE_STATUS.DRAFT;
      paymentStatus = PAYMENT_STATUS.PENDING;
    } else if (bucket === 1 || bucket === 2) {
      paymentStatus = PAYMENT_STATUS.PARTIALLY_PAID;
      paidAmount = round(total * 0.4);
    } else if (bucket === 3) {
      paymentStatus = PAYMENT_STATUS.PAID;
      paidAmount = total;
    } else {
      paymentStatus = PAYMENT_STATUS.PENDING;
      paidAmount = 0;
    }

    const balanceAmount = round(Math.max(0, total - paidAmount));

    const invoice = await Invoice.create({
      invoiceNumber: await generateInvoiceNumber(),
      invoiceDate: new Date(Date.now() - i * 86400000),
      patientId: patient._id,
      branchId: branch._id,
      doctorId: doctor?._id || null,
      consultationId: consultation?._id || null,
      treatmentPlanId: usePackage ? plan._id : null,
      status,
      paymentStatus,
      items,
      packageSnapshot,
      subtotal,
      discount,
      discountType: DISCOUNT_TYPE.FLAT,
      discountValue: 0,
      tax,
      taxPercent,
      gstPlaceholder: true,
      total,
      paidAmount,
      balanceAmount,
      notes: 'Seed invoice',
      finalizedAt: status === INVOICE_STATUS.FINALIZED ? new Date() : null,
      timeline: [
        { at: new Date(), action: 'CREATED', note: 'Seed created' },
        ...(status === INVOICE_STATUS.FINALIZED
          ? [{ at: new Date(), action: 'FINALIZED', note: 'Seed finalized' }]
          : []),
      ],
    });

    if (paidAmount > 0) {
      const methods = [
        PAYMENT_METHOD.CASH,
        PAYMENT_METHOD.UPI,
        PAYMENT_METHOD.CARD,
        PAYMENT_METHOD.BANK_TRANSFER,
      ];
      const method = methods[i % methods.length];
      if (paymentStatus === PAYMENT_STATUS.PARTIALLY_PAID && i % 2 === 0) {
        // Split partial
        const a1 = round(paidAmount / 2);
        const a2 = round(paidAmount - a1);
        await Payment.create({
          paymentNumber: await generatePaymentNumber(),
          receiptNumber: await generateReceiptNumber(),
          invoiceId: invoice._id,
          patientId: patient._id,
          branchId: branch._id,
          amount: paidAmount,
          method: PAYMENT_METHOD.SPLIT,
          splits: [
            { method: PAYMENT_METHOD.CASH, amount: a1 },
            { method: PAYMENT_METHOD.UPI, amount: a2 },
          ],
          isPartial: true,
          status: PAYMENT_RECORD_STATUS.RECORDED,
          paidAt: new Date(),
        });
      } else {
        await Payment.create({
          paymentNumber: await generatePaymentNumber(),
          receiptNumber: await generateReceiptNumber(),
          invoiceId: invoice._id,
          patientId: patient._id,
          branchId: branch._id,
          amount: paidAmount,
          method,
          isPartial: paymentStatus === PAYMENT_STATUS.PARTIALLY_PAID,
          status: PAYMENT_RECORD_STATUS.RECORDED,
          paidAt: new Date(),
        });
      }
    }
  }

  logger.info('Module 11 invoices seeded', { created: toCreate });
}

export default seedModule11;
