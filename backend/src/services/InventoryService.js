import ApiError from '../libs/ApiError.js';
import {
  InventoryItemRepository,
  StockTransactionRepository,
} from '../repositories/InventoryRepository.js';
import AuditService from './AuditService.js';
import { eventBus } from '../events/eventBus.js';
import { emitQueueEvent, SOCKET_EVENTS } from '../socket/index.js';
import {
  generateItemCode,
  generateStockTxNumber,
} from '../helpers/inventoryNumber.helper.js';
import {
  INVENTORY_EVENTS,
  INVENTORY_ITEM_TYPE,
  NEAR_EXPIRY_DAYS,
  STOCK_TX_TYPE,
} from '../enums/inventory.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import StockTransferRequest from '../models/StockTransferRequest.model.js';
import { getNextSequence } from '../models/Sequence.model.js';

/**
 * Generic inventory engine.
 * ALL stock mutations must go through this service.
 * StockTransaction records are immutable (create-only).
 */
class InventoryService {
  constructor() {
    this.itemRepo = new InventoryItemRepository();
    this.txRepo = new StockTransactionRepository();
    this.auditService = new AuditService();
  }

  #mapItem(doc) {
    return doc ? doc.toSafeObject() : null;
  }

  /**
   * SEC-030 (row scoping) — single-record gate for stock held BY a branch.
   *
   * `branchId` is the caller's resolved branch scope, or null for OWNER/ADMIN (unrestricted).
   * An item belonging to a different branch is reported as NOT FOUND, never 403: a 403 would
   * confirm to an enumerating caller that the id exists and tell them whose it is.
   */
  #assertItemInScope(item, branchId) {
    if (!branchId || !item) return item;
    if (String(item.branchId) !== String(branchId)) {
      throw ApiError.notFound('Inventory item not found');
    }
    return item;
  }

  /**
   * A stock transfer is inherently CROSS-branch: it has a source and a destination, and both
   * branches must be able to see and act on it (the destination has to receive what the source
   * dispatched). Scoping it to `fromBranchId === mine` would hide every INBOUND transfer from the
   * branch that is waiting for it — an outage, not a fix. A caller in scope is therefore one whose
   * branch is a PARTY to the transfer, on either end.
   */
  #assertTransferInScope(transfer, branchId) {
    if (!branchId || !transfer) return transfer;
    const parties = [transfer.fromBranchId, transfer.toBranchId].map((b) => String(b));
    if (!parties.includes(String(branchId))) {
      throw ApiError.notFound('Transfer request not found');
    }
    return transfer;
  }

  #round(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  #isExpired(expiryDate) {
    if (!expiryDate) return false;
    const end = new Date(expiryDate);
    end.setHours(23, 59, 59, 999);
    return end < new Date();
  }

  #isNearExpiry(expiryDate) {
    if (!expiryDate) return false;
    const limit = new Date();
    limit.setDate(limit.getDate() + NEAR_EXPIRY_DAYS);
    const exp = new Date(expiryDate);
    return exp <= limit && !this.#isExpired(expiryDate);
  }

  /**
   * `reorderLevel` and `minimumStock` are two different thresholds and both now fire.
   *
   *  - `reorderLevel` — "time to raise a purchase order". The normal, planned signal.
   *  - `minimumStock` — the safety floor. Dropping to or below it is not a reminder, it is a
   *    stockout risk on a clinic's consumables, so it is reported as CRITICAL.
   *
   * `minimumStock` previously had no read site at all: an item could sit below its configured
   * floor indefinitely without anyone being told, as long as it was above the reorder level.
   */
  async #emitLowStockIfNeeded(item) {
    const available = Math.max(0, (item.currentStock || 0) - (item.reservedStock || 0));
    const reorderLevel = item.reorderLevel || 0;
    const minimumStock = item.minimumStock || 0;
    if (available <= Math.max(reorderLevel, minimumStock)) {
      const payload = {
        inventoryItemId: item._id.toString(),
        itemCode: item.itemCode,
        name: item.name,
        currentStock: item.currentStock,
        reorderLevel,
        minimumStock,
        severity: available <= minimumStock ? 'CRITICAL' : 'LOW',
        branchId: item.branchId.toString(),
      };
      eventBus.emitDomain(INVENTORY_EVENTS.LOW_STOCK_DETECTED, payload);
      emitQueueEvent(SOCKET_EVENTS.LOW_STOCK_DETECTED, payload);
    }
  }

  async #emitNearExpiryIfNeeded(item, batchNumber, expiryDate) {
    if (!this.#isNearExpiry(expiryDate)) return;
    const payload = {
      inventoryItemId: item._id.toString(),
      itemCode: item.itemCode,
      name: item.name,
      batchNumber,
      expiryDate,
      branchId: item.branchId.toString(),
    };
    eventBus.emitDomain(INVENTORY_EVENTS.NEAR_EXPIRY_DETECTED, payload);
    emitQueueEvent(SOCKET_EVENTS.NEAR_EXPIRY_DETECTED, payload);
  }

  /**
   * Core mutation — updates item stock + appends immutable transaction.
   * quantityDelta: positive = inbound, negative = outbound
   */
  async #applyMovement({
    item,
    type,
    quantityDelta,
    batchNumber = null,
    expiryDate = null,
    unitCost = null,
    mrp = null,
    referenceType = null,
    referenceId = null,
    reason = null,
    notes = null,
    transferToBranchId = null,
    transferToItemId = null,
    actorId,
    allowCreateBatch = false,
    // Accepted for call-site symmetry with every other mutating method; this one records its audit
    // via the caller, so it has no use for the request itself.
    _req = null,
  }) {
    if (!quantityDelta || quantityDelta === 0) {
      throw ApiError.badRequest('quantity must be non-zero');
    }

    let batches = [...(item.batches || []).map((b) => b.toObject?.() || { ...b })];

    if (quantityDelta > 0) {
      if (batchNumber) {
        const existing = batches.find((b) => b.batchNumber === batchNumber);
        if (existing) {
          existing.quantity = (existing.quantity || 0) + quantityDelta;
          if (expiryDate) existing.expiryDate = expiryDate;
          if (unitCost != null) existing.purchasePrice = unitCost;
          if (mrp != null) existing.mrp = mrp;
        } else if (allowCreateBatch || type === STOCK_TX_TYPE.OPENING_STOCK || type === STOCK_TX_TYPE.PURCHASE || type === STOCK_TX_TYPE.RETURN) {
          batches.push({
            batchNumber,
            expiryDate: expiryDate || null,
            quantity: quantityDelta,
            purchasePrice: unitCost,
            mrp,
            receivedAt: new Date(),
          });
        } else {
          throw ApiError.badRequest(`Batch ${batchNumber} not found`);
        }
      }
    } else {
      const need = Math.abs(quantityDelta);
      if (batchNumber) {
        const batch = batches.find((b) => b.batchNumber === batchNumber);
        if (!batch) throw ApiError.badRequest(`Batch ${batchNumber} not found`);
        if (this.#isExpired(batch.expiryDate) && type !== STOCK_TX_TYPE.ADJUSTMENT) {
          throw ApiError.forbidden(`Cannot use expired batch ${batchNumber}`);
        }
        if ((batch.quantity || 0) < need) {
          throw ApiError.forbidden(
            `Insufficient batch stock for ${batchNumber} (have ${batch.quantity}, need ${need})`
          );
        }
        batch.quantity -= need;
      } else {
        // FEFO — earliest expiry first
        const usable = batches
          .filter((b) => (b.quantity || 0) > 0 && !this.#isExpired(b.expiryDate))
          .sort((a, b) => {
            if (!a.expiryDate) return 1;
            if (!b.expiryDate) return -1;
            return new Date(a.expiryDate) - new Date(b.expiryDate);
          });
        let remaining = need;
        for (const b of usable) {
          if (remaining <= 0) break;
          const take = Math.min(b.quantity, remaining);
          b.quantity -= take;
          remaining -= take;
          if (!batchNumber) batchNumber = b.batchNumber;
        }
        if (remaining > 0) {
          // Fall back to total stock without batch detail
          if ((item.currentStock || 0) < need) {
            throw ApiError.forbidden(
              `Insufficient stock for ${item.name} (have ${item.currentStock}, need ${need})`
            );
          }
        }
      }
    }

    const newStock = (item.currentStock || 0) + quantityDelta;
    if (newStock < 0) {
      throw ApiError.forbidden(
        `Insufficient stock for ${item.name} (have ${item.currentStock}, delta ${quantityDelta})`
      );
    }
    // `maximumStock` is the configured storage//holding ceiling. Enforced on every INCREASE
    // (receipt, return, transfer-in, opening stock) — this is the single choke point all stock
    // movements pass through. Previously the setting was persisted and read by nobody, so a
    // clinic could over-order expiring stock past its own stated limit without a word.
    // A `maximumStock` of 0 means "no ceiling configured".
    const maximumStock = item.maximumStock || 0;
    if (quantityDelta > 0 && maximumStock > 0 && newStock > maximumStock) {
      throw ApiError.forbidden(
        `Receiving ${quantityDelta} would take ${item.name} to ${newStock}, above its maximum `
          + `stock level of ${maximumStock} (currently ${item.currentStock || 0}).`
      );
    }

    batches = batches.filter((b) => (b.quantity || 0) > 0 || quantityDelta > 0);

    await this.itemRepo.updateById(item._id, {
      currentStock: newStock,
      batches,
      updatedBy: actorId,
      ...(unitCost != null && quantityDelta > 0 ? { purchasePrice: unitCost } : {}),
      ...(mrp != null && quantityDelta > 0 ? { mrp } : {}),
    });

    const tx = await this.txRepo.create({
      transactionNumber: await generateStockTxNumber(),
      type,
      inventoryItemId: item._id,
      branchId: item.branchId,
      batchNumber,
      quantity: quantityDelta,
      balanceAfter: newStock,
      unitCost,
      referenceType,
      referenceId,
      reason,
      notes,
      transferToBranchId,
      transferToItemId,
      createdBy: actorId,
    });

    const refreshed = await this.itemRepo.findByIdNotDeleted(item._id);
    await this.#emitLowStockIfNeeded(refreshed);
    if (expiryDate) await this.#emitNearExpiryIfNeeded(refreshed, batchNumber, expiryDate);

    return { item: refreshed, transaction: tx };
  }

  /**
   * The three stock thresholds have to be orderable for any of them to mean anything:
   * minimumStock (safety floor) <= reorderLevel (order trigger) <= maximumStock (ceiling).
   * A reorder level below the safety floor would alert only after the floor was breached; a
   * maximum below the reorder level makes the item impossible to restock.
   */
  #assertStockThresholds({ minimumStock, reorderLevel, maximumStock }) {
    const min = Number(minimumStock) || 0;
    const reorder = Number(reorderLevel) || 0;
    const max = Number(maximumStock) || 0;
    if (min > reorder) {
      throw ApiError.badRequest(
        `minimumStock (${min}) cannot exceed reorderLevel (${reorder}).`
      );
    }
    if (max > 0 && reorder > max) {
      throw ApiError.badRequest(
        `reorderLevel (${reorder}) cannot exceed maximumStock (${max}).`
      );
    }
  }

  async createItem(payload, actorId, { branchId = null } = {}) {
    if (!payload.name) throw ApiError.badRequest('name is required');
    if (!payload.branchId) throw ApiError.badRequest('branchId is required');
    // A write naming an explicit foreign branch is a 403, not a 404: nothing is being enumerated
    // here, the caller told us which branch they meant and it is outside their scope.
    if (branchId && String(payload.branchId) !== String(branchId)) {
      throw ApiError.forbidden('branchId is outside your branch scope', 'BRANCH_SCOPE_VIOLATION');
    }
    if (!payload.itemType) throw ApiError.badRequest('itemType is required');
    if (!Object.values(INVENTORY_ITEM_TYPE).includes(payload.itemType)) {
      throw ApiError.badRequest('Invalid itemType');
    }
    this.#assertStockThresholds({
      minimumStock: payload.minimumStock ?? 10,
      reorderLevel: payload.reorderLevel ?? 20,
      maximumStock: payload.maximumStock ?? 1000,
    });

    const item = await this.itemRepo.create({
      itemCode: await generateItemCode(),
      sku: payload.sku || null,
      barcode: payload.barcode || null,
      name: payload.name,
      itemType: payload.itemType,
      medicineId: payload.medicineId || null,
      branchId: payload.branchId,
      manufacturer: payload.manufacturer || null,
      category: payload.category || null,
      purchasePrice: payload.purchasePrice ?? 0,
      sellingPrice: payload.sellingPrice ?? 0,
      mrp: payload.mrp ?? 0,
      gstPercent: payload.gstPercent ?? 12,
      currentStock: 0,
      reservedStock: 0,
      minimumStock: payload.minimumStock ?? 10,
      maximumStock: payload.maximumStock ?? 1000,
      reorderLevel: payload.reorderLevel ?? 20,
      location: payload.location || null,
      unit: payload.unit || 'unit',
      batches: [],
      createdBy: actorId,
      updatedBy: actorId,
    });

    return this.#mapItem(item);
  }

  async updateItem(id, payload, actorId, { branchId = null } = {}) {
    const item = await this.itemRepo.findByIdNotDeleted(id);
    if (!item) throw ApiError.notFound('Inventory item not found');
    this.#assertItemInScope(item, branchId);

    const updates = { updatedBy: actorId };
    for (const f of [
      'sku',
      'barcode',
      'name',
      'manufacturer',
      'category',
      'purchasePrice',
      'sellingPrice',
      'mrp',
      'gstPercent',
      'minimumStock',
      'maximumStock',
      'reorderLevel',
      'location',
      'unit',
      'isActive',
    ]) {
      if (payload[f] !== undefined) updates[f] = payload[f];
    }
    // Validate the thresholds as they will be AFTER the edit, so changing one of the three
    // cannot quietly invert the ordering against the two that were left alone.
    this.#assertStockThresholds({
      minimumStock: updates.minimumStock ?? item.minimumStock,
      reorderLevel: updates.reorderLevel ?? item.reorderLevel,
      maximumStock: updates.maximumStock ?? item.maximumStock,
    });
    // Never allow direct currentStock / reservedStock / batches updates here
    await this.itemRepo.updateById(id, updates);
    return this.#mapItem(await this.itemRepo.findByIdNotDeleted(id));
  }

  async getItem(id, { branchId = null } = {}) {
    const item = await this.itemRepo.findByIdNotDeleted(id);
    if (!item) throw ApiError.notFound('Inventory item not found');
    this.#assertItemInScope(item, branchId);
    return this.#mapItem(item);
  }

  /**
   * Best-effort name lookup — used by callers (e.g. treatment session completion) that only
   * hold a free-text consumable name rather than an inventoryItemId. Exact, case-insensitive
   * match scoped to the branch; returns null (never throws) when nothing matches so callers
   * can decide whether an unmatched consumable should block anything.
   */
  async findItemByName(name, branchId) {
    if (!name || !branchId) return null;
    const escaped = String(name).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!escaped) return null;
    return this.itemRepo.model
      .findOne({
        name: new RegExp(`^${escaped}$`, 'i'),
        branchId,
        deletedAt: null,
      })
      .exec();
  }

  async listItems(query = {}) {
    const limit = Math.min(Number(query.limit) || 50, 200);
    const page = Math.max(Number(query.page) || 1, 1);
    const { items, total } = await this.itemRepo.list({
      branchId: query.branchId || null,
      itemType: query.itemType || null,
      q: query.q || null,
      lowStock: query.lowStock === 'true' || query.lowStock === true,
      outOfStock: query.outOfStock === 'true' || query.outOfStock === true,
      limit,
      skip: (page - 1) * limit,
    });
    return {
      items: items.map((i) => this.#mapItem(i)),
      meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async openingStock(payload, actorId, req = null, { branchId = null } = {}) {
    const item = await this.itemRepo.findByIdNotDeleted(payload.inventoryItemId);
    if (!item) throw ApiError.notFound('Inventory item not found');
    this.#assertItemInScope(item, branchId);
    if (!payload.quantity || payload.quantity <= 0) {
      throw ApiError.badRequest('quantity must be positive');
    }
    if (!payload.batchNumber) throw ApiError.badRequest('batchNumber is required');

    const { item: updated, transaction } = await this.#applyMovement({
      item,
      type: STOCK_TX_TYPE.OPENING_STOCK,
      quantityDelta: Number(payload.quantity),
      batchNumber: payload.batchNumber,
      expiryDate: payload.expiryDate ? new Date(payload.expiryDate) : null,
      unitCost: payload.unitCost ?? item.purchasePrice,
      mrp: payload.mrp ?? item.mrp,
      reason: payload.reason || 'Opening stock',
      notes: payload.notes || null,
      actorId,
      allowCreateBatch: true,
      req,
    });

    await this.auditService.record(AUDIT_ACTIONS.STOCK_ADJUSTED, {
      actorId,
      metadata: {
        type: STOCK_TX_TYPE.OPENING_STOCK,
        itemId: item._id.toString(),
        quantity: payload.quantity,
        tx: transaction.transactionNumber,
      },
      req,
    });

    return {
      item: this.#mapItem(updated),
      transaction: transaction.toSafeObject(),
    };
  }

  async adjust(payload, actorId, req = null, { branchId = null } = {}) {
    const item = await this.itemRepo.findByIdNotDeleted(payload.inventoryItemId);
    if (!item) throw ApiError.notFound('Inventory item not found');
    this.#assertItemInScope(item, branchId);
    const qty = Number(payload.quantity);
    if (!qty || qty === 0) throw ApiError.badRequest('quantity must be non-zero');

    const { item: updated, transaction } = await this.#applyMovement({
      item,
      type: STOCK_TX_TYPE.ADJUSTMENT,
      quantityDelta: qty,
      batchNumber: payload.batchNumber || null,
      expiryDate: payload.expiryDate ? new Date(payload.expiryDate) : null,
      reason: payload.reason || 'Stock adjustment',
      notes: payload.notes || null,
      actorId,
      allowCreateBatch: qty > 0,
      req,
    });

    const eventPayload = {
      inventoryItemId: item._id.toString(),
      quantity: qty,
      transactionNumber: transaction.transactionNumber,
      branchId: item.branchId.toString(),
    };
    eventBus.emitDomain(INVENTORY_EVENTS.STOCK_ADJUSTED, eventPayload);
    emitQueueEvent(SOCKET_EVENTS.STOCK_ADJUSTED, eventPayload);

    await this.auditService.record(AUDIT_ACTIONS.STOCK_ADJUSTED, {
      actorId,
      metadata: eventPayload,
      req,
    });

    return {
      item: this.#mapItem(updated),
      transaction: transaction.toSafeObject(),
    };
  }

  /**
   * Pharmacy / treatment outbound — deduct stock.
   * type: DISPENSE | CONSUMPTION | TRANSFER (outbound side)
   */
  async deductStock({
    inventoryItemId,
    quantity,
    batchNumber = null,
    type = STOCK_TX_TYPE.DISPENSE,
    referenceType = null,
    referenceId = null,
    reason = null,
    notes = null,
    actorId,
    req = null,
  }) {
    const item = await this.itemRepo.findByIdNotDeleted(inventoryItemId);
    if (!item) throw ApiError.notFound('Inventory item not found');
    const qty = Number(quantity);
    if (!qty || qty <= 0) throw ApiError.badRequest('quantity must be positive');

    const { item: updated, transaction } = await this.#applyMovement({
      item,
      type,
      quantityDelta: -qty,
      batchNumber,
      referenceType,
      referenceId,
      reason,
      notes,
      actorId,
      req,
    });

    return {
      item: this.#mapItem(updated),
      transaction: transaction.toSafeObject(),
      batchNumber: transaction.batchNumber,
    };
  }

  /**
   * Treatment session consumable consumption — same engine as pharmacy.
   * Does not modify TreatmentSession documents (caller owns that).
   */
  async consumeForTreatment({
    inventoryItemId,
    quantity,
    batchNumber = null,
    treatmentSessionId = null,
    actorId,
    req = null,
    scopeBranchId = null,
  }) {
    if (scopeBranchId) {
      const target = await this.itemRepo.findByIdNotDeleted(inventoryItemId);
      if (!target) throw ApiError.notFound('Inventory item not found');
      this.#assertItemInScope(target, scopeBranchId);
    }
    const result = await this.deductStock({
      inventoryItemId,
      quantity,
      batchNumber,
      type: STOCK_TX_TYPE.CONSUMPTION,
      referenceType: 'TreatmentSession',
      referenceId: treatmentSessionId,
      reason: 'Treatment consumable',
      actorId,
      req,
    });

    eventBus.emitDomain(INVENTORY_EVENTS.STOCK_CONSUMED, {
      inventoryItemId,
      quantity,
      treatmentSessionId,
      transactionNumber: result.transaction.transactionNumber,
    });

    return result;
  }

  async receivePurchase({
    inventoryItemId,
    quantity,
    batchNumber,
    expiryDate,
    unitCost = null,
    mrp = null,
    referenceId = null,
    notes = null,
    actorId,
    req = null,
  }) {
    const item = await this.itemRepo.findByIdNotDeleted(inventoryItemId);
    if (!item) throw ApiError.notFound('Inventory item not found');
    if (!batchNumber) throw ApiError.badRequest('batchNumber is required');
    if (!expiryDate) throw ApiError.badRequest('expiryDate is required');
    if (this.#isExpired(expiryDate)) {
      throw ApiError.badRequest('Cannot receive already-expired stock');
    }

    const { item: updated, transaction } = await this.#applyMovement({
      item,
      type: STOCK_TX_TYPE.PURCHASE,
      quantityDelta: Number(quantity),
      batchNumber,
      expiryDate: new Date(expiryDate),
      unitCost,
      mrp,
      referenceType: 'GoodsReceipt',
      referenceId,
      notes,
      actorId,
      allowCreateBatch: true,
      req,
    });

    return {
      item: this.#mapItem(updated),
      transaction: transaction.toSafeObject(),
    };
  }

  async returnStock(payload, actorId, req = null, { branchId = null } = {}) {
    const item = await this.itemRepo.findByIdNotDeleted(payload.inventoryItemId);
    if (!item) throw ApiError.notFound('Inventory item not found');
    this.#assertItemInScope(item, branchId);
    const qty = Number(payload.quantity);
    if (!qty || qty <= 0) throw ApiError.badRequest('quantity must be positive');

    const { item: updated, transaction } = await this.#applyMovement({
      item,
      type: STOCK_TX_TYPE.RETURN,
      quantityDelta: qty,
      batchNumber: payload.batchNumber || `RET-${Date.now()}`,
      expiryDate: payload.expiryDate ? new Date(payload.expiryDate) : null,
      reason: payload.reason || 'Stock return',
      notes: payload.notes || null,
      referenceType: payload.referenceType || null,
      referenceId: payload.referenceId || null,
      actorId,
      allowCreateBatch: true,
      req,
    });

    return {
      item: this.#mapItem(updated),
      transaction: transaction.toSafeObject(),
    };
  }

  async transfer(payload, actorId, req = null, { branchId = null } = {}) {
    const from = await this.itemRepo.findByIdNotDeleted(payload.fromItemId);
    if (!from) throw ApiError.notFound('Source inventory item not found');
    // The immediate (non-workflow) transfer DEDUCTS from the source, so the caller must own the
    // source branch. Pulling stock out of someone else's branch is not a read, it is a theft.
    if (branchId && String(from.branchId) !== String(branchId)) {
      throw ApiError.notFound('Source inventory item not found');
    }
    let to = payload.toItemId
      ? await this.itemRepo.findByIdNotDeleted(payload.toItemId)
      : null;
    if (!to && payload.toBranchId) {
      // Create mirror item on destination branch
      to = await this.itemRepo.create({
        itemCode: await generateItemCode(),
        sku: from.sku,
        name: from.name,
        itemType: from.itemType,
        medicineId: from.medicineId,
        branchId: payload.toBranchId,
        manufacturer: from.manufacturer,
        category: from.category,
        purchasePrice: from.purchasePrice,
        sellingPrice: from.sellingPrice,
        mrp: from.mrp,
        gstPercent: from.gstPercent,
        minimumStock: from.minimumStock,
        maximumStock: from.maximumStock,
        reorderLevel: from.reorderLevel,
        location: payload.toLocation || null,
        unit: from.unit,
        createdBy: actorId,
        updatedBy: actorId,
      });
    }
    if (!to) throw ApiError.badRequest('toItemId or toBranchId is required');

    const qty = Number(payload.quantity);
    if (!qty || qty <= 0) throw ApiError.badRequest('quantity must be positive');

    const out = await this.#applyMovement({
      item: from,
      type: STOCK_TX_TYPE.TRANSFER,
      quantityDelta: -qty,
      batchNumber: payload.batchNumber || null,
      reason: 'Transfer out',
      transferToBranchId: to.branchId,
      transferToItemId: to._id,
      actorId,
      req,
    });

    const batch = (from.batches || []).find((b) => b.batchNumber === (payload.batchNumber || out.transaction.batchNumber));
    await this.#applyMovement({
      item: to,
      type: STOCK_TX_TYPE.TRANSFER,
      quantityDelta: qty,
      batchNumber: payload.batchNumber || out.transaction.batchNumber || `TR-${Date.now()}`,
      expiryDate: batch?.expiryDate || payload.expiryDate || null,
      unitCost: from.purchasePrice,
      mrp: from.mrp,
      reason: 'Transfer in',
      transferToBranchId: null,
      transferToItemId: from._id,
      actorId,
      allowCreateBatch: true,
      req,
    });

    return {
      from: this.#mapItem(await this.itemRepo.findByIdNotDeleted(from._id)),
      to: this.#mapItem(await this.itemRepo.findByIdNotDeleted(to._id)),
      outTransaction: out.transaction.toSafeObject(),
    };
  }

  async stockCount(payload, actorId, req = null, { branchId = null } = {}) {
    const item = await this.itemRepo.findByIdNotDeleted(payload.inventoryItemId);
    if (!item) throw ApiError.notFound('Inventory item not found');
    this.#assertItemInScope(item, branchId);
    const counted = Number(payload.countedQuantity);
    if (Number.isNaN(counted) || counted < 0) {
      throw ApiError.badRequest('countedQuantity must be >= 0');
    }
    const delta = counted - (item.currentStock || 0);
    if (delta === 0) {
      return { item: this.#mapItem(item), transaction: null, delta: 0 };
    }
    return this.adjust(
      {
        inventoryItemId: item._id.toString(),
        quantity: delta,
        batchNumber: payload.batchNumber,
        reason: payload.reason || 'Stock count adjustment',
        notes: payload.notes,
      },
      actorId,
      req,
      { branchId }
    );
  }

  async ledger(query = {}) {
    const limit = Math.min(Number(query.limit) || 100, 500);
    const page = Math.max(Number(query.page) || 1, 1);
    const { items, total } = await this.txRepo.listLedger({
      inventoryItemId: query.inventoryItemId || null,
      branchId: query.branchId || null,
      type: query.type || null,
      limit,
      skip: (page - 1) * limit,
    });
    /**
     * Resolve item names in one query so the ledger can name the stock it moved.
     * Without this the only identifier on the row is `inventoryItemId`, and the UI had nothing to
     * render but the raw ObjectId — which is meaningless to a storekeeper reading the ledger.
     */
    const rows = items.map((t) => t.toSafeObject());
    const itemIds = [...new Set(rows.map((r) => r.inventoryItemId).filter(Boolean))];
    const nameById = new Map();
    if (itemIds.length) {
      const referenced = await this.itemRepo.findMany({ _id: { $in: itemIds } }, { lean: true });
      for (const item of referenced) {
        nameById.set(item._id.toString(), { name: item.name, sku: item.sku || null });
      }
    }

    return {
      items: rows.map((r) => {
        const item = nameById.get(r.inventoryItemId) || null;
        return { ...r, itemName: item?.name || null, itemSku: item?.sku || null };
      }),
      meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async dashboard(branchId = null) {
    const filter = { deletedAt: null };
    if (branchId) filter.branchId = branchId;

    const items = await this.itemRepo.findMany(filter, { lean: false });
    const now = new Date();
    const nearLimit = new Date();
    nearLimit.setDate(nearLimit.getDate() + NEAR_EXPIRY_DAYS);

    let lowStock = 0;
    let outOfStock = 0;
    let nearExpiryBatches = 0;
    let expiredBatches = 0;
    let totalValue = 0;

    for (const item of items) {
      const available = Math.max(0, (item.currentStock || 0) - (item.reservedStock || 0));
      if (available <= 0) outOfStock += 1;
      else if (available <= (item.reorderLevel || 0)) lowStock += 1;
      totalValue += (item.currentStock || 0) * (item.purchasePrice || 0);
      for (const b of item.batches || []) {
        if (!b.expiryDate || !(b.quantity > 0)) continue;
        const exp = new Date(b.expiryDate);
        if (exp < now) expiredBatches += 1;
        else if (exp <= nearLimit) nearExpiryBatches += 1;
      }
    }

    return {
      summary: {
        totalItems: items.length,
        lowStock,
        outOfStock,
        nearExpiryBatches,
        expiredBatches,
        totalValue: Math.round(totalValue * 100) / 100,
      },
    };
  }

  async reports(type, query = {}) {
    const branchId = query.branchId || null;
    if (type === 'ledger') return this.ledger(query);
    if (type === 'low-stock') {
      return this.listItems({ ...query, lowStock: true, branchId });
    }
    if (type === 'expiry' || type === 'near-expiry') {
      const { items } = await this.itemRepo.list({
        branchId,
        limit: 500,
        skip: 0,
      });
      const now = new Date();
      const nearLimit = new Date();
      nearLimit.setDate(nearLimit.getDate() + NEAR_EXPIRY_DAYS);
      const rows = [];
      for (const item of items) {
        for (const b of item.batches || []) {
          if (!b.expiryDate || !(b.quantity > 0)) continue;
          const exp = new Date(b.expiryDate);
          const expired = exp < now;
          const near = !expired && exp <= nearLimit;
          if (type === 'expiry' ? expired || near : near) {
            rows.push({
              inventoryItemId: item._id.toString(),
              itemCode: item.itemCode,
              name: item.name,
              batchNumber: b.batchNumber,
              expiryDate: b.expiryDate,
              quantity: b.quantity,
              status: expired ? 'EXPIRED' : 'NEAR_EXPIRY',
            });
          }
        }
      }
      rows.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
      return { items: rows };
    }
    throw ApiError.badRequest('Unknown report type');
  }

  /** Select a usable batch (FEFO) for UI helpers */
  selectBatch(item, preferredBatch = null) {
    if (!item) return null;
    if (preferredBatch) {
      const b = (item.batches || []).find(
        (x) => x.batchNumber === preferredBatch && x.quantity > 0 && !this.#isExpired(x.expiryDate)
      );
      if (b) return b;
    }
    const usable = (item.batches || [])
      .filter((b) => (b.quantity || 0) > 0 && !this.#isExpired(b.expiryDate))
      .sort((a, b) => {
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return new Date(a.expiryDate) - new Date(b.expiryDate);
      });
    return usable[0] || null;
  }

  // --- Branch transfer workflow (INV-002) -------------------------------------------------------------
  // Request → approve → dispatch → in transit → receive, both branches reconciling.
  // The immutable stock ledger is written only at dispatch (deduct source) and receive (add destination).

  async requestTransfer(payload, actorId, req = null, { branchId = null } = {}) {
    const from = await this.itemRepo.findByIdNotDeleted(payload.fromItemId);
    if (!from) throw ApiError.notFound('Source inventory item not found');
    // Either end may raise the request — a source branch pushing surplus out, or a destination
    // branch pulling stock in — so the caller need only be a party to it.
    // (A create, so an explicit 403 — there is no existing id to leak the existence of.)
    if (
      branchId
      && ![payload.fromBranchId, payload.toBranchId].map(String).includes(String(branchId))
    ) {
      throw ApiError.forbidden(
        'A transfer must involve your own branch as either source or destination',
        'BRANCH_SCOPE_VIOLATION'
      );
    }

    const seq = await getNextSequence('stock_transfer_number');
    const transfer = await StockTransferRequest.create({
      ...payload,
      transferNumber: `TRF-${String(seq).padStart(6, '0')}`,
      requestedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.STOCK_TRANSFER_REQUESTED, {
      actorId,
      metadata: { transferId: transfer._id.toString(), fromItemId: payload.fromItemId, quantity: payload.quantityRequested },
      req,
    });
    return transfer.toSafeObject();
  }

  async approveTransfer(id, actorId, req = null, { branchId = null } = {}) {
    const transfer = await StockTransferRequest.findById(id);
    if (!transfer) throw ApiError.notFound('Transfer request not found');
    this.#assertTransferInScope(transfer, branchId);
    if (transfer.status !== 'REQUESTED') throw ApiError.badRequest('Only a requested transfer can be approved');

    transfer.status = 'APPROVED';
    transfer.approvedBy = actorId;
    transfer.approvedAt = new Date();
    await transfer.save();

    await this.auditService.record(AUDIT_ACTIONS.STOCK_TRANSFER_APPROVED, {
      actorId,
      metadata: { transferId: id },
      req,
    });
    return transfer.toSafeObject();
  }

  async rejectTransfer(id, { reason }, actorId, _req = null, { branchId = null } = {}) {
    const transfer = await StockTransferRequest.findById(id);
    if (!transfer) throw ApiError.notFound('Transfer request not found');
    this.#assertTransferInScope(transfer, branchId);
    if (!['REQUESTED', 'APPROVED'].includes(transfer.status)) {
      throw ApiError.badRequest('Transfer cannot be rejected from its current status');
    }
    transfer.status = 'REJECTED';
    transfer.rejectionReason = reason || null;
    await transfer.save();
    return transfer.toSafeObject();
  }

  async dispatchTransfer(id, { quantityDispatched, batchNumber }, actorId, req = null, { branchId = null } = {}) {
    const transfer = await StockTransferRequest.findById(id);
    if (!transfer) throw ApiError.notFound('Transfer request not found');
    this.#assertTransferInScope(transfer, branchId);
    // Dispatch DEDUCTS from the source, so only the source branch (or a global role) may do it.
    if (branchId && String(transfer.fromBranchId) !== String(branchId)) {
      throw ApiError.forbidden(
        'Only the source branch can dispatch this transfer',
        'BRANCH_SCOPE_VIOLATION'
      );
    }
    if (transfer.status !== 'APPROVED') throw ApiError.badRequest('Transfer must be approved before dispatch');

    const from = await this.itemRepo.findByIdNotDeleted(transfer.fromItemId);
    if (!from) throw ApiError.notFound('Source inventory item not found');

    const qty = Number(quantityDispatched) || Number(transfer.quantityRequested);
    const { transaction } = await this.#applyMovement({
      item: from,
      type: STOCK_TX_TYPE.TRANSFER,
      quantityDelta: -qty,
      batchNumber: batchNumber || transfer.batchNumber || null,
      reason: `Transfer dispatch ${transfer.transferNumber}`,
      transferToBranchId: transfer.toBranchId,
      transferToItemId: transfer.toItemId,
      referenceType: 'STOCK_TRANSFER_REQUEST',
      referenceId: transfer._id,
      actorId,
      req,
    });

    transfer.status = 'IN_TRANSIT';
    transfer.quantityDispatched = qty;
    transfer.batchNumber = batchNumber || transfer.batchNumber || transaction.batchNumber;
    transfer.dispatchedBy = actorId;
    transfer.dispatchedAt = new Date();
    transfer.outTransactionId = transaction._id;
    await transfer.save();

    await this.auditService.record(AUDIT_ACTIONS.STOCK_TRANSFER_DISPATCHED, {
      actorId,
      metadata: { transferId: id, quantityDispatched: qty },
      req,
    });
    return transfer.toSafeObject();
  }

  async receiveTransfer(id, { quantityReceived, toItemId, varianceNotes }, actorId, req = null, { branchId = null } = {}) {
    const transfer = await StockTransferRequest.findById(id);
    if (!transfer) throw ApiError.notFound('Transfer request not found');
    this.#assertTransferInScope(transfer, branchId);
    // Receipt ADDS to the destination, so only the destination branch (or a global role) may do it.
    if (branchId && String(transfer.toBranchId) !== String(branchId)) {
      throw ApiError.forbidden(
        'Only the destination branch can receive this transfer',
        'BRANCH_SCOPE_VIOLATION'
      );
    }
    if (transfer.status !== 'IN_TRANSIT') throw ApiError.badRequest('Transfer must be in transit before receiving');

    const from = await this.itemRepo.findByIdNotDeleted(transfer.fromItemId);
    let to = transfer.toItemId
      ? await this.itemRepo.findByIdNotDeleted(transfer.toItemId)
      : toItemId
        ? await this.itemRepo.findByIdNotDeleted(toItemId)
        : null;

    if (!to) {
      to = await this.itemRepo.create({
        itemCode: await generateItemCode(),
        sku: from.sku,
        name: from.name,
        itemType: from.itemType,
        medicineId: from.medicineId,
        branchId: transfer.toBranchId,
        manufacturer: from.manufacturer,
        category: from.category,
        purchasePrice: from.purchasePrice,
        sellingPrice: from.sellingPrice,
        mrp: from.mrp,
        gstPercent: from.gstPercent,
        minimumStock: from.minimumStock,
        maximumStock: from.maximumStock,
        reorderLevel: from.reorderLevel,
        unit: from.unit,
        createdBy: actorId,
        updatedBy: actorId,
      });
    }

    const qty = Number(quantityReceived) || Number(transfer.quantityDispatched);
    const batch = (from.batches || []).find((b) => b.batchNumber === transfer.batchNumber);

    const { transaction } = await this.#applyMovement({
      item: to,
      type: STOCK_TX_TYPE.TRANSFER,
      quantityDelta: qty,
      batchNumber: transfer.batchNumber || `TR-${Date.now()}`,
      expiryDate: batch?.expiryDate || null,
      unitCost: from.purchasePrice,
      mrp: from.mrp,
      reason: `Transfer receive ${transfer.transferNumber}`,
      transferToBranchId: null,
      transferToItemId: from._id,
      referenceType: 'STOCK_TRANSFER_REQUEST',
      referenceId: transfer._id,
      actorId,
      allowCreateBatch: true,
      req,
    });

    const variance = this.#round(qty - (transfer.quantityDispatched || qty));
    transfer.status = 'RECEIVED';
    transfer.quantityReceived = qty;
    transfer.varianceQuantity = variance;
    transfer.varianceNotes = variance !== 0 ? varianceNotes || 'Quantity variance on receipt' : varianceNotes || null;
    transfer.toItemId = to._id;
    transfer.receivedBy = actorId;
    transfer.receivedAt = new Date();
    transfer.inTransactionId = transaction._id;
    await transfer.save();

    await this.auditService.record(AUDIT_ACTIONS.STOCK_TRANSFER_RECEIVED, {
      actorId,
      metadata: { transferId: id, quantityReceived: qty, variance },
      req,
    });

    return transfer.toSafeObject();
  }

  async listTransfers(query = {}) {
    const filter = {};
    if (query.branchId) filter.$or = [{ fromBranchId: query.branchId }, { toBranchId: query.branchId }];
    if (query.status) filter.status = query.status;
    const rows = await StockTransferRequest.find(filter).sort({ createdAt: -1 }).exec();
    return rows.map((r) => r.toSafeObject());
  }

  async getTransfer(id, { branchId = null } = {}) {
    const transfer = await StockTransferRequest.findById(id);
    if (!transfer) throw ApiError.notFound('Transfer request not found');
    this.#assertTransferInScope(transfer, branchId);
    return transfer.toSafeObject();
  }
}

export default InventoryService;
