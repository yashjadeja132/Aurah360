import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import mongoose from 'mongoose';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import '../../src/models/index.js'; // registers every model so populate() paths resolve
import Branch from '../../src/models/Branch.model.js';
import Patient from '../../src/models/Patient.model.js';
import Invoice from '../../src/models/Invoice.model.js';
import Payment from '../../src/models/Payment.model.js';
import CreditNote from '../../src/models/CreditNote.model.js';
import AuditLog from '../../src/models/AuditLog.model.js';
import LoyaltyLedgerEntry from '../../src/models/LoyaltyLedgerEntry.model.js';
import LoyaltyBalanceCache from '../../src/models/LoyaltyBalanceCache.model.js';
import BillingService from '../../src/services/BillingService.js';
import LoyaltyLedgerService from '../../src/services/LoyaltyLedgerService.js';
import { PaymentRepository } from '../../src/repositories/BillingRepository.js';
import {
  CREDIT_NOTE_STATUS,
  DISCOUNT_TYPE,
  INVOICE_ITEM_TYPE,
  INVOICE_STATUS,
  PAYMENT_RECORD_STATUS,
  PAYMENT_STATUS,
} from '../../src/enums/billing.js';
import { LOYALTY_ENTRY_TYPE, LOYALTY_SOURCE_REF_TYPE } from '../../src/enums/loyalty.js';
import { AUDIT_ACTIONS } from '../../src/enums/auditAction.js';

/**
 * MON-001..004 — billing money integrity, against the real replica set.
 *
 * These fixes rest on transaction semantics, write conflicts, conditional updates and a unique
 * partial index. None of those exist in a mocked Mongo, so a unit test would assert the shape of
 * the code rather than the behaviour that actually protects the money.
 */
describe('Billing money integrity (real DB)', () => {
  const billing = new BillingService();
  const ledger = new LoyaltyLedgerService();
  const payments = new PaymentRepository();
  const actorId = new mongoose.Types.ObjectId();
  let branch;
  let patient;

  beforeAll(async () => {
    await connectTestDb('billmoney');
    // The unique partial (invoiceId, idempotencyKey) index IS the retry guarantee — syncIndexes
    // so a database carrying an older index shape is corrected rather than kept.
    await Payment.syncIndexes();
    await Invoice.init();
  }, 60_000);

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await Promise.all([
      Invoice.deleteMany({}),
      Payment.deleteMany({}),
      CreditNote.deleteMany({}),
      AuditLog.deleteMany({}),
      LoyaltyLedgerEntry.deleteMany({}),
      LoyaltyBalanceCache.deleteMany({}),
    ]);
    const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    branch = await Branch.create({
      name: 'Billing Money Branch',
      displayName: 'Billing Money Branch',
      branchCode: `BMN-${stamp}`,
      email: `billmoney-${stamp}@example.test`,
      phone: '9800000009',
      // GST off so every invoice total equals its subtotal: these tests are about settlement
      // arithmetic, not about tax, and a blended rate would only obscure the figures asserted.
      settings: { gstEnabled: false },
    });
    patient = await Patient.create({
      mrn: `MRN-BMN-${stamp}`,
      firstName: 'Bill',
      lastName: 'Money',
      gender: 'FEMALE',
      mobile: '9822222229',
      primaryBranchId: branch._id,
    });
  });

  /** A finalized invoice for exactly `total` rupees. */
  const finalizedInvoice = async (total = 1000, patientDoc = null) => {
    const draft = await billing.create(
      {
        patientId: (patientDoc || patient)._id.toString(),
        branchId: branch._id.toString(),
        items: [
          {
            itemType: INVOICE_ITEM_TYPE.SERVICE,
            description: 'Consultation',
            quantity: 1,
            unitPrice: total,
          },
        ],
        discountType: DISCOUNT_TYPE.FLAT,
        discountValue: 0,
      },
      actorId
    );
    expect(draft.total).toBe(total);
    return billing.finalize(draft.id, actorId);
  };

  const reload = (id) => Invoice.findById(id).lean();

  // ── DEFECT 1: recordPayment idempotency + concurrency ──────────────────────

  describe('recordPayment (MON-001)', () => {
    it('replays a retried payment on the same idempotencyKey instead of collecting twice', async () => {
      const invoice = await finalizedInvoice(1000);
      const key = 'retry-key-0001';

      const first = await billing.recordPayment(
        invoice.id,
        { amount: 1000, method: 'CASH', idempotencyKey: key },
        actorId
      );
      const replay = await billing.recordPayment(
        invoice.id,
        { amount: 1000, method: 'CASH', idempotencyKey: key },
        actorId
      );

      expect(await Payment.countDocuments({ invoiceId: invoice.id })).toBe(1);
      expect(first.paidAmount).toBe(1000);
      expect(replay.paidAmount).toBe(1000);
      expect(replay.balanceAmount).toBe(0);
      expect(replay.paymentStatus).toBe(PAYMENT_STATUS.PAID);
    });

    /**
     * THE concurrency test. Two cashiers (or one double-clicked button with no key) collecting
     * the full balance at the same instant: exactly one may land, and the invoice must never
     * record more than it is owed.
     */
    it('lets only one of two concurrent full-balance payments land, and never overpays', async () => {
      const invoice = await finalizedInvoice(1000);

      const results = await Promise.allSettled([
        billing.recordPayment(invoice.id, { amount: 1000, method: 'CASH' }, actorId),
        billing.recordPayment(invoice.id, { amount: 1000, method: 'CASH' }, actorId),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await Payment.countDocuments({ invoiceId: invoice.id })).toBe(1);

      const after = await reload(invoice.id);
      expect(after.paidAmount).toBe(1000);
      expect(after.balanceAmount).toBe(0);
      expect(after.paymentStatus).toBe(PAYMENT_STATUS.PAID);
      expect(await payments.sumRecordedForInvoice(after._id)).toBe(after.paidAmount);
    });

    it('never overpays under many concurrent partial payments', async () => {
      const invoice = await finalizedInvoice(1000);

      const results = await Promise.allSettled(
        Array.from({ length: 6 }, () =>
          billing.recordPayment(invoice.id, { amount: 400, method: 'CASH' }, actorId)
        )
      );

      // ₹1000 at ₹400 a time leaves room for at most two winners.
      const winners = results.filter((r) => r.status === 'fulfilled').length;
      expect(winners).toBeGreaterThan(0);
      expect(winners).toBeLessThanOrEqual(2);

      const landed = await Payment.countDocuments({ invoiceId: invoice.id });
      expect(landed).toBe(winners);

      const after = await reload(invoice.id);
      expect(after.paidAmount).toBe(winners * 400);
      expect(after.paidAmount).toBeLessThanOrEqual(after.total);
      expect(after.balanceAmount).toBe(1000 - winners * 400);
      expect(await payments.sumRecordedForInvoice(after._id)).toBe(after.paidAmount);
    });

    it('derives paidAmount from the payment rows rather than incrementing the stored figure', async () => {
      const invoice = await finalizedInvoice(1000);
      await billing.recordPayment(invoice.id, { amount: 400, method: 'CASH' }, actorId);

      // Simulate the damage a lost update leaves behind: the counter disagrees with the ledger.
      await Invoice.updateOne({ _id: invoice.id }, { $set: { paidAmount: 0, balanceAmount: 1000 } });

      const after = await billing.recordPayment(invoice.id, { amount: 600, method: 'CASH' }, actorId);

      // An incrementing implementation would report ₹600 here; deriving from the rows heals it.
      expect(after.paidAmount).toBe(1000);
      expect(after.balanceAmount).toBe(0);
      expect(after.paymentStatus).toBe(PAYMENT_STATUS.PAID);
    });

    it('rejects a payment that would overpay the invoice', async () => {
      const invoice = await finalizedInvoice(1000);
      await billing.recordPayment(invoice.id, { amount: 900, method: 'CASH' }, actorId);

      await expect(
        billing.recordPayment(invoice.id, { amount: 200, method: 'CASH' }, actorId)
      ).rejects.toThrow(/overpay/i);

      const after = await reload(invoice.id);
      expect(after.paidAmount).toBe(900);
      expect(await Payment.countDocuments({ invoiceId: invoice.id })).toBe(1);
    });
  });

  // ── DEFECT 2: cancelling a finalized invoice / writing off bad debt ────────

  describe('cancelFinalized and writeOff (MON-002)', () => {
    it('cancels a finalized invoice that carries no money, and audits it', async () => {
      const invoice = await finalizedInvoice(1000);

      const cancelled = await billing.cancelFinalized(
        invoice.id,
        { reason: 'BILLED_IN_ERROR', note: 'Raised against the wrong visit' },
        actorId
      );

      expect(cancelled.status).toBe(INVOICE_STATUS.CANCELLED);
      expect(cancelled.paymentStatus).toBe(PAYMENT_STATUS.CANCELLED);
      expect(cancelled.balanceAmount).toBe(0);
      expect(cancelled.cancelReason).toBe('BILLED_IN_ERROR');
      expect(cancelled.cancelledBy).toBe(actorId.toString());
      // Historical data stays intact: the issued figures are untouched.
      expect(cancelled.total).toBe(1000);
      expect(cancelled.invoiceNumber).toBe(invoice.invoiceNumber);
      expect(cancelled.timeline.some((t) => t.action === 'CANCELLED')).toBe(true);

      expect(
        await AuditLog.countDocuments({ action: AUDIT_ACTIONS.INVOICE_CANCELLED })
      ).toBe(1);
    });

    it('drops a cancelled invoice out of the dues worklist', async () => {
      const invoice = await finalizedInvoice(1000);
      const before = await billing.listDuePayments({ branchId: branch._id.toString() });
      expect(before.items.map((i) => i.id)).toContain(invoice.id);

      await billing.cancelFinalized(invoice.id, { reason: 'DUPLICATE_INVOICE' }, actorId);

      const after = await billing.listDuePayments({ branchId: branch._id.toString() });
      expect(after.items.map((i) => i.id)).not.toContain(invoice.id);
    });

    it('refuses to cancel a finalized invoice that money has been collected against', async () => {
      const invoice = await finalizedInvoice(1000);
      await billing.recordPayment(invoice.id, { amount: 500, method: 'CASH' }, actorId);

      await expect(
        billing.cancelFinalized(invoice.id, { reason: 'BILLED_IN_ERROR' }, actorId)
      ).rejects.toThrow(/refund/i);

      const after = await reload(invoice.id);
      expect(after.status).toBe(INVOICE_STATUS.FINALIZED);
    });

    it('demands a known reason, and a note when the reason is OTHER', async () => {
      const invoice = await finalizedInvoice(500);

      await expect(billing.cancelFinalized(invoice.id, {}, actorId)).rejects.toThrow(/reason/i);
      await expect(
        billing.cancelFinalized(invoice.id, { reason: 'BECAUSE' }, actorId)
      ).rejects.toThrow(/Unknown reason/i);
      await expect(
        billing.cancelFinalized(invoice.id, { reason: 'OTHER' }, actorId)
      ).rejects.toThrow(/note is required/i);

      const after = await reload(invoice.id);
      expect(after.status).toBe(INVOICE_STATUS.FINALIZED);
    });

    it('cannot be cancelled twice', async () => {
      const invoice = await finalizedInvoice(500);
      await billing.cancelFinalized(invoice.id, { reason: 'PRICING_ERROR' }, actorId);
      await expect(
        billing.cancelFinalized(invoice.id, { reason: 'PRICING_ERROR' }, actorId)
      ).rejects.toThrow(/already CANCELLED/i);
    });

    it('claws back loyalty points earned from a cancelled invoice with a counter-entry', async () => {
      const invoice = await finalizedInvoice(1000);
      await ledger.credit({
        branchId: branch._id,
        patientId: patient._id,
        points: 100,
        entryType: LOYALTY_ENTRY_TYPE.CREDIT,
        sourceRefType: LOYALTY_SOURCE_REF_TYPE.INVOICE,
        sourceRefId: new mongoose.Types.ObjectId(invoice.id),
        createdBy: actorId,
      });

      await billing.cancelFinalized(invoice.id, { reason: 'SERVICE_NOT_RENDERED' }, actorId);

      const clawbacks = await LoyaltyLedgerEntry.find({
        entryType: LOYALTY_ENTRY_TYPE.DEBIT_CLAWBACK,
        sourceRefId: new mongoose.Types.ObjectId(invoice.id),
      }).lean();
      expect(clawbacks.reduce((s, e) => s + e.points, 0)).toBe(100);
      // Append-only: the original CREDIT entry is still there, unedited.
      expect(
        await LoyaltyLedgerEntry.countDocuments({
          entryType: LOYALTY_ENTRY_TYPE.CREDIT,
          sourceRefId: new mongoose.Types.ObjectId(invoice.id),
        })
      ).toBe(1);
    });

    it('writes off the outstanding balance it derives itself, ignoring any client-supplied amount', async () => {
      const invoice = await finalizedInvoice(1000);
      await billing.recordPayment(invoice.id, { amount: 400, method: 'CASH' }, actorId);

      const written = await billing.writeOff(
        invoice.id,
        { reason: 'BAD_DEBT', note: 'Untraceable after three attempts', amount: 999999 },
        actorId
      );

      expect(written.writeOffAmount).toBe(600);
      expect(written.balanceAmount).toBe(0);
      expect(written.paymentStatus).toBe(PAYMENT_STATUS.WRITTEN_OFF);
      // No money was received, so collections must not move.
      expect(written.paidAmount).toBe(400);
      expect(written.total).toBe(1000);
      expect(written.writeOffReason).toBe('BAD_DEBT');
      expect(await AuditLog.countDocuments({ action: AUDIT_ACTIONS.INVOICE_WRITTEN_OFF })).toBe(1);
    });

    it('clears a written-off invoice from the dues worklist and refuses a second write-off', async () => {
      const invoice = await finalizedInvoice(1000);
      await billing.writeOff(invoice.id, { reason: 'SMALL_BALANCE' }, actorId);

      const due = await billing.listDuePayments({ branchId: branch._id.toString() });
      expect(due.items.map((i) => i.id)).not.toContain(invoice.id);

      await expect(
        billing.writeOff(invoice.id, { reason: 'SMALL_BALANCE' }, actorId)
      ).rejects.toThrow(/already been written off/i);
    });

    it('refuses to write off an invoice with nothing outstanding, or a draft', async () => {
      const paid = await finalizedInvoice(1000);
      await billing.recordPayment(paid.id, { amount: 1000, method: 'CASH' }, actorId);
      await expect(billing.writeOff(paid.id, { reason: 'BAD_DEBT' }, actorId)).rejects.toThrow(
        /no outstanding balance/i
      );

      const draft = await billing.create(
        {
          patientId: patient._id.toString(),
          branchId: branch._id.toString(),
          items: [
            { itemType: INVOICE_ITEM_TYPE.SERVICE, description: 'X', quantity: 1, unitPrice: 100 },
          ],
        },
        actorId
      );
      await expect(billing.writeOff(draft.id, { reason: 'BAD_DEBT' }, actorId)).rejects.toThrow(
        /finalized/i
      );
    });

    it('refuses to collect against a written-off balance', async () => {
      const invoice = await finalizedInvoice(1000);
      await billing.writeOff(invoice.id, { reason: 'BAD_DEBT' }, actorId);
      await expect(
        billing.recordPayment(invoice.id, { amount: 100, method: 'CASH' }, actorId)
      ).rejects.toThrow(/written off/i);
    });
  });

  // ── DEFECT 3: partial refunds must accumulate ─────────────────────────────

  describe('refund (MON-003)', () => {
    const paymentOf = async (invoiceId) =>
      Payment.findOne({ invoiceId, deletedAt: null }).sort({ createdAt: -1 });

    it('accumulates partial refunds and keeps the remainder refundable', async () => {
      const invoice = await finalizedInvoice(1000);
      await billing.recordPayment(invoice.id, { amount: 1000, method: 'CASH' }, actorId);
      const payment = await paymentOf(invoice.id);

      await billing.refund(payment._id.toString(), { amount: 100, reason: 'GOODWILL' }, actorId);
      let row = await Payment.findById(payment._id).lean();
      expect(row.refundedAmount).toBe(100);
      // Still RECORDED: ₹900 of this payment has not been returned.
      expect(row.status).toBe(PAYMENT_RECORD_STATUS.RECORDED);

      await billing.refund(payment._id.toString(), { amount: 200, reason: 'GOODWILL' }, actorId);
      row = await Payment.findById(payment._id).lean();
      // Accumulated, not overwritten — an overwriting implementation reports ₹200 here.
      expect(row.refundedAmount).toBe(300);
      expect(row.status).toBe(PAYMENT_RECORD_STATUS.RECORDED);

      const invoiceAfter = await reload(invoice.id);
      expect(invoiceAfter.paidAmount).toBe(700);
      expect(invoiceAfter.balanceAmount).toBe(300);

      // The remaining ₹700 is still refundable — the whole point of the defect.
      await billing.refund(payment._id.toString(), { amount: 700, reason: 'GOODWILL' }, actorId);
      row = await Payment.findById(payment._id).lean();
      expect(row.refundedAmount).toBe(1000);
      expect(row.status).toBe(PAYMENT_RECORD_STATUS.REFUNDED);
      expect((await reload(invoice.id)).paidAmount).toBe(0);

      await expect(
        billing.refund(payment._id.toString(), { amount: 1, reason: 'GOODWILL' }, actorId)
      ).rejects.toThrow(/already been refunded/i);
    });

    it('rejects a refund larger than what is still refundable', async () => {
      const invoice = await finalizedInvoice(1000);
      await billing.recordPayment(invoice.id, { amount: 1000, method: 'CASH' }, actorId);
      const payment = await paymentOf(invoice.id);

      await billing.refund(payment._id.toString(), { amount: 400, reason: 'GOODWILL' }, actorId);
      await expect(
        billing.refund(payment._id.toString(), { amount: 700, reason: 'GOODWILL' }, actorId)
      ).rejects.toThrow(/still refundable/i);

      const row = await Payment.findById(payment._id).lean();
      expect(row.refundedAmount).toBe(400);
    });

    it('refunds only the remaining balance when no amount is given', async () => {
      const invoice = await finalizedInvoice(1000);
      await billing.recordPayment(invoice.id, { amount: 1000, method: 'CASH' }, actorId);
      const payment = await paymentOf(invoice.id);

      await billing.refund(payment._id.toString(), { amount: 250, reason: 'GOODWILL' }, actorId);
      await billing.refund(payment._id.toString(), { reason: 'GOODWILL' }, actorId);

      const row = await Payment.findById(payment._id).lean();
      expect(row.refundedAmount).toBe(1000);
      expect(row.status).toBe(PAYMENT_RECORD_STATUS.REFUNDED);
    });
  });

  // ── DEFECT 4: credit notes are checked before they are spent ──────────────

  describe('applyCreditNote (MON-004)', () => {
    const issueCreditNote = async (overrides = {}) =>
      CreditNote.create({
        creditNoteNumber: `CN-${Date.now()}${Math.floor(Math.random() * 1000)}`,
        patientId: patient._id,
        branchId: branch._id,
        amount: 500,
        balance: 500,
        issuedBy: actorId,
        ...overrides,
      });

    it('applies a valid credit note, debits it and settles the invoice', async () => {
      const invoice = await finalizedInvoice(1000);
      const note = await issueCreditNote({ amount: 1000, balance: 1000 });

      const result = await billing.applyCreditNote(
        note._id.toString(),
        invoice.id,
        1000,
        actorId
      );

      expect(result.creditNote.balance).toBe(0);
      expect(result.creditNote.status).toBe(CREDIT_NOTE_STATUS.FULLY_USED);
      expect(result.invoice.paidAmount).toBe(1000);
      expect(result.invoice.balanceAmount).toBe(0);
      expect(result.invoice.paymentStatus).toBe(PAYMENT_STATUS.PAID);
      expect(result.invoice.creditApplied).toBe(1000);
    });

    it('rejects an expired credit note and marks it EXPIRED', async () => {
      const invoice = await finalizedInvoice(1000);
      const note = await issueCreditNote({ expiresAt: new Date(Date.now() - 86_400_000) });

      await expect(
        billing.applyCreditNote(note._id.toString(), invoice.id, 500, actorId)
      ).rejects.toThrow(/expired/i);

      expect((await CreditNote.findById(note._id).lean()).status).toBe(CREDIT_NOTE_STATUS.EXPIRED);
      expect((await reload(invoice.id)).paidAmount).toBe(0);
    });

    it('rejects a credit note that is not in a spendable state', async () => {
      const invoice = await finalizedInvoice(1000);
      const voided = await issueCreditNote({ status: CREDIT_NOTE_STATUS.VOID });
      const used = await issueCreditNote({ status: CREDIT_NOTE_STATUS.FULLY_USED, balance: 0 });

      await expect(
        billing.applyCreditNote(voided._id.toString(), invoice.id, 100, actorId)
      ).rejects.toThrow(/VOID credit note cannot be applied/i);
      await expect(
        billing.applyCreditNote(used._id.toString(), invoice.id, 100, actorId)
      ).rejects.toThrow(/FULLY_USED credit note cannot be applied/i);

      expect((await reload(invoice.id)).paidAmount).toBe(0);
    });

    it('refuses to settle a draft or cancelled invoice with a credit note', async () => {
      const note = await issueCreditNote();
      const draft = await billing.create(
        {
          patientId: patient._id.toString(),
          branchId: branch._id.toString(),
          items: [
            { itemType: INVOICE_ITEM_TYPE.SERVICE, description: 'X', quantity: 1, unitPrice: 900 },
          ],
        },
        actorId
      );
      await expect(
        billing.applyCreditNote(note._id.toString(), draft.id, 100, actorId)
      ).rejects.toThrow(/finalized/i);

      const cancelled = await finalizedInvoice(900);
      await billing.cancelFinalized(cancelled.id, { reason: 'BILLED_IN_ERROR' }, actorId);
      await expect(
        billing.applyCreditNote(note._id.toString(), cancelled.id, 100, actorId)
      ).rejects.toThrow(/CANCELLED invoice cannot be settled/i);

      expect((await CreditNote.findById(note._id).lean()).balance).toBe(500);
    });

    it('refuses an amount that would overpay the invoice', async () => {
      const invoice = await finalizedInvoice(300);
      const note = await issueCreditNote();

      await expect(
        billing.applyCreditNote(note._id.toString(), invoice.id, 500, actorId)
      ).rejects.toThrow(/outstanding balance/i);

      expect((await CreditNote.findById(note._id).lean()).balance).toBe(500);
      expect((await reload(invoice.id)).paidAmount).toBe(0);
    });

    it("refuses to spend a credit note on another patient's invoice", async () => {
      const other = await Patient.create({
        mrn: `MRN-OTH-${Date.now()}`,
        firstName: 'Other',
        lastName: 'Patient',
        gender: 'MALE',
        mobile: '9822222230',
        primaryBranchId: branch._id,
      });
      const invoice = await finalizedInvoice(1000, other);
      const note = await issueCreditNote();

      await expect(
        billing.applyCreditNote(note._id.toString(), invoice.id, 500, actorId)
      ).rejects.toThrow(/different patient/i);

      expect((await reload(invoice.id)).paidAmount).toBe(0);
    });

    it('keeps credit-note settlement intact when a later payment recomputes paidAmount', async () => {
      const invoice = await finalizedInvoice(1000);
      const note = await issueCreditNote({ amount: 400, balance: 400 });
      await billing.applyCreditNote(note._id.toString(), invoice.id, 400, actorId);

      const after = await billing.recordPayment(invoice.id, { amount: 600, method: 'CASH' }, actorId);

      // The ₹400 of credit must survive being re-derived from the payment ledger.
      expect(after.paidAmount).toBe(1000);
      expect(after.balanceAmount).toBe(0);
      expect(after.paymentStatus).toBe(PAYMENT_STATUS.PAID);
    });
  });
});
