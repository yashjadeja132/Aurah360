import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import mongoose from 'mongoose';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';

import Organization from '../../src/models/Organization.model.js';
import Branch from '../../src/models/Branch.model.js';
import Patient from '../../src/models/Patient.model.js';
import Invoice from '../../src/models/Invoice.model.js';
import InventoryItem from '../../src/models/InventoryItem.model.js';
import FeeSchedule from '../../src/models/FeeSchedule.model.js';
import Sequence from '../../src/models/Sequence.model.js';
import StockTransaction from '../../src/models/StockTransaction.model.js';
// Registered so InvoiceRepository.findByIdPopulated() can populate them.
import '../../src/models/Doctor.model.js';
import '../../src/models/User.model.js';
import '../../src/models/Consultation.model.js';
import '../../src/models/TreatmentPlan.model.js';
import '../../src/models/Appointment.model.js';

import BillingService from '../../src/services/BillingService.js';
import OrganizationService from '../../src/services/OrganizationService.js';
import BranchService from '../../src/services/BranchService.js';
import InventoryService from '../../src/services/InventoryService.js';
import { generateInvoiceNumber } from '../../src/helpers/invoiceNumber.helper.js';
import { priceInvoice, allocateByWeight, taxBreakdown } from '../../src/helpers/invoiceTax.helper.js';
import { clinicTimezone } from '../../src/utils/date.util.js';
import { parseReportFilters, financialYearRange } from '../../src/helpers/reportFilters.helper.js';
import { resetOrgRuntime } from '../../src/config/orgRuntime.js';
import { INVOICE_ITEM_TYPE, DISCOUNT_TYPE } from '../../src/enums/billing.js';
import { INVENTORY_ITEM_TYPE } from '../../src/enums/inventory.js';

/**
 * ORG/BILLING configuration that must actually enforce something.
 *
 * Every setting exercised here was previously modelled, validated, persisted and editable while
 * NO code path read it. Each test asserts the observable consequence of changing the setting —
 * not that the setting round-trips through the database.
 */
describe('Organization & billing configuration enforcement', () => {
  const billing = new BillingService();
  const organizationService = new OrganizationService();
  const branchService = new BranchService();

  let branchId;
  let patientId;
  let actorId;
  let seq = 0;

  beforeAll(async () => {
    await connectTestDb('orgbill');
  }, 60_000);

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await Promise.all([
      Organization.deleteMany({}),
      Branch.deleteMany({}),
      Patient.deleteMany({}),
      Invoice.deleteMany({}),
      InventoryItem.deleteMany({}),
      FeeSchedule.deleteMany({}),
      // Sequence is reset so the invoice-numbering tests start from a known counter; anything
      // numbered FROM a sequence must therefore be cleared too, or the restarted counter
      // collides with rows left by an earlier test.
      Sequence.deleteMany({}),
      StockTransaction.deleteMany({}),
    ]);
    resetOrgRuntime();
    seq += 1;
    actorId = new mongoose.Types.ObjectId();

    const branch = await Branch.create({
      name: `Branch ${seq}`,
      branchCode: `BR${seq}`,
      displayName: `Branch ${seq}`,
      email: `branch${seq}@test.local`,
      phone: '9999999999',
      settings: { taxPercent: 18, gstEnabled: true },
    });
    branchId = branch._id.toString();

    const patient = await Patient.create({
      patientId: `P${seq}`,
      mrn: `MRN${seq}`,
      firstName: 'Test',
      lastName: 'Patient',
      gender: 'FEMALE',
      mobile: '9888888888',
      primaryBranchId: branch._id,
    });
    patientId = patient._id.toString();
  });

  const org = (fields) => organizationService.update(fields, actorId);

  // ------------------------------------------------------------------
  // 1. Organization.invoicePrefix
  // ------------------------------------------------------------------
  describe('Organization.invoicePrefix', () => {
    it('numbers new invoices with the configured prefix instead of a hardcoded INV-', async () => {
      await org({ invoicePrefix: 'AUR' });
      expect(await generateInvoiceNumber()).toBe('AUR-000001');
      expect(await generateInvoiceNumber()).toBe('AUR-000002');
    });

    it('defaults to INV- and keeps the original counter, so existing history is untouched', async () => {
      // Simulate a database that already issued INV-000123 on the legacy counter.
      await Sequence.create({ key: 'invoice_number', value: 123 });
      expect(await generateInvoiceNumber()).toBe('INV-000124');
    });

    it('gives each prefix its own counter and never reuses a live number', async () => {
      await Sequence.create({ key: 'invoice_number', value: 500 });

      await org({ invoicePrefix: 'AUR' });
      const first = await generateInvoiceNumber();
      // A fresh series starts at 1 — but cannot collide, because the prefix differs.
      expect(first).toBe('AUR-000001');

      // Switching back resumes the legacy series where it left off rather than renumbering it.
      await org({ invoicePrefix: 'INV' });
      expect(await generateInvoiceNumber()).toBe('INV-000501');

      // And switching forward again resumes the AUR series.
      await org({ invoicePrefix: 'AUR' });
      expect(await generateInvoiceNumber()).toBe('AUR-000002');
    });

    it('does not renumber invoices that already exist', async () => {
      const before = await billing.create(
        { patientId, branchId, items: [{ itemType: INVOICE_ITEM_TYPE.SERVICE, description: 'X', unitPrice: 100 }] },
        actorId
      );
      expect(before.invoiceNumber).toBe('INV-000001');

      await org({ invoicePrefix: 'AUR' });

      const unchanged = await Invoice.findById(before.id).lean();
      expect(unchanged.invoiceNumber).toBe('INV-000001');

      const after = await billing.create(
        { patientId, branchId, items: [{ itemType: INVOICE_ITEM_TYPE.SERVICE, description: 'Y', unitPrice: 100 }] },
        actorId
      );
      expect(after.invoiceNumber).toBe('AUR-000001');
    });

    it('normalizes the prefix to upper case so numbering is stable', async () => {
      await org({ invoicePrefix: 'aur' });
      expect(await generateInvoiceNumber()).toBe('AUR-000001');
    });
  });

  // ------------------------------------------------------------------
  // 2. Organization.financialYearStartMonth
  // ------------------------------------------------------------------
  describe('Organization.financialYearStartMonth', () => {
    it('computes an April-start financial year for a date inside it', async () => {
      await org({ financialYearStartMonth: 4 });
      const fy = financialYearRange(new Date(2025, 6, 15)); // 15 Jul 2025
      expect(fy.from.getFullYear()).toBe(2025);
      expect(fy.from.getMonth()).toBe(3); // April
      expect(fy.from.getDate()).toBe(1);
      expect(fy.to.getFullYear()).toBe(2026);
      expect(fy.to.getMonth()).toBe(2); // March
      expect(fy.to.getDate()).toBe(31);
      expect(fy.label).toBe('FY2025-26');
    });

    it('puts a January date in the financial year that began the previous April', async () => {
      await org({ financialYearStartMonth: 4 });
      const fy = financialYearRange(new Date(2026, 0, 10)); // 10 Jan 2026
      expect(fy.from.getFullYear()).toBe(2025);
      expect(fy.to.getFullYear()).toBe(2026);
      expect(fy.label).toBe('FY2025-26');
    });

    it('actually follows the configured month rather than assuming April', async () => {
      await org({ financialYearStartMonth: 1 }); // calendar year
      const fy = financialYearRange(new Date(2025, 6, 15));
      expect(fy.from.getMonth()).toBe(0); // January
      expect(fy.to.getMonth()).toBe(11); // December
      expect(fy.to.getDate()).toBe(31);
    });

    it('drives the report date range for period=FY', async () => {
      await org({ financialYearStartMonth: 4 });
      const filters = parseReportFilters({ period: 'FY' });
      const expected = financialYearRange(new Date());
      expect(filters.dateFrom.getTime()).toBe(expected.from.getTime());
      expect(filters.dateTo.getTime()).toBe(expected.to.getTime());
      expect(filters.financialYearLabel).toBe(expected.label);
      // Not the 30-day rolling default it would otherwise have been.
      expect(filters.dateTo.getTime() - filters.dateFrom.getTime()).toBeGreaterThan(
        300 * 24 * 60 * 60 * 1000
      );
    });

    it('returns the preceding financial year for period=FY_PREV', async () => {
      await org({ financialYearStartMonth: 4 });
      const current = parseReportFilters({ period: 'FY' });
      const previous = parseReportFilters({ period: 'FY_PREV' });
      expect(previous.dateFrom.getFullYear()).toBe(current.dateFrom.getFullYear() - 1);
      expect(previous.dateTo.getTime()).toBeLessThan(current.dateFrom.getTime());
    });

    it('lets an explicit dateFrom/dateTo win over the named period', async () => {
      await org({ financialYearStartMonth: 4 });
      const filters = parseReportFilters({
        period: 'FY',
        dateFrom: '2025-05-01',
        dateTo: '2025-05-31',
      });
      expect(filters.dateFrom.getMonth()).toBe(4);
      expect(filters.dateTo.getDate()).toBe(31);
    });
  });

  // ------------------------------------------------------------------
  // 3. Organization.invoiceFooterNote
  // ------------------------------------------------------------------
  describe('Organization.invoiceFooterNote', () => {
    const makeInvoice = () =>
      billing.create(
        { patientId, branchId, items: [{ itemType: INVOICE_ITEM_TYPE.SERVICE, description: 'Consult', unitPrice: 1000 }] },
        actorId
      );

    it('appears on the invoice print payload', async () => {
      await org({ invoiceFooterNote: 'Subject to Surat jurisdiction.' });
      const invoice = await makeInvoice();
      const printData = await billing.getPrintData(invoice.id, actorId);
      expect(printData.footerNote).toBe('Subject to Surat jurisdiction.');
      expect(printData.printMeta.invoiceFooterNote).toBe('Subject to Surat jurisdiction.');
    });

    it('appears on the payment receipt print payload', async () => {
      await org({ invoiceFooterNote: 'Thank you for visiting.' });
      const invoice = await makeInvoice();
      await billing.finalize(invoice.id, actorId);
      await billing.recordPayment(invoice.id, { amount: 100, method: 'CASH' }, actorId);
      const [payment] = await billing.listPayments(invoice.id);
      const receipt = await billing.getPaymentReceipt(payment.id, actorId);
      expect(receipt.footerNote).toBe('Thank you for visiting.');
    });

    it('reflects an edit to the note without restarting anything', async () => {
      await org({ invoiceFooterNote: 'First note' });
      const invoice = await makeInvoice();
      expect((await billing.getPrintData(invoice.id, actorId)).footerNote).toBe('First note');

      await org({ invoiceFooterNote: 'Second note' });
      expect((await billing.getPrintData(invoice.id, actorId)).footerNote).toBe('Second note');
    });

    it('is null, not undefined, when the clinic configured no note', async () => {
      await org({ displayName: 'Aurah' });
      const invoice = await makeInvoice();
      expect((await billing.getPrintData(invoice.id, actorId)).footerNote).toBeNull();
    });
  });

  // ------------------------------------------------------------------
  // 4. Organization.timezone
  // ------------------------------------------------------------------
  describe('Organization.timezone', () => {
    it('makes the organization record beat the environment default', async () => {
      await org({ timezone: 'America/New_York' });
      expect(clinicTimezone()).toBe('America/New_York');
    });

    it('falls back to the environment default before the org record has been read', () => {
      resetOrgRuntime();
      expect(clinicTimezone()).toBe(process.env.CLINIC_DEFAULT_TIMEZONE || 'Asia/Kolkata');
    });

    it('picks the org value up again on the next organization read', async () => {
      await org({ timezone: 'Europe/London' });
      resetOrgRuntime();
      expect(clinicTimezone()).not.toBe('Europe/London'); // cache cleared
      await organizationService.get(); // any read re-primes it
      expect(clinicTimezone()).toBe('Europe/London');
    });

    it('keeps day-bucketing on the configured zone (existing IST behaviour preserved)', async () => {
      await org({ timezone: 'Asia/Kolkata' });
      const { dayBucket } = await import('../../src/utils/date.util.js');
      expect(dayBucket('$paidAt').$dateToString.timezone).toBe('Asia/Kolkata');
    });
  });

  // ------------------------------------------------------------------
  // 6. Organization.branchOverridableFields
  // ------------------------------------------------------------------
  describe('Organization.branchOverridableFields', () => {
    it('blocks a branch from overriding an org field that is not in the allowlist', async () => {
      await org({ branchOverridableFields: ['workingHours', 'notes'] });
      await expect(
        branchService.update(branchId, { timezone: 'Asia/Dubai' }, actorId)
      ).rejects.toThrow(/may not override organization-level timezone/i);
    });

    it('allows a branch to override a field that IS in the allowlist', async () => {
      await org({ branchOverridableFields: ['timezone', 'notes'] });
      const updated = await branchService.update(branchId, { timezone: 'Asia/Dubai' }, actorId);
      expect(updated.timezone).toBe('Asia/Dubai');
    });

    it('never blocks branch-identity fields, which shadow nothing on the organization', async () => {
      await org({ branchOverridableFields: [] });
      const updated = await branchService.update(
        branchId,
        { name: 'Renamed Branch', phone: '9111111111', city: 'Surat' },
        actorId
      );
      expect(updated.name).toBe('Renamed Branch');
      expect(updated.city).toBe('Surat');
    });

    it('gates the settings sub-document through updateSettings too', async () => {
      await org({ branchOverridableFields: ['notes'] });
      await expect(
        branchService.updateSettings(branchId, { taxPercent: 5 }, actorId)
      ).rejects.toThrow(/may not override organization-level settings/i);

      await org({ branchOverridableFields: ['settings'] });
      const updated = await branchService.updateSettings(branchId, { taxPercent: 5 }, actorId);
      expect(updated.settings.taxPercent).toBe(5);
    });

    it('reports the blocked field by name so the error is actionable', async () => {
      await org({ branchOverridableFields: ['settings'] });
      await expect(
        branchService.update(branchId, { logo: 'x.png' }, actorId)
      ).rejects.toThrow(/logo/);
    });
  });

  // ------------------------------------------------------------------
  // 7. PER-LINE GST — the money-correctness suite
  // ------------------------------------------------------------------
  describe('per-line GST', () => {
    /** A 5%-GST medicine in the item master. */
    const medicine = async (gstPercent = 5) =>
      InventoryItem.create({
        itemCode: `MED${seq}${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        name: 'Medicine',
        itemType: INVENTORY_ITEM_TYPE.MEDICINE ?? 'MEDICINE',
        branchId,
        gstPercent,
        hsnCode: '30049099',
      });

    /** An 18%-GST service via its effective fee schedule row. */
    const service = async (taxPercent = 18) => {
      const serviceId = new mongoose.Types.ObjectId();
      await FeeSchedule.create({
        serviceId,
        branchId,
        price: 1000,
        taxPercent,
        effectiveFrom: new Date(Date.now() - 86_400_000),
      });
      return serviceId;
    };

    const sumLineTax = (items) =>
      Math.round(items.reduce((s, i) => s + i.tax * 100, 0)) / 100;

    it('taxes a 5% medicine and an 18% service at their OWN rates on one invoice', async () => {
      const med = await medicine(5);
      const svcId = await service(18);

      const invoice = await billing.create(
        {
          patientId,
          branchId,
          items: [
            { itemType: INVOICE_ITEM_TYPE.MEDICINE, referenceId: med._id.toString(), description: 'Medicine', quantity: 2, unitPrice: 500 },
            { itemType: INVOICE_ITEM_TYPE.SERVICE, referenceId: svcId.toString(), description: 'Laser session', quantity: 1, unitPrice: 1000 },
          ],
        },
        actorId
      );

      const [medLine, svcLine] = invoice.items;

      // Medicine: 2 x 500 = 1000 @ 5% = 50.00
      expect(medLine.taxPercent).toBe(5);
      expect(medLine.taxableAmount).toBe(1000);
      expect(medLine.tax).toBe(50);
      expect(medLine.total).toBe(1050);
      expect(medLine.hsnCode).toBe('30049099');

      // Service: 1 x 1000 = 1000 @ 18% = 180.00
      expect(svcLine.taxPercent).toBe(18);
      expect(svcLine.taxableAmount).toBe(1000);
      expect(svcLine.tax).toBe(180);
      expect(svcLine.total).toBe(1180);

      // Invoice reconciles exactly.
      expect(invoice.subtotal).toBe(2000);
      expect(invoice.tax).toBe(230);
      expect(invoice.total).toBe(2230);
      expect(sumLineTax(invoice.items)).toBe(invoice.tax);
    });

    it('would have been wrong under one blended rate — the two lines differ', async () => {
      const med = await medicine(5);
      const svcId = await service(18);
      const invoice = await billing.create(
        {
          patientId,
          branchId,
          items: [
            { itemType: INVOICE_ITEM_TYPE.MEDICINE, referenceId: med._id.toString(), description: 'Medicine', unitPrice: 1000 },
            { itemType: INVOICE_ITEM_TYPE.SERVICE, referenceId: svcId.toString(), description: 'Service', unitPrice: 1000 },
          ],
        },
        actorId
      );
      // Equal-value lines, unequal tax. Under the old single-rate code both were 180.00.
      expect(invoice.items[0].tax).toBe(50);
      expect(invoice.items[1].tax).toBe(180);
      expect(invoice.items[0].tax).not.toBe(invoice.items[1].tax);
      expect(invoice.tax).toBe(230);
    });

    it('ignores a client-supplied per-line tax and taxPercent entirely', async () => {
      const med = await medicine(5);
      const invoice = await billing.create(
        {
          patientId,
          branchId,
          items: [
            {
              itemType: INVOICE_ITEM_TYPE.MEDICINE,
              referenceId: med._id.toString(),
              description: 'Medicine',
              unitPrice: 1000,
              tax: 0, // a caller trying to zero out GST
              taxPercent: 0,
              total: 1000,
            },
          ],
        },
        actorId
      );
      expect(invoice.items[0].taxPercent).toBe(5);
      expect(invoice.items[0].tax).toBe(50);
      expect(invoice.total).toBe(1050);
    });

    it('ignores a client-supplied header taxPercent', async () => {
      const invoice = await billing.create(
        {
          patientId,
          branchId,
          taxPercent: 0,
          items: [{ itemType: INVOICE_ITEM_TYPE.SERVICE, description: 'Ad-hoc', unitPrice: 1000 }],
        },
        actorId
      );
      // Falls back to the branch rate of 18%, not the caller's 0.
      expect(invoice.tax).toBe(180);
      expect(invoice.total).toBe(1180);
    });

    it('allocates a header discount across mixed rates and still reconciles to the paisa', async () => {
      const med = await medicine(5);
      const svcId = await service(18);
      const invoice = await billing.create(
        {
          patientId,
          branchId,
          discountType: DISCOUNT_TYPE.FLAT,
          discountValue: 333.33, // deliberately un-splittable
          discountReason: 'Goodwill',
          items: [
            { itemType: INVOICE_ITEM_TYPE.MEDICINE, referenceId: med._id.toString(), description: 'Medicine', unitPrice: 1000 },
            { itemType: INVOICE_ITEM_TYPE.SERVICE, referenceId: svcId.toString(), description: 'Service', unitPrice: 1000 },
          ],
        },
        actorId
      );

      const taxableSum =
        Math.round(invoice.items.reduce((s, i) => s + i.taxableAmount * 100, 0)) / 100;

      expect(invoice.subtotal).toBe(2000);
      expect(invoice.discount).toBe(333.33);
      // Every paisa of discount lands on some line: no rounding leak.
      expect(taxableSum).toBe(Math.round((2000 - 333.33) * 100) / 100);
      // Invoice tax is the exact sum of line taxes.
      expect(sumLineTax(invoice.items)).toBe(invoice.tax);
      expect(invoice.total).toBe(Math.round((taxableSum + invoice.tax) * 100) / 100);
    });

    it('applies the branch rate to ad-hoc lines that reference no master record', async () => {
      const invoice = await billing.create(
        { patientId, branchId, items: [{ itemType: INVOICE_ITEM_TYPE.SERVICE, description: 'Ad-hoc', unitPrice: 100 }] },
        actorId
      );
      expect(invoice.items[0].taxPercent).toBe(18);
      expect(invoice.items[0].tax).toBe(18);
    });

    it('charges zero GST on every line when the branch has GST disabled', async () => {
      await Branch.findByIdAndUpdate(branchId, { 'settings.gstEnabled': false });
      const med = await medicine(5);
      const invoice = await billing.create(
        {
          patientId,
          branchId,
          items: [{ itemType: INVOICE_ITEM_TYPE.MEDICINE, referenceId: med._id.toString(), description: 'Medicine', unitPrice: 1000 }],
        },
        actorId
      );
      expect(invoice.items[0].taxPercent).toBe(0);
      expect(invoice.tax).toBe(0);
      expect(invoice.total).toBe(1000);
    });

    it('persists the rate charged, so a later item-master change cannot alter the invoice', async () => {
      const med = await medicine(5);
      const invoice = await billing.create(
        {
          patientId,
          branchId,
          items: [{ itemType: INVOICE_ITEM_TYPE.MEDICINE, referenceId: med._id.toString(), description: 'Medicine', unitPrice: 1000 }],
        },
        actorId
      );
      expect(invoice.items[0].tax).toBe(50);

      await InventoryItem.findByIdAndUpdate(med._id, { gstPercent: 28 });

      const reread = await billing.getById(invoice.id);
      expect(reread.items[0].taxPercent).toBe(5);
      expect(reread.items[0].tax).toBe(50);
      expect(reread.total).toBe(1050);
    });

    it('exposes a per-rate GST breakdown that sums back to the invoice tax', async () => {
      const med = await medicine(5);
      const svcId = await service(18);
      const invoice = await billing.create(
        {
          patientId,
          branchId,
          items: [
            { itemType: INVOICE_ITEM_TYPE.MEDICINE, referenceId: med._id.toString(), description: 'Medicine', unitPrice: 1000 },
            { itemType: INVOICE_ITEM_TYPE.SERVICE, referenceId: svcId.toString(), description: 'Service', unitPrice: 2000 },
          ],
        },
        actorId
      );
      const printData = await billing.getPrintData(invoice.id, actorId);
      const rows = printData.taxBreakdown;
      expect(rows).toEqual([
        { taxPercent: 5, taxableAmount: 1000, tax: 50 },
        { taxPercent: 18, taxableAmount: 2000, tax: 360 },
      ]);
      expect(rows.reduce((s, r) => s + r.tax, 0)).toBe(invoice.tax);
    });

    it('re-rates lines when a draft is edited', async () => {
      const med = await medicine(5);
      const svcId = await service(18);
      const invoice = await billing.create(
        { patientId, branchId, items: [{ itemType: INVOICE_ITEM_TYPE.SERVICE, referenceId: svcId.toString(), description: 'Service', unitPrice: 1000 }] },
        actorId
      );
      expect(invoice.tax).toBe(180);

      const edited = await billing.updateDraft(
        invoice.id,
        { items: [{ itemType: INVOICE_ITEM_TYPE.MEDICINE, referenceId: med._id.toString(), description: 'Medicine', unitPrice: 1000 }] },
        actorId
      );
      expect(edited.items[0].taxPercent).toBe(5);
      expect(edited.tax).toBe(50);
      expect(edited.total).toBe(1050);
    });

    // ---- pure-math properties (no database) ----

    it('rounds each line half-up, in paise', () => {
      // 333.33 @ 5% = 16.6665 -> 16.67
      const priced = priceInvoice([{ quantity: 1, unitPrice: 333.33, taxPercent: 5 }]);
      expect(priced.tax).toBe(16.67);
      expect(priced.total).toBe(350);
    });

    it('never creates or loses a paisa when allocating a discount', () => {
      for (const total of [1, 7, 99, 100, 3333, 100_000]) {
        const parts = allocateByWeight(total, [1, 1, 1]);
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
      }
    });

    it('puts an unallocatable discount somewhere rather than dropping it', () => {
      const parts = allocateByWeight(500, [0, 0]);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(500);
    });

    it('keeps sum(line tax) === invoice tax across many awkward splits', () => {
      const priced = priceInvoice(
        [
          { quantity: 3, unitPrice: 33.33, taxPercent: 5 },
          { quantity: 7, unitPrice: 14.29, taxPercent: 12 },
          { quantity: 1, unitPrice: 999.99, taxPercent: 18 },
        ],
        { discountType: 'PERCENTAGE', discountValue: 7.5 }
      );
      const lineTax = Math.round(priced.items.reduce((s, i) => s + i.tax * 100, 0)) / 100;
      const lineTaxable = Math.round(priced.items.reduce((s, i) => s + i.taxableAmount * 100, 0)) / 100;
      expect(lineTax).toBe(priced.tax);
      expect(lineTaxable).toBe(priced.taxableAmount);
      expect(priced.total).toBe(Math.round((lineTaxable + lineTax) * 100) / 100);
    });

    it('groups the GST breakdown by rate', () => {
      const priced = priceInvoice([
        { quantity: 1, unitPrice: 100, taxPercent: 5 },
        { quantity: 1, unitPrice: 100, taxPercent: 5 },
        { quantity: 1, unitPrice: 100, taxPercent: 18 },
      ]);
      expect(taxBreakdown(priced.items)).toEqual([
        { taxPercent: 5, taxableAmount: 200, tax: 10 },
        { taxPercent: 18, taxableAmount: 100, tax: 18 },
      ]);
    });

    it('never lets a discount push the taxable base below zero', () => {
      const priced = priceInvoice([{ quantity: 1, unitPrice: 100, taxPercent: 18 }], {
        discountType: 'FLAT',
        discountValue: 5000,
      });
      expect(priced.taxableAmount).toBe(0);
      expect(priced.tax).toBe(0);
      expect(priced.total).toBe(0);
    });
  });

  // ------------------------------------------------------------------
  // 8. InventoryItem.minimumStock / maximumStock
  // ------------------------------------------------------------------
  describe('InventoryItem stock thresholds', () => {
    const inventory = new InventoryService();

    const item = async (overrides = {}) =>
      inventory.createItem(
        {
          name: 'Consumable',
          branchId,
          itemType: INVENTORY_ITEM_TYPE.CONSUMABLE ?? 'CONSUMABLE',
          minimumStock: 5,
          reorderLevel: 20,
          maximumStock: 100,
          ...overrides,
        },
        actorId
      );

    it('rejects a receipt that would push stock above maximumStock', async () => {
      const created = await item();
      await expect(
        inventory.openingStock(
          { inventoryItemId: created.id, quantity: 150, batchNumber: 'B1' },
          actorId
        )
      ).rejects.toThrow(/maximum stock level of 100/i);
    });

    it('allows a receipt that lands exactly on maximumStock', async () => {
      const created = await item();
      const result = await inventory.openingStock(
        { inventoryItemId: created.id, quantity: 100, batchNumber: 'B1' },
        actorId
      );
      expect(result.item.currentStock).toBe(100);
    });

    it('treats maximumStock of 0 as "no ceiling configured"', async () => {
      const created = await item({ maximumStock: 0, reorderLevel: 20, minimumStock: 5 });
      const result = await inventory.openingStock(
        { inventoryItemId: created.id, quantity: 9999, batchNumber: 'B1' },
        actorId
      );
      expect(result.item.currentStock).toBe(9999);
    });

    it('marks an item at or below minimumStock as CRITICAL, not merely LOW', async () => {
      const created = await item({ minimumStock: 5, reorderLevel: 20 });
      await inventory.openingStock(
        { inventoryItemId: created.id, quantity: 4, batchNumber: 'B1' },
        actorId
      );
      const fetched = await inventory.getItem(created.id);
      expect(fetched.stockStatus).toBe('CRITICAL');
    });

    it('still reports LOW between minimumStock and reorderLevel', async () => {
      const created = await item({ minimumStock: 5, reorderLevel: 20 });
      await inventory.openingStock(
        { inventoryItemId: created.id, quantity: 15, batchNumber: 'B1' },
        actorId
      );
      const fetched = await inventory.getItem(created.id);
      expect(fetched.stockStatus).toBe('LOW');
    });

    it('rejects thresholds that cannot be ordered', async () => {
      await expect(item({ minimumStock: 50, reorderLevel: 20 })).rejects.toThrow(
        /minimumStock \(50\) cannot exceed reorderLevel \(20\)/i
      );
      await expect(item({ reorderLevel: 200, maximumStock: 100 })).rejects.toThrow(
        /reorderLevel \(200\) cannot exceed maximumStock \(100\)/i
      );
    });

    it('validates the post-edit thresholds, not just the supplied field', async () => {
      const created = await item({ minimumStock: 5, reorderLevel: 20, maximumStock: 100 });
      await expect(
        inventory.updateItem(created.id, { minimumStock: 50 }, actorId)
      ).rejects.toThrow(/cannot exceed reorderLevel/i);
    });
  });
});
