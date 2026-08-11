import mongoose from 'mongoose';
import { INVENTORY_ITEM_TYPE_LIST } from '../enums/inventory.js';
import { ENTITY_STATUS } from '../constants/index.js';

const batchSchema = new mongoose.Schema(
  {
    batchNumber: { type: String, required: true, trim: true },
    // GRN-GAP-4 — optional, not every product carries a printed manufacture date.
    manufactureDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    purchasePrice: { type: Number, default: null, min: 0 },
    mrp: { type: Number, default: null, min: 0 },
    receivedAt: { type: Date, default: Date.now },
    // GRN-GAP-4 — optional per-batch bin/shelf location within the branch storeroom.
    bin: { type: String, default: null, trim: true },
    // PHARM-GAP-5 — a batch can be blocked from dispensing for a reason other than expiry
    // (e.g. damage confirmed but vendor return not yet processed, or a recall). isDamaged is
    // the specific reason flag; isBlocked is the general "refuse at dispense/sale" gate so the
    // #applyMovement guard has a single flag to check regardless of why the batch was blocked.
    isBlocked: { type: Boolean, default: false },
    isDamaged: { type: Boolean, default: false },
    blockReason: { type: String, default: null, trim: true },
  },
  { _id: true }
);

const inventoryItemSchema = new mongoose.Schema(
  {
    itemCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    sku: { type: String, default: null, trim: true, index: true },
    barcode: { type: String, default: null, trim: true },
    name: { type: String, required: true, trim: true, index: true },
    itemType: {
      type: String,
      enum: INVENTORY_ITEM_TYPE_LIST,
      required: true,
      index: true,
    },
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      default: null,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    manufacturer: { type: String, default: null, trim: true },
    category: { type: String, default: null, trim: true, index: true },
    purchasePrice: { type: Number, default: 0, min: 0 },
    sellingPrice: { type: Number, default: 0, min: 0 },
    mrp: { type: Number, default: 0, min: 0 },
    gstPercent: { type: Number, default: 12, min: 0, max: 100 },
    hsnCode: { type: String, default: null, trim: true },
    currentStock: { type: Number, default: 0, min: 0 },
    reservedStock: { type: Number, default: 0, min: 0 },
    minimumStock: { type: Number, default: 10, min: 0 },
    maximumStock: { type: Number, default: 1000, min: 0 },
    reorderLevel: { type: Number, default: 20, min: 0 },
    location: { type: String, default: null, trim: true },
    unit: { type: String, default: 'unit', trim: true },
    /**
     * PHARM-DIRECT — a prescription-only product (scheduled/controlled medicine). The direct
     * (retail, no-prescription) sale path hard-blocks any line carrying `requiresPrescription:
     * true`; prescription-anchored dispensing is unaffected. Defaults to false so existing
     * catalog data (OTC items, consumables) needs no backfill.
     */
    requiresPrescription: { type: Boolean, default: false },
    batches: { type: [batchSchema], default: [] },
    status: {
      type: String,
      enum: Object.values(ENTITY_STATUS),
      default: ENTITY_STATUS.ACTIVE,
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    collection: 'inventory_items',
  }
);

inventoryItemSchema.index({ branchId: 1, itemType: 1, name: 1 });
inventoryItemSchema.index({ 'batches.expiryDate': 1 });
inventoryItemSchema.index({ name: 'text', sku: 'text', itemCode: 'text' });

inventoryItemSchema.virtual('availableStock').get(function availableStock() {
  return Math.max(0, (this.currentStock || 0) - (this.reservedStock || 0));
});

inventoryItemSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  const available = Math.max(0, (this.currentStock || 0) - (this.reservedStock || 0));
  // CRITICAL sits between OUT_OF_STOCK and LOW: at or below the configured safety floor
  // (minimumStock) the item needs attention now, not at the next purchase cycle.
  const stockStatus =
    available <= 0
      ? 'OUT_OF_STOCK'
      : available <= (this.minimumStock || 0)
        ? 'CRITICAL'
        : available <= this.reorderLevel
          ? 'LOW'
          : 'OK';
  return {
    id: this._id.toString(),
    itemCode: this.itemCode,
    sku: this.sku,
    barcode: this.barcode,
    name: this.name,
    itemType: this.itemType,
    medicineId: this.medicineId?.toString?.() || this.medicineId || null,
    branchId: this.branchId?.toString?.() || this.branchId,
    manufacturer: this.manufacturer,
    category: this.category,
    purchasePrice: this.purchasePrice,
    sellingPrice: this.sellingPrice,
    mrp: this.mrp,
    gstPercent: this.gstPercent,
    hsnCode: this.hsnCode,
    currentStock: this.currentStock,
    reservedStock: this.reservedStock,
    availableStock: available,
    minimumStock: this.minimumStock,
    maximumStock: this.maximumStock,
    reorderLevel: this.reorderLevel,
    location: this.location,
    unit: this.unit,
    requiresPrescription: this.requiresPrescription,
    batches: (this.batches || []).map((b) => ({
      id: b._id?.toString(),
      batchNumber: b.batchNumber,
      manufactureDate: b.manufactureDate,
      expiryDate: b.expiryDate,
      quantity: b.quantity,
      purchasePrice: b.purchasePrice,
      mrp: b.mrp,
      receivedAt: b.receivedAt,
      bin: b.bin,
      isBlocked: b.isBlocked || false,
      isDamaged: b.isDamaged || false,
      blockReason: b.blockReason || null,
    })),
    stockStatus,
    status: this.status,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const InventoryItem = mongoose.model('InventoryItem', inventoryItemSchema);

export default InventoryItem;
