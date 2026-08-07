import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from '../integration/setup.js';
import '../../src/models/index.js'; // registers every schema (Invoice populates Doctor/Branch/etc.)
import Branch from '../../src/models/Branch.model.js';
import Patient from '../../src/models/Patient.model.js';
import BillingService from '../../src/services/BillingService.js';

/**
 * End-to-end clinic billing journey against a real database (replaces the RC1 "steps"-only
 * skeleton): create invoice → finalize → pay → refund with a credit note → apply the credit
 * note to a second invoice. Exercises BIL-001/002 together as a real workflow, not mocks.
 */
describe('Billing → refund → credit-note workflow (real DB)', () => {
  const billingService = new BillingService();
  const actorId = new mongoose.Types.ObjectId();
  let branch;
  let patient;

  beforeAll(async () => {
    await connectTestDb('billing-refund-workflow');
    branch = await Branch.create({
      name: 'Test Branch',
      branchCode: `TB${Date.now()}`,
      displayName: 'Test Branch',
      email: `branch-${Date.now()}@aurah360.local`,
      phone: '9990001111',
      settings: { taxPercent: 0, gstEnabled: false },
    });
    patient = await Patient.create({
      mrn: `MRN-BILL-${Date.now()}`,
      firstName: 'Billing',
      lastName: 'Journey',
      gender: 'OTHER',
      mobile: '9000000099',
      primaryBranchId: branch._id,
    });
  });

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  let invoiceId;
  let paymentId;

  it('creates and finalizes an invoice', async () => {
    const created = await billingService.create(
      {
        patientId: patient._id,
        branchId: branch._id,
        items: [{ type: 'CONSULTATION', description: 'Consultation', quantity: 1, unitPrice: 500 }],
      },
      actorId
    );
    invoiceId = created.id;
    expect(created.status).toBe('DRAFT');

    const finalized = await billingService.finalize(invoiceId, actorId);
    expect(finalized.status).toBe('FINALIZED');
  });

  it('records a full payment and marks the invoice paid', async () => {
    const result = await billingService.recordPayment(invoiceId, { amount: 500, method: 'CASH' }, actorId);
    expect(result.paymentStatus).toBe('PAID');
    const payments = await billingService.listPayments(invoiceId);
    expect(payments).toHaveLength(1);
    paymentId = payments[0].id;
  });

  it('refuses a refund with no reason', async () => {
    await expect(billingService.refund(paymentId, { amount: 500 }, actorId)).rejects.toThrow();
  });

  it('refunds via credit note and reduces the invoice balance', async () => {
    const { invoice, creditNote } = await billingService.refund(
      paymentId,
      { amount: 200, method: 'CREDIT_NOTE', reason: 'Patient requested partial refund' },
      actorId
    );
    expect(creditNote).not.toBeNull();
    expect(creditNote.amount).toBe(200);
    expect(invoice.paymentStatus).toBe('PARTIALLY_PAID');
  });

  it('applies the credit note to a second invoice', async () => {
    const second = await billingService.create(
      {
        patientId: patient._id,
        branchId: branch._id,
        items: [{ type: 'SERVICE', description: 'Follow-up', quantity: 1, unitPrice: 200 }],
      },
      actorId
    );
    await billingService.finalize(second.id, actorId);

    const payments = await billingService.listPayments(invoiceId);
    const creditNoteId = payments.find((p) => p.creditNoteId)?.creditNoteId;
    expect(creditNoteId).toBeTruthy();

    const applied = await billingService.applyCreditNote(creditNoteId, second.id, 200, actorId);
    expect(applied.creditNote.balance).toBe(0);
    expect(applied.invoice.paymentStatus).toBe('PAID');
  });
});
