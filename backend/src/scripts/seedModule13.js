/**
 * Module 13 seed — medicines→500, inventory stock, consumables, suppliers, POs, near-expiry.
 */
import Medicine from '../models/Medicine.model.js';
import Branch from '../models/Branch.model.js';
import InventoryItem from '../models/InventoryItem.model.js';
import StockTransaction from '../models/StockTransaction.model.js';
import Supplier from '../models/Supplier.model.js';
import PurchaseOrder from '../models/PurchaseOrder.model.js';
import {
  generateItemCode,
  generateStockTxNumber,
  generateSupplierCode,
  generatePoNumber,
} from '../helpers/inventoryNumber.helper.js';
import {
  CONSUMABLE_CATEGORIES,
  INVENTORY_ITEM_TYPE,
  PO_STATUS,
  STOCK_TX_TYPE,
} from '../enums/inventory.js';
import { DOSAGE_FORM, MEDICINE_ROUTE } from '../enums/prescription.js';
import logger from '../libs/logger.js';

const BASE_NAMES = [
  'Tretinoin',
  'Clindamycin',
  'Benzoyl Peroxide',
  'Hydroquinone',
  'Mometasone',
  'Ketoconazole',
  'Minoxidil',
  'Azelaic Acid',
  'Salicylic Acid',
  'Isotretinoin',
  'Tacrolimus',
  'Pimecrolimus',
  'Adapalene',
  'Fusidic Acid',
  'Mupirocin',
  'Cetirizine',
  'Loratadine',
  'Vitamin C Serum',
  'Hyaluronic Acid',
  'Sunscreen SPF50',
];

export async function seedModule13() {
  const branch = await Branch.findOne({ deletedAt: null }).exec();
  if (!branch) {
    logger.warn('Module 13 skipped — no branch');
    return;
  }

  // Top up medicines to ~500
  let medCount = await Medicine.countDocuments({ deletedAt: null });
  const toAdd = Math.max(0, 500 - medCount);
  const forms = Object.values(DOSAGE_FORM);
  const routes = Object.values(MEDICINE_ROUTE);
  for (let i = 0; i < toAdd; i += 1) {
    const base = BASE_NAMES[i % BASE_NAMES.length];
    const n = medCount + i + 1;
    await Medicine.create({
      medicineCode: `MED-${String(n).padStart(5, '0')}`,
      name: `${base} ${10 + (i % 40)}mg`,
      genericName: base,
      brand: `Brand-${(i % 20) + 1}`,
      category: i % 2 === 0 ? 'Dermatology' : 'Aesthetic',
      strength: `${10 + (i % 40)}mg`,
      dosageForm: forms[i % forms.length],
      defaultRoute: routes[i % routes.length],
      manufacturer: `Mfr-${(i % 15) + 1}`,
      sku: `SKU-MED-${String(n).padStart(5, '0')}`,
      purchasePrice: 50 + (i % 200),
      sellingPrice: 80 + (i % 250),
      mrp: 100 + (i % 300),
      gstPercent: i % 3 === 0 ? 5 : 12,
      minimumStock: 10,
      maximumStock: 500,
      reorderLevel: 25,
      location: `Shelf-${(i % 12) + 1}`,
    });
  }
  medCount = await Medicine.countDocuments({ deletedAt: null });
  logger.info('Module 13 medicines ready', { medCount, added: toAdd });

  const existingItems = await InventoryItem.countDocuments({ deletedAt: null });
  if (existingItems >= 200) {
    logger.info('Module 13 inventory already seeded', { existingItems });
    return;
  }

  const medicines = await Medicine.find({ deletedAt: null }).limit(400).exec();
  const items = [];

  for (let i = 0; i < medicines.length; i += 1) {
    const m = medicines[i];
    const stock = 20 + (i % 80);
    const nearExpiry = i % 17 === 0;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + (nearExpiry ? 20 + (i % 40) : 180 + (i % 400)));

    const batchNumber = `B${String(i + 1).padStart(5, '0')}`;
    const item = await InventoryItem.create({
      itemCode: await generateItemCode(),
      sku: m.sku || `SKU-${m.medicineCode}`,
      barcode: `890${String(1000000000 + i).slice(0, 10)}`,
      name: m.name,
      itemType: INVENTORY_ITEM_TYPE.MEDICINE,
      medicineId: m._id,
      branchId: branch._id,
      manufacturer: m.manufacturer,
      category: m.category,
      purchasePrice: m.purchasePrice || 50,
      sellingPrice: m.sellingPrice || m.mrp || 100,
      mrp: m.mrp || 100,
      gstPercent: m.gstPercent ?? 12,
      currentStock: stock,
      reservedStock: 0,
      minimumStock: m.minimumStock ?? 10,
      maximumStock: m.maximumStock ?? 500,
      reorderLevel: m.reorderLevel ?? 25,
      location: m.location || `A-${(i % 20) + 1}`,
      unit: 'unit',
      batches: [
        {
          batchNumber,
          expiryDate: expiry,
          quantity: stock,
          purchasePrice: m.purchasePrice || 50,
          mrp: m.mrp || 100,
          receivedAt: new Date(),
        },
      ],
    });
    items.push(item);

    await StockTransaction.create({
      transactionNumber: await generateStockTxNumber(),
      type: STOCK_TX_TYPE.OPENING_STOCK,
      inventoryItemId: item._id,
      branchId: branch._id,
      batchNumber,
      quantity: stock,
      balanceAfter: stock,
      unitCost: m.purchasePrice || 50,
      reason: 'Opening stock seed',
    });
  }

  // Consumables
  for (let i = 0; i < CONSUMABLE_CATEGORIES.length; i += 1) {
    const cat = CONSUMABLE_CATEGORIES[i];
    for (let j = 0; j < 3; j += 1) {
      const stock = 50 + j * 20;
      const expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 1);
      const batchNumber = `C${i}${j}-${Date.now().toString().slice(-4)}`;
      const item = await InventoryItem.create({
        itemCode: await generateItemCode(),
        sku: `SKU-CON-${i}${j}`,
        name: `${cat} ${j === 0 ? 'Standard' : j === 1 ? 'Premium' : 'Bulk'}`,
        itemType: INVENTORY_ITEM_TYPE.CONSUMABLE,
        branchId: branch._id,
        manufacturer: 'Aurah Supplies',
        category: cat,
        purchasePrice: 10 + i * 5,
        sellingPrice: 20 + i * 5,
        mrp: 25 + i * 5,
        gstPercent: 18,
        currentStock: stock,
        minimumStock: 20,
        maximumStock: 500,
        reorderLevel: 40,
        location: `Consumable-${i + 1}`,
        unit: 'pack',
        batches: [
          {
            batchNumber,
            expiryDate: expiry,
            quantity: stock,
            purchasePrice: 10 + i * 5,
            mrp: 25 + i * 5,
            receivedAt: new Date(),
          },
        ],
      });
      await StockTransaction.create({
        transactionNumber: await generateStockTxNumber(),
        type: STOCK_TX_TYPE.OPENING_STOCK,
        inventoryItemId: item._id,
        branchId: branch._id,
        batchNumber,
        quantity: stock,
        balanceAfter: stock,
        reason: 'Opening stock consumable',
      });
      items.push(item);
    }
  }

  // Low stock samples
  for (const item of items.slice(0, 8)) {
    await InventoryItem.updateOne(
      { _id: item._id },
      { $set: { currentStock: 3, 'batches.0.quantity': 3, reorderLevel: 25 } }
    );
  }

  // Suppliers
  const supplierSpecs = [
    { name: 'MediCare Distributors', gstin: '24AABCM1234A1Z5', city: 'Surat' },
    { name: 'DermaSupply India', gstin: '27AABCD5678B1Z2', city: 'Mumbai' },
    { name: 'Aesthetic Consumables Co', gstin: '24AAACE9012C1Z8', city: 'Ahmedabad' },
    { name: 'PharmaLink Gujarat', gstin: '24AAAFL3456D1Z1', city: 'Vadodara' },
    { name: 'Clinic Essentials Pvt Ltd', gstin: '27AAACE7890E1Z6', city: 'Pune' },
  ];
  const suppliers = [];
  for (const s of supplierSpecs) {
    let doc = await Supplier.findOne({ name: s.name }).exec();
    if (!doc) {
      doc = await Supplier.create({
        supplierCode: await generateSupplierCode(),
        name: s.name,
        gstin: s.gstin,
        contactName: 'Sales Desk',
        phone: '9876543210',
        email: `${s.name.split(' ')[0].toLowerCase()}@supplier.local`,
        address: { city: s.city, state: 'Gujarat', line1: 'Industrial Area' },
        paymentTerms: 'Net 30',
      });
    }
    suppliers.push(doc);
  }

  // Purchase orders
  const poCount = await PurchaseOrder.countDocuments({ deletedAt: null });
  if (poCount < 5) {
    for (let i = 0; i < 5; i += 1) {
      const supplier = suppliers[i % suppliers.length];
      const sampleItems = items.slice(i * 3, i * 3 + 3);
      await PurchaseOrder.create({
        poNumber: await generatePoNumber(),
        supplierId: supplier._id,
        branchId: branch._id,
        status: i < 3 ? PO_STATUS.ORDERED : PO_STATUS.DRAFT,
        orderedAt: i < 3 ? new Date() : null,
        expectedDate: new Date(Date.now() + (i + 5) * 86400000),
        items: sampleItems.map((it) => ({
          inventoryItemId: it._id,
          medicineId: it.medicineId,
          name: it.name,
          sku: it.sku,
          quantityOrdered: 50,
          quantityReceived: 0,
          unitCost: it.purchasePrice,
          mrp: it.mrp,
        })),
        notes: 'Seed purchase order',
      });
    }
  }

  logger.info('Module 13 inventory seeded', {
    inventoryItems: await InventoryItem.countDocuments({ deletedAt: null }),
    suppliers: suppliers.length,
    nearExpiryBatches: true,
  });
}

export default seedModule13;
