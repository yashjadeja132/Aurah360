import ApiError from '../libs/ApiError.js';
import {
  DispenseRepository,
  InventoryItemRepository,
} from '../repositories/InventoryRepository.js';
import PrescriptionRepository from '../repositories/PrescriptionRepository.js';
import MedicineRepository from '../repositories/MedicineRepository.js';
import InventoryService from './InventoryService.js';
import AuditService from './AuditService.js';
import { eventBus } from '../events/eventBus.js';
import { emitQueueEvent, SOCKET_EVENTS } from '../socket/index.js';
import {
  generateDispenseNumber,
  generateDirectSaleNumber,
} from '../helpers/inventoryNumber.helper.js';
import {
  DISPENSE_ITEM_STATUS,
  DISPENSE_STATUS,
  INVENTORY_EVENTS,
  SALE_TYPE,
  STOCK_TX_TYPE,
} from '../enums/inventory.js';
import { PRESCRIPTION_STATUS } from '../enums/prescription.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { hasAnyPermission } from '../helpers/permission.helper.js';

class PharmacyService {
  constructor() {
    this.dispenseRepo = new DispenseRepository();
    this.itemRepo = new InventoryItemRepository();
    this.prescriptionRepo = new PrescriptionRepository();
    this.medicineRepo = new MedicineRepository();
    this.inventoryService = new InventoryService();
    this.auditService = new AuditService();
  }

  #mapDispense(doc) {
    if (!doc) return null;
    const extra = {};
    if (doc.patientId?.firstName) {
      extra.patient = {
        id: doc.patientId._id.toString(),
        mrn: doc.patientId.mrn,
        fullName: `${doc.patientId.firstName} ${doc.patientId.lastName || ''}`.trim(),
      };
      extra.patientId = doc.patientId._id.toString();
    }
    if (doc.pharmacistId?.firstName) {
      extra.pharmacist = {
        id: doc.pharmacistId._id.toString(),
        fullName: `${doc.pharmacistId.firstName} ${doc.pharmacistId.lastName || ''}`.trim(),
      };
      extra.pharmacistId = doc.pharmacistId._id.toString();
    }
    if (doc.prescriptionId?.prescriptionNumber) {
      extra.prescription = {
        id: doc.prescriptionId._id.toString(),
        prescriptionNumber: doc.prescriptionId.prescriptionNumber,
        status: doc.prescriptionId.status,
        items: doc.prescriptionId.items,
      };
      extra.prescriptionId = doc.prescriptionId._id.toString();
    }
    return doc.toSafeObject(extra);
  }

  async prescriptionQueue({ branchId, limit = 50 } = {}) {
    const prescriptions = await this.prescriptionRepo.findMany(
      {
        deletedAt: null,
        status: PRESCRIPTION_STATUS.FINALIZED,
        ...(branchId ? { branchId } : {}),
      },
      { sort: { finalizedAt: -1 }, limit: Number(limit) || 50 }
    );

    const result = [];
    for (const rx of prescriptions) {
      const active = await this.dispenseRepo.findActiveByPrescription(rx._id);
      const completed = await this.dispenseRepo.findOne({
        prescriptionId: rx._id,
        status: DISPENSE_STATUS.COMPLETED,
        deletedAt: null,
      });
      let dispenseStatus = 'READY';
      if (completed) dispenseStatus = 'DISPENSED';
      else if (active?.status === DISPENSE_STATUS.PARTIAL) dispenseStatus = 'PARTIAL';
      else if (active) dispenseStatus = 'IN_PROGRESS';

      if (dispenseStatus === 'DISPENSED') continue;

      result.push({
        prescriptionId: rx._id.toString(),
        prescriptionNumber: rx.prescriptionNumber,
        patientId: rx.patientId?.toString?.() || rx.patientId,
        branchId: rx.branchId?.toString?.() || rx.branchId,
        finalizedAt: rx.finalizedAt,
        itemCount: (rx.items || []).length,
        dispenseStatus,
        activeDispenseId: active?._id?.toString() || null,
      });
    }
    return { items: result };
  }

  async dashboard(branchId = null) {
    const queue = await this.prescriptionQueue({ branchId, limit: 100 });
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const dispensedToday = await this.dispenseRepo.count({
      deletedAt: null,
      status: DISPENSE_STATUS.COMPLETED,
      dispensedAt: { $gte: todayStart },
      ...(branchId ? { branchId } : {}),
    });
    const partial = await this.dispenseRepo.count({
      deletedAt: null,
      status: DISPENSE_STATUS.PARTIAL,
      ...(branchId ? { branchId } : {}),
    });
    // PHARM-GAP-2 — spec requires the pharmacy dashboard to also surface stock alerts
    // (low-stock, near-expiry/expired, pending GRN/transfers) so pharmacists don't need to
    // visit the separate Inventory hub. Reuse InventoryService.dashboard() rather than
    // duplicating its stock/expiry aggregation logic.
    const inventoryDashboard = await this.inventoryService.dashboard(branchId);
    const {
      lowStock,
      outOfStock,
      nearExpiryBatches,
      expiredBatches,
      pendingTransfers,
      pendingPurchaseOrders,
    } = inventoryDashboard.summary;
    return {
      summary: {
        queue: queue.items.length,
        dispensedToday,
        partial,
        lowStock,
        outOfStock,
        nearExpiryBatches,
        expiredBatches,
        pendingTransfers,
        pendingPurchaseOrders,
      },
      recentQueue: queue.items.slice(0, 10),
    };
  }

  /**
   * SEC-030 — a Dispense belongs to the branch that handed the medicine over, so it is scoped on
   * `branchId`. Out of scope answers NOT FOUND (never 403), so an enumerating caller learns
   * nothing about which dispense ids exist in other branches.
   */
  #assertDispenseInScope(doc, branchId) {
    if (!branchId || !doc) return doc;
    const docBranch = doc.branchId?._id || doc.branchId;
    if (String(docBranch) !== String(branchId)) {
      throw ApiError.notFound('Dispense not found');
    }
    return doc;
  }

  async getDispense(id, { branchId = null } = {}) {
    const doc = await this.dispenseRepo.findByIdPopulated(id);
    if (!doc) throw ApiError.notFound('Dispense not found');
    this.#assertDispenseInScope(doc, branchId);
    return this.#mapDispense(doc);
  }

  async listDispenses(query = {}) {
    const limit = Math.min(Number(query.limit) || 50, 100);
    const page = Math.max(Number(query.page) || 1, 1);
    const { items, total } = await this.dispenseRepo.list({
      branchId: query.branchId || null,
      status: query.status || null,
      patientId: query.patientId || null,
      saleType: query.saleType || null,
      limit,
      skip: (page - 1) * limit,
    });
    return {
      items: items.map((d) => this.#mapDispense(d)),
      meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async startDispense(payload, actorId, _req = null, { branchId = null } = {}) {
    const rx = await this.prescriptionRepo.findByIdNotDeleted(payload.prescriptionId);
    if (!rx) throw ApiError.notFound('Prescription not found');
    // The dispense will be booked against `payload.branchId || rx.branchId`; a branch-scoped
    // pharmacist may only ever book one against their own branch's stock.
    const targetBranch = payload.branchId || rx.branchId;
    if (branchId && String(targetBranch) !== String(branchId)) {
      throw ApiError.forbidden('branchId is outside your branch scope', 'BRANCH_SCOPE_VIOLATION');
    }
    if (rx.status !== PRESCRIPTION_STATUS.FINALIZED) {
      throw ApiError.forbidden('Only finalized prescriptions can be dispensed');
    }

    const existing = await this.dispenseRepo.findActiveByPrescription(rx._id);
    if (existing) return this.getDispense(existing._id.toString());

    const completed = await this.dispenseRepo.findOne({
      prescriptionId: rx._id,
      status: DISPENSE_STATUS.COMPLETED,
      deletedAt: null,
    });
    if (completed) throw ApiError.forbidden('Prescription already fully dispensed');

    const items = (rx.items || []).map((it, index) => ({
      prescriptionItemIndex: index,
      medicineId: it.medicineId || null,
      medicineName: it.medicineName,
      inventoryItemId: null,
      batchNumber: null,
      quantityRequested: Number(it.quantity) > 0 ? Number(it.quantity) : 1,
      quantityDispensed: 0,
      status: DISPENSE_ITEM_STATUS.PENDING,
      sellingPrice: 0,
    }));

    const doc = await this.dispenseRepo.create({
      dispenseNumber: await generateDispenseNumber(),
      prescriptionId: rx._id,
      patientId: rx.patientId,
      pharmacistId: actorId,
      branchId: payload.branchId || rx.branchId,
      items,
      status: DISPENSE_STATUS.PENDING,
      notes: payload.notes || null,
      createdBy: actorId,
      updatedBy: actorId,
    });

    return this.getDispense(doc._id.toString());
  }

  /**
   * Dispense items — full or partial.
   * items: [{ itemId|prescriptionItemIndex, inventoryItemId, batchNumber, quantity }]
   */
  async dispenseItems(id, payload, actorId, req = null, { branchId = null } = {}) {
    const dispense = await this.dispenseRepo.findById(id);
    if (!dispense || dispense.deletedAt) throw ApiError.notFound('Dispense not found');
    this.#assertDispenseInScope(dispense, branchId);
    if (dispense.status === DISPENSE_STATUS.COMPLETED) {
      throw ApiError.forbidden('Cannot edit completed dispense');
    }
    if (dispense.status === DISPENSE_STATUS.CANCELLED) {
      throw ApiError.forbidden('Dispense is cancelled');
    }

    const lines = Array.isArray(payload.items) ? payload.items : [];
    if (!lines.length) throw ApiError.badRequest('items are required');

    const updatedItems = [...(dispense.items || []).map((i) => i.toObject?.() || { ...i })];
    const substitutionsRecorded = [];

    for (const line of lines) {
      const idx =
        line.prescriptionItemIndex != null
          ? Number(line.prescriptionItemIndex)
          : updatedItems.findIndex((i) => String(i._id) === String(line.itemId));
      if (idx < 0 || !updatedItems[idx]) {
        throw ApiError.badRequest('Invalid dispense item');
      }
      const target = updatedItems[idx];
      const remaining = (target.quantityRequested || 0) - (target.quantityDispensed || 0);
      const qty = Number(line.quantity);
      if (!qty || qty <= 0) throw ApiError.badRequest('quantity must be positive');
      if (qty > remaining) {
        throw ApiError.forbidden(
          `Cannot dispense beyond remaining quantity for ${target.medicineName} (remaining ${remaining})`
        );
      }

      /**
       * PHARM-SUBST — substitution swaps WHICH inventory item/medicine backs this line, without
       * ever touching the signed Prescription document. Gated on PHARMACY_SUBSTITUTE (deliberately
       * outside the PHARMACY_ALL wildcard — see permissions.js) plus a mandatory reason, mirroring
       * PrescriptionSafetyService's override pattern.
       */
      const sub = line.substitution;
      let effectiveInventoryItemId = line.inventoryItemId || target.inventoryItemId;
      let substitutionRecord = null;
      if (sub?.isSubstituted) {
        if (!hasAnyPermission(req?.auth?.permissions || [], [PERMISSIONS.PHARMACY_SUBSTITUTE])) {
          throw ApiError.forbidden(
            'Substituting a different product requires PHARMACY_SUBSTITUTE authorization',
            'PHARMACY_SUBSTITUTION_NOT_AUTHORIZED'
          );
        }
        if (!sub.reason || !String(sub.reason).trim()) {
          throw ApiError.badRequest('A reason is required to record a substitution');
        }
        if (!sub.substitutedMedicineId) {
          throw ApiError.badRequest('substitutedMedicineId is required for a substitution');
        }
        const substituteMedicine = await this.medicineRepo.findByIdNotDeleted(
          sub.substitutedMedicineId
        );
        if (!substituteMedicine) throw ApiError.notFound('Substitute medicine not found');

        // The substitute product's OWN inventory item backs this line from here on — never the
        // originally-prescribed medicine's stock.
        const substituteItem = line.inventoryItemId
          ? await this.itemRepo.findByIdNotDeleted(line.inventoryItemId)
          : await this.itemRepo.findByMedicine(sub.substitutedMedicineId, dispense.branchId);
        if (!substituteItem) {
          throw ApiError.badRequest(
            `No inventory item for substitute medicine ${substituteMedicine.name} — select inventoryItemId`
          );
        }
        effectiveInventoryItemId = substituteItem._id;

        substitutionRecord = {
          isSubstituted: true,
          originalMedicineId: target.medicineId || null,
          originalMedicineName: target.medicineName,
          substitutedMedicineId: substituteMedicine._id,
          substitutedMedicineName: substituteMedicine.name,
          reason: String(sub.reason).trim(),
          authorizedBy: actorId,
          authorizedAt: new Date(),
        };
      }

      let inventoryItemId = effectiveInventoryItemId;
      if (!inventoryItemId && target.medicineId) {
        const linked = await this.itemRepo.findByMedicine(
          target.medicineId,
          dispense.branchId
        );
        inventoryItemId = linked?._id;
      }
      if (!inventoryItemId) {
        throw ApiError.badRequest(
          `No inventory item for ${target.medicineName} — select inventoryItemId`
        );
      }

      const item = await this.itemRepo.findByIdNotDeleted(inventoryItemId);
      if (!item) throw ApiError.notFound('Inventory item not found');

      const batchNumber =
        line.batchNumber ||
        this.inventoryService.selectBatch(item)?.batchNumber ||
        null;
      if (!batchNumber) {
        throw ApiError.forbidden(`No usable (non-expired) batch for ${item.name}`);
      }

      await this.inventoryService.deductStock({
        inventoryItemId,
        quantity: qty,
        batchNumber,
        type: STOCK_TX_TYPE.DISPENSE,
        referenceType: 'Dispense',
        referenceId: dispense._id,
        reason: `Dispense ${dispense.dispenseNumber}`,
        actorId,
        req,
      });

      target.inventoryItemId = inventoryItemId;
      target.batchNumber = batchNumber;
      target.quantityDispensed = (target.quantityDispensed || 0) + qty;
      target.sellingPrice = item.sellingPrice || item.mrp || 0;
      if (substitutionRecord) {
        target.substitution = substitutionRecord;
        substitutionsRecorded.push({
          itemIndex: idx,
          ...substitutionRecord,
          originalMedicineId: substitutionRecord.originalMedicineId
            ? substitutionRecord.originalMedicineId.toString()
            : null,
          substitutedMedicineId: substitutionRecord.substitutedMedicineId.toString(),
          authorizedBy: actorId,
        });
      }
      if (target.quantityDispensed >= target.quantityRequested) {
        target.status = DISPENSE_ITEM_STATUS.DISPENSED;
      } else if (target.quantityDispensed > 0) {
        target.status = DISPENSE_ITEM_STATUS.PARTIAL;
      }
    }

    const allDone = updatedItems.every(
      (i) => i.status === DISPENSE_ITEM_STATUS.DISPENSED
    );
    const anyDone = updatedItems.some((i) => (i.quantityDispensed || 0) > 0);
    const status = allDone
      ? DISPENSE_STATUS.COMPLETED
      : anyDone
        ? DISPENSE_STATUS.PARTIAL
        : DISPENSE_STATUS.PENDING;

    await this.dispenseRepo.updateById(id, {
      items: updatedItems,
      status,
      dispensedAt: allDone ? new Date() : dispense.dispensedAt,
      pharmacistId: actorId,
      updatedBy: actorId,
      notes: payload.notes ?? dispense.notes,
    });

    await this.auditService.record(AUDIT_ACTIONS.MEDICINE_DISPENSED, {
      actorId,
      metadata: {
        dispenseId: id,
        dispenseNumber: dispense.dispenseNumber,
        status,
        lines: lines.length,
      },
      req,
    });

    for (const sub of substitutionsRecorded) {
      await this.auditService.record(AUDIT_ACTIONS.MEDICINE_SUBSTITUTED, {
        actorId,
        metadata: {
          dispenseId: id,
          dispenseNumber: dispense.dispenseNumber,
          itemIndex: sub.itemIndex,
          originalMedicineId: sub.originalMedicineId,
          originalMedicineName: sub.originalMedicineName,
          substitutedMedicineId: sub.substitutedMedicineId,
          substitutedMedicineName: sub.substitutedMedicineName,
          reason: sub.reason,
        },
        req,
      });
    }

    const eventPayload = {
      dispenseId: id,
      dispenseNumber: dispense.dispenseNumber,
      prescriptionId: dispense.prescriptionId.toString(),
      patientId: dispense.patientId.toString(),
      status,
      branchId: dispense.branchId.toString(),
    };
    eventBus.emitDomain(INVENTORY_EVENTS.MEDICINE_DISPENSED, eventPayload);
    emitQueueEvent(SOCKET_EVENTS.MEDICINE_DISPENSED, eventPayload);

    return this.getDispense(id);
  }

  async cancelDispense(id, actorId, _req = null, { branchId = null } = {}) {
    const dispense = await this.dispenseRepo.findById(id);
    if (!dispense || dispense.deletedAt) throw ApiError.notFound('Dispense not found');
    this.#assertDispenseInScope(dispense, branchId);
    if (dispense.status === DISPENSE_STATUS.COMPLETED) {
      throw ApiError.forbidden('Cannot cancel completed dispense');
    }
    if ((dispense.items || []).some((i) => (i.quantityDispensed || 0) > 0)) {
      throw ApiError.forbidden('Cannot cancel after stock has been dispensed — use return');
    }
    await this.dispenseRepo.updateById(id, {
      status: DISPENSE_STATUS.CANCELLED,
      updatedBy: actorId,
    });
    return this.getDispense(id);
  }

  async dispenseReport(query = {}) {
    return this.listDispenses({ ...query, status: query.status || DISPENSE_STATUS.COMPLETED });
  }

  // --- Direct / retail sale (PHARM-DIRECT) -----------------------------------------------------
  // A counter sale with no prescription behind it. Reuses the Dispense model (saleType: DIRECT)
  // and — critically — the SAME InventoryService.deductStock()/FEFO/expiry-hard-stop path that
  // prescription dispensing uses, so neither path can drift out of sync with the other.

  /**
   * A product flagged `requiresPrescription: true` on its InventoryItem master can never leave
   * through the direct-sale counter — only through a signed, finalized prescription.
   */
  async createDirectSale(payload, actorId, req = null, { branchId = null } = {}) {
    const lines = Array.isArray(payload.items) ? payload.items : [];
    if (!lines.length) throw ApiError.badRequest('items are required');

    const targetBranch = payload.branchId || branchId;
    if (!targetBranch) throw ApiError.badRequest('branchId is required');
    if (branchId && String(targetBranch) !== String(branchId)) {
      throw ApiError.forbidden('branchId is outside your branch scope', 'BRANCH_SCOPE_VIOLATION');
    }

    const items = [];
    for (const [index, line] of lines.entries()) {
      const qty = Number(line.quantity);
      if (!qty || qty <= 0) throw ApiError.badRequest('quantity must be positive');
      if (!line.inventoryItemId) throw ApiError.badRequest('inventoryItemId is required');

      const item = await this.itemRepo.findByIdNotDeleted(line.inventoryItemId);
      if (!item) throw ApiError.notFound('Inventory item not found');
      this.#assertItemInScopeForSale(item, targetBranch);

      if (item.requiresPrescription) {
        throw ApiError.forbidden(
          `${item.name} requires a prescription and cannot be sold as a direct/retail sale`,
          'PRESCRIPTION_REQUIRED'
        );
      }

      // Same FEFO selection used by prescription dispensing — never duplicated here.
      const batchNumber =
        line.batchNumber || this.inventoryService.selectBatch(item)?.batchNumber || null;
      if (!batchNumber) {
        throw ApiError.forbidden(`No usable (non-expired) batch for ${item.name}`);
      }

      items.push({
        prescriptionItemIndex: index,
        medicineId: item.medicineId || null,
        medicineName: item.name,
        inventoryItemId: item._id,
        batchNumber,
        quantityRequested: qty,
        quantityDispensed: 0,
        status: DISPENSE_ITEM_STATUS.PENDING,
        sellingPrice: item.sellingPrice || item.mrp || 0,
      });
    }

    const doc = await this.dispenseRepo.create({
      dispenseNumber: await generateDirectSaleNumber(),
      saleType: SALE_TYPE.DIRECT,
      prescriptionId: null,
      patientId: payload.patientId || null,
      pharmacistId: actorId,
      branchId: targetBranch,
      items,
      status: DISPENSE_STATUS.PENDING,
      notes: payload.notes || null,
      createdBy: actorId,
      updatedBy: actorId,
    });

    // Same deductStock()/FEFO/expiry-hard-stop engine prescription dispensing uses — walked here
    // instead of via dispenseItems() because a direct sale is fulfilled in one shot at creation.
    const updatedItems = doc.items.map((i) => i.toObject());
    for (const target of updatedItems) {
      await this.inventoryService.deductStock({
        inventoryItemId: target.inventoryItemId,
        quantity: target.quantityRequested,
        batchNumber: target.batchNumber,
        type: STOCK_TX_TYPE.DISPENSE,
        referenceType: 'Dispense',
        referenceId: doc._id,
        reason: `Direct sale ${doc.dispenseNumber}`,
        actorId,
        req,
      });
      target.quantityDispensed = target.quantityRequested;
      target.status = DISPENSE_ITEM_STATUS.DISPENSED;
    }

    await this.dispenseRepo.updateById(doc._id, {
      items: updatedItems,
      status: DISPENSE_STATUS.COMPLETED,
      dispensedAt: new Date(),
    });

    await this.auditService.record(AUDIT_ACTIONS.DIRECT_SALE_CREATED, {
      actorId,
      metadata: {
        dispenseId: doc._id.toString(),
        dispenseNumber: doc.dispenseNumber,
        branchId: targetBranch.toString(),
        lines: items.length,
      },
      req,
    });

    // Same domain-event hook MEDICINE_DISPENSED gives billing today — a direct sale flows into
    // billing the same way, by emitting the equivalent event on the same bus.
    const eventPayload = {
      dispenseId: doc._id.toString(),
      dispenseNumber: doc.dispenseNumber,
      saleType: SALE_TYPE.DIRECT,
      patientId: doc.patientId ? doc.patientId.toString() : null,
      status: DISPENSE_STATUS.COMPLETED,
      branchId: doc.branchId.toString(),
    };
    eventBus.emitDomain(INVENTORY_EVENTS.DIRECT_SALE_CREATED, eventPayload);
    emitQueueEvent(SOCKET_EVENTS.MEDICINE_DISPENSED, eventPayload);

    return this.getDispense(doc._id.toString());
  }

  /** Same branch-scope-as-404 story as `#assertDispenseInScope` — reused for the item lookup a
   * direct sale does before it ever creates a Dispense row. */
  #assertItemInScopeForSale(item, branchId) {
    if (!branchId) return item;
    if (String(item.branchId) !== String(branchId)) {
      throw ApiError.notFound('Inventory item not found');
    }
    return item;
  }

  async listDirectSales(query = {}) {
    return this.listDispenses({ ...query, saleType: SALE_TYPE.DIRECT });
  }
}

export default PharmacyService;
