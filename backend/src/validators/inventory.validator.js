import { z } from 'zod';
import {
  INVENTORY_ITEM_TYPE_LIST,
  STOCK_TX_TYPE_LIST,
  DISPENSE_STATUS_LIST,
  PO_STATUS_LIST,
  SALE_TYPE_LIST,
} from '../enums/inventory.js';

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');

export const idParamSchema = z.object({ id: objectId });

export const itemListQuerySchema = z.object({
  branchId: objectId.optional(),
  itemType: z.enum(INVENTORY_ITEM_TYPE_LIST).optional(),
  q: z.string().optional(),
  lowStock: z.string().optional(),
  outOfStock: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

export const createItemSchema = z.object({
  name: z.string().min(1),
  branchId: objectId,
  itemType: z.enum(INVENTORY_ITEM_TYPE_LIST),
  medicineId: objectId.optional().nullable(),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  purchasePrice: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  mrp: z.number().min(0).optional(),
  gstPercent: z.number().min(0).max(100).optional(),
  hsnCode: z.string().optional().nullable(),
  minimumStock: z.number().min(0).optional(),
  maximumStock: z.number().min(0).optional(),
  reorderLevel: z.number().min(0).optional(),
  location: z.string().optional().nullable(),
  unit: z.string().optional(),
  // Direct/retail sale hard-stop (PharmacyService.createDirectSale) — items flagged true here
  // cannot be sold outside a linked prescription. Defaults false so existing OTC items are
  // unaffected until a pharmacist/admin explicitly marks a product prescription-only.
  requiresPrescription: z.boolean().optional(),
});

export const updateItemSchema = createItemSchema.partial().omit({ branchId: true, itemType: true });

export const openingStockSchema = z.object({
  inventoryItemId: objectId,
  quantity: z.number().positive(),
  batchNumber: z.string().min(1),
  expiryDate: z.string().or(z.date()).optional().nullable(),
  unitCost: z.number().min(0).optional(),
  mrp: z.number().min(0).optional(),
  reason: z.string().optional(),
  notes: z.string().optional().nullable(),
});

export const adjustSchema = z.object({
  inventoryItemId: objectId,
  quantity: z.number().refine((n) => n !== 0, 'quantity must be non-zero'),
  batchNumber: z.string().optional().nullable(),
  expiryDate: z.string().or(z.date()).optional().nullable(),
  reason: z.string().optional(),
  notes: z.string().optional().nullable(),
});

export const transferSchema = z.object({
  fromItemId: objectId,
  toItemId: objectId.optional(),
  toBranchId: objectId.optional(),
  toLocation: z.string().optional().nullable(),
  quantity: z.number().positive(),
  batchNumber: z.string().optional().nullable(),
  expiryDate: z.string().or(z.date()).optional().nullable(),
});

export const requestTransferSchema = z.object({
  fromBranchId: objectId,
  toBranchId: objectId,
  fromItemId: objectId,
  toItemId: objectId.optional().nullable(),
  batchNumber: z.string().optional().nullable(),
  quantityRequested: z.number().positive(),
  notes: z.string().max(1000).optional().nullable(),
});

export const rejectTransferSchema = z.object({
  reason: z.string().max(500).optional().nullable(),
});

export const dispatchTransferSchema = z.object({
  quantityDispatched: z.number().positive().optional(),
  batchNumber: z.string().optional().nullable(),
});

export const receiveTransferSchema = z.object({
  quantityReceived: z.number().positive().optional(),
  toItemId: objectId.optional().nullable(),
  varianceNotes: z.string().max(1000).optional().nullable(),
});

export const transferIdParamSchema = z.object({ id: objectId });

export const stockCountSchema = z.object({
  inventoryItemId: objectId,
  countedQuantity: z.number().min(0),
  batchNumber: z.string().optional().nullable(),
  reason: z.string().optional(),
  notes: z.string().optional().nullable(),
});

export const consumeSchema = z.object({
  inventoryItemId: objectId,
  quantity: z.number().positive(),
  batchNumber: z.string().optional().nullable(),
  treatmentSessionId: objectId.optional().nullable(),
});

export const ledgerQuerySchema = z.object({
  inventoryItemId: objectId.optional(),
  branchId: objectId.optional(),
  type: z.enum(STOCK_TX_TYPE_LIST).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

export const supplierSchema = z.object({
  name: z.string().min(1),
  gstin: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  address: z
    .object({
      line1: z.string().optional().nullable(),
      line2: z.string().optional().nullable(),
      city: z.string().optional().nullable(),
      state: z.string().optional().nullable(),
      pincode: z.string().optional().nullable(),
    })
    .optional(),
  paymentTerms: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const createPoSchema = z.object({
  supplierId: objectId,
  branchId: objectId,
  expectedDate: z.string().or(z.date()).optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        inventoryItemId: objectId.optional().nullable(),
        medicineId: objectId.optional().nullable(),
        name: z.string().min(1),
        sku: z.string().optional().nullable(),
        quantityOrdered: z.number().positive().optional(),
        quantity: z.number().positive().optional(),
        unitCost: z.number().min(0).optional(),
        mrp: z.number().min(0).optional(),
      })
    )
    .min(1),
});

export const createGrnSchema = z.object({
  supplierId: objectId,
  branchId: objectId,
  purchaseOrderId: objectId.optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        inventoryItemId: objectId,
        purchaseOrderItemId: objectId.optional().nullable(),
        name: z.string().min(1),
        batchNumber: z.string().min(1),
        expiryDate: z.string().or(z.date()),
        quantity: z.number().positive(),
        unitCost: z.number().min(0).optional(),
        mrp: z.number().min(0).optional(),
      })
    )
    .min(1),
});

export const startDispenseSchema = z.object({
  prescriptionId: objectId,
  branchId: objectId.optional(),
  notes: z.string().optional().nullable(),
});

/**
 * PHARM-SUBST — `reason` and `substitutedMedicineId` are enforced as mandatory in
 * PharmacyService (not here) because they are only REQUIRED when `isSubstituted: true`; zod's
 * `.refine` would work too, but the service already owns the permission check for the same flag,
 * so both conditions live together at one call site.
 */
const substitutionInputSchema = z.object({
  isSubstituted: z.boolean().optional(),
  substitutedMedicineId: objectId.optional(),
  reason: z.string().max(500).optional().nullable(),
});

export const dispenseItemsSchema = z.object({
  notes: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        itemId: objectId.optional(),
        prescriptionItemIndex: z.number().int().min(0).optional(),
        inventoryItemId: objectId.optional(),
        batchNumber: z.string().optional().nullable(),
        quantity: z.number().positive(),
        substitution: substitutionInputSchema.optional(),
      })
    )
    .min(1),
});

export const dispenseListQuerySchema = z.object({
  branchId: objectId.optional(),
  status: z.enum(DISPENSE_STATUS_LIST).optional(),
  patientId: objectId.optional(),
  saleType: z.enum(SALE_TYPE_LIST).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

/** PHARM-DIRECT — counter/retail sale with no prescription behind it. */
export const createDirectSaleSchema = z.object({
  branchId: objectId.optional(),
  patientId: objectId.optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        inventoryItemId: objectId,
        batchNumber: z.string().optional().nullable(),
        quantity: z.number().positive(),
      })
    )
    .min(1),
});

export const poListQuerySchema = z.object({
  branchId: objectId.optional(),
  status: z.enum(PO_STATUS_LIST).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const reportTypeParamSchema = z.object({
  type: z.enum(['ledger', 'low-stock', 'expiry', 'near-expiry']),
});
