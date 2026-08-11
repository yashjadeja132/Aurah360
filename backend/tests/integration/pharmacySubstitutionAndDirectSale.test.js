import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import '../../src/models/index.js';
import Branch from '../../src/models/Branch.model.js';
import Patient from '../../src/models/Patient.model.js';
import Doctor from '../../src/models/Doctor.model.js';
import Medicine from '../../src/models/Medicine.model.js';
import InventoryItem from '../../src/models/InventoryItem.model.js';
import Consultation from '../../src/models/Consultation.model.js';
import Prescription from '../../src/models/Prescription.model.js';
import PharmacyService from '../../src/services/PharmacyService.js';
import { PERMISSIONS } from '../../src/constants/permissions.js';
import { AUDIT_ACTIONS } from '../../src/enums/auditAction.js';
import { PRESCRIPTION_STATUS } from '../../src/enums/prescription.js';
import { SALE_TYPE } from '../../src/enums/inventory.js';
import AuditLog from '../../src/models/AuditLog.model.js';

/**
 * PHARM-SUBST / PHARM-DIRECT
 *
 * Substitution: a pharmacist may fill a dispense line with a different product than the one on
 * the signed prescription, but only with PHARMACY_SUBSTITUTE authorization + a mandatory reason,
 * and the swap must be recorded on the DISPENSE record only — the signed Prescription document is
 * never touched.
 *
 * Direct sale: a retail/counter sale with no prescription behind it, wired through the same
 * InventoryService.deductStock()/FEFO/expiry-hard-stop engine prescription dispensing uses, and
 * hard-blocked for any product flagged `requiresPrescription: true`.
 */
describe('Pharmacy: substitution authorization and direct/retail sale', () => {
  const pharmacy = new PharmacyService();
  const doctorUserId = new mongoose.Types.ObjectId();
  const actorId = new mongoose.Types.ObjectId().toString();

  const authorizedPharmacist = { auth: { permissions: [PERMISSIONS.PHARMACY_SUBSTITUTE] } };
  const unauthorizedPharmacist = { auth: { permissions: [PERMISSIONS.PHARMACY_DISPENSE] } };

  let branch;
  let patient;
  let doctor;
  let prescribedMedicine;
  let substituteMedicine;
  let prescribedItem;
  let substituteItem;
  let otcItem;
  let rxOnlyItem;

  async function newConsultation() {
    return Consultation.create({
      consultationNumber: `CN-PHS-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      appointmentId: new mongoose.Types.ObjectId(),
      patientId: patient._id,
      doctorId: doctor._id,
      branchId: branch._id,
      status: 'IN_PROGRESS',
    });
  }

  async function newFinalizedPrescription(medicine) {
    const consultation = await newConsultation();
    return Prescription.create({
      prescriptionNumber: `RX-PHS-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      consultationId: consultation._id,
      patientId: patient._id,
      doctorId: doctor._id,
      branchId: branch._id,
      status: PRESCRIPTION_STATUS.FINALIZED,
      finalizedAt: new Date(),
      items: [
        {
          medicineId: medicine._id,
          medicineName: medicine.name,
          quantity: 10,
        },
      ],
    });
  }

  beforeAll(async () => {
    await connectTestDb('pharmsub');

    branch = await Branch.create({
      name: 'Pharm Sub Branch',
      displayName: 'Pharm Sub Branch',
      branchCode: 'PHS-1',
      email: 'phs1@pharmsub.test',
      phone: '9000000000',
    });

    patient = await Patient.create({
      mrn: `MRN-PHS-${Date.now()}`,
      firstName: 'Sub',
      lastName: 'Patient',
      gender: 'FEMALE',
      mobile: '9000000201',
      primaryBranchId: branch._id,
    });

    doctor = await Doctor.create({
      userId: doctorUserId,
      doctorCode: 'PHS-D',
      licenseNumber: 'LIC-PHS-D',
      registrationNumber: 'REG-PHS-D',
    });

    prescribedMedicine = await Medicine.create({
      medicineCode: `MED-PHS-A-${Date.now()}`,
      name: 'Amoxicillin 500mg',
    });
    substituteMedicine = await Medicine.create({
      medicineCode: `MED-PHS-B-${Date.now()}`,
      name: 'Amoxicillin 500mg (Generic)',
    });

    const futureExpiry = new Date();
    futureExpiry.setFullYear(futureExpiry.getFullYear() + 1);
    const pastExpiry = new Date();
    pastExpiry.setDate(pastExpiry.getDate() - 5);

    prescribedItem = await InventoryItem.create({
      itemCode: 'ITM-PHS-PRESCRIBED',
      name: 'Amoxicillin 500mg',
      itemType: 'MEDICINE',
      medicineId: prescribedMedicine._id,
      branchId: branch._id,
      currentStock: 0,
      minimumStock: 0,
      reorderLevel: 0,
      maximumStock: 1000,
      batches: [],
    });

    substituteItem = await InventoryItem.create({
      itemCode: 'ITM-PHS-SUBSTITUTE',
      name: 'Amoxicillin 500mg (Generic)',
      itemType: 'MEDICINE',
      medicineId: substituteMedicine._id,
      branchId: branch._id,
      currentStock: 20,
      minimumStock: 0,
      reorderLevel: 0,
      maximumStock: 1000,
      sellingPrice: 15,
      batches: [{ batchNumber: 'SUB-BATCH-1', expiryDate: futureExpiry, quantity: 20 }],
    });

    otcItem = await InventoryItem.create({
      itemCode: 'ITM-PHS-OTC',
      name: 'Paracetamol 500mg',
      itemType: 'MEDICINE',
      branchId: branch._id,
      currentStock: 5,
      minimumStock: 0,
      reorderLevel: 0,
      maximumStock: 1000,
      sellingPrice: 10,
      requiresPrescription: false,
      batches: [
        { batchNumber: 'OTC-EXPIRED', expiryDate: pastExpiry, quantity: 100 },
        { batchNumber: 'OTC-GOOD', expiryDate: futureExpiry, quantity: 5 },
      ],
    });

    rxOnlyItem = await InventoryItem.create({
      itemCode: 'ITM-PHS-RXONLY',
      name: 'Tramadol 50mg',
      itemType: 'MEDICINE',
      branchId: branch._id,
      currentStock: 30,
      minimumStock: 0,
      reorderLevel: 0,
      maximumStock: 1000,
      sellingPrice: 20,
      requiresPrescription: true,
      batches: [{ batchNumber: 'RX-BATCH-1', expiryDate: futureExpiry, quantity: 30 }],
    });
  });

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  // =====================================================================
  describe('substitution at dispense', () => {
    it('refuses a substitution from a caller without PHARMACY_SUBSTITUTE, even with a reason', async () => {
      const rx = await newFinalizedPrescription(prescribedMedicine);
      const dispense = await pharmacy.startDispense(
        { prescriptionId: rx._id.toString() },
        actorId,
        unauthorizedPharmacist
      );

      await expect(
        pharmacy.dispenseItems(
          dispense.id,
          {
            items: [
              {
                prescriptionItemIndex: 0,
                quantity: 5,
                substitution: {
                  isSubstituted: true,
                  substitutedMedicineId: substituteMedicine._id.toString(),
                  reason: 'Out of stock on the prescribed brand',
                },
              },
            ],
          },
          actorId,
          unauthorizedPharmacist
        )
      ).rejects.toMatchObject({ statusCode: 403, code: 'PHARMACY_SUBSTITUTION_NOT_AUTHORIZED' });

      const untouchedRx = await Prescription.findById(rx._id);
      expect(untouchedRx.items[0].medicineId.toString()).toBe(prescribedMedicine._id.toString());
    });

    it('refuses a substitution with no reason, even from an authorized caller', async () => {
      const rx = await newFinalizedPrescription(prescribedMedicine);
      const dispense = await pharmacy.startDispense(
        { prescriptionId: rx._id.toString() },
        actorId,
        authorizedPharmacist
      );

      await expect(
        pharmacy.dispenseItems(
          dispense.id,
          {
            items: [
              {
                prescriptionItemIndex: 0,
                quantity: 5,
                substitution: {
                  isSubstituted: true,
                  substitutedMedicineId: substituteMedicine._id.toString(),
                  reason: '   ',
                },
              },
            ],
          },
          actorId,
          authorizedPharmacist
        )
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('records an authorized substitution on the DISPENSE only, leaving the signed Rx untouched', async () => {
      const rx = await newFinalizedPrescription(prescribedMedicine);
      const rxSnapshotBefore = await Prescription.findById(rx._id).lean();

      const dispense = await pharmacy.startDispense(
        { prescriptionId: rx._id.toString() },
        actorId,
        authorizedPharmacist
      );

      const result = await pharmacy.dispenseItems(
        dispense.id,
        {
          items: [
            {
              prescriptionItemIndex: 0,
              quantity: 5,
              substitution: {
                isSubstituted: true,
                substitutedMedicineId: substituteMedicine._id.toString(),
                reason: 'Prescribed brand out of stock; generic equivalent substituted',
              },
            },
          ],
        },
        actorId,
        authorizedPharmacist
      );

      const line = result.items[0];
      expect(line.substitution.isSubstituted).toBe(true);
      expect(line.substitution.originalMedicineId).toBe(prescribedMedicine._id.toString());
      expect(line.substitution.substitutedMedicineId).toBe(substituteMedicine._id.toString());
      expect(line.substitution.reason).toMatch(/generic equivalent/i);
      // The substitute product's own stock was deducted, not the originally-prescribed item's.
      expect(line.inventoryItemId).toBe(substituteItem._id.toString());

      const untouchedRx = await Prescription.findById(rx._id).lean();
      expect(untouchedRx).toEqual(rxSnapshotBefore);

      const audit = await AuditLog.findOne({
        action: AUDIT_ACTIONS.MEDICINE_SUBSTITUTED,
        actorId,
        'metadata.dispenseId': dispense.id,
      });
      expect(audit).toBeTruthy();
      expect(audit.metadata.substitutedMedicineName).toBe(substituteMedicine.name);
    });
  });

  // =====================================================================
  describe('direct / retail sale', () => {
    it('blocks a direct sale of a product flagged requiresPrescription', async () => {
      await expect(
        pharmacy.createDirectSale(
          {
            branchId: branch._id.toString(),
            items: [{ inventoryItemId: rxOnlyItem._id.toString(), quantity: 1 }],
          },
          actorId,
          authorizedPharmacist
        )
      ).rejects.toMatchObject({ statusCode: 403, code: 'PRESCRIPTION_REQUIRED' });

      const untouched = await InventoryItem.findById(rxOnlyItem._id);
      expect(untouched.currentStock).toBe(30);
    });

    it('sells an OTC item and skips the expired batch (FEFO/expiry hard stop still applies)', async () => {
      const sale = await pharmacy.createDirectSale(
        {
          branchId: branch._id.toString(),
          items: [{ inventoryItemId: otcItem._id.toString(), quantity: 3 }],
        },
        actorId,
        authorizedPharmacist
      );

      expect(sale.saleType).toBe(SALE_TYPE.DIRECT);
      expect(sale.prescriptionId).toBeNull();
      expect(sale.status).toBe('COMPLETED');
      // The good, non-expired batch was used — never the expired one.
      expect(sale.items[0].batchNumber).toBe('OTC-GOOD');

      const refreshed = await InventoryItem.findById(otcItem._id);
      const expiredBatch = refreshed.batches.find((b) => b.batchNumber === 'OTC-EXPIRED');
      expect(expiredBatch.quantity).toBe(100); // never touched

      const audit = await AuditLog.findOne({
        action: AUDIT_ACTIONS.DIRECT_SALE_CREATED,
        actorId,
        'metadata.dispenseId': sale.id,
      });
      expect(audit).toBeTruthy();
    });

    it('refuses to sell past the expired batch even when no other stock is left', async () => {
      const expiredOnly = await InventoryItem.create({
        itemCode: 'ITM-PHS-EXPIREDONLY',
        name: 'Cough Syrup',
        itemType: 'MEDICINE',
        branchId: branch._id,
        currentStock: 10,
        minimumStock: 0,
        reorderLevel: 0,
        maximumStock: 1000,
        requiresPrescription: false,
        batches: [
          {
            batchNumber: 'EXPIRED-ONLY',
            expiryDate: new Date('2020-01-01'),
            quantity: 10,
          },
        ],
      });

      await expect(
        pharmacy.createDirectSale(
          {
            branchId: branch._id.toString(),
            items: [{ inventoryItemId: expiredOnly._id.toString(), quantity: 1 }],
          },
          actorId,
          authorizedPharmacist
        )
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });
});
