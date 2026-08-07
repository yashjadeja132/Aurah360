import InventoryItem from '../../models/InventoryItem.model.js';
import StockTransaction from '../../models/StockTransaction.model.js';
import PurchaseOrder from '../../models/PurchaseOrder.model.js';
import InventoryService from '../InventoryService.js';
import { parseReportFilters, roundMoney } from '../../helpers/reportFilters.helper.js';

/** Reuses InventoryService.reports() where available; supplements with aggregations. */
class InventoryAnalyticsService {
  constructor() {
    this.inventoryService = new InventoryService();
  }

  async report(query = {}) {
    const filters = parseReportFilters(query);
    const branchId = filters.branchId?.toString?.() || filters.branchId || null;
    const itemMatch = { deletedAt: null, ...(filters.branchId ? { branchId: filters.branchId } : {}) };

    let lowStock = [];
    let nearExpiry = [];
    try {
      const low = await this.inventoryService.reports('low-stock', { branchId });
      lowStock = low.items || low || [];
    } catch {
      lowStock = [];
    }
    try {
      const exp = await this.inventoryService.reports('near-expiry', { branchId });
      nearExpiry = exp.items || exp || [];
    } catch {
      nearExpiry = [];
    }

    const nearExpiryBefore = new Date();
    nearExpiryBefore.setDate(nearExpiryBefore.getDate() + 90);

    const [stock, movement, purchases, consumption] = await Promise.all([
      InventoryItem.aggregate([
        { $match: itemMatch },
        {
          $group: {
            _id: null,
            items: { $sum: 1 },
            units: { $sum: '$currentStock' },
            value: {
              $sum: { $multiply: ['$currentStock', { $ifNull: ['$purchasePrice', 0] }] },
            },
          },
        },
      ]),
      StockTransaction.aggregate([
        {
          $match: {
            deletedAt: null,
            ...(filters.branchId ? { branchId: filters.branchId } : {}),
            ...(filters.dateFrom || filters.dateTo
              ? {
                  createdAt: {
                    ...(filters.dateFrom ? { $gte: filters.dateFrom } : {}),
                    ...(filters.dateTo ? { $lte: filters.dateTo } : {}),
                  },
                }
              : {}),
          },
        },
        { $group: { _id: '$type', quantity: { $sum: '$quantity' }, count: { $sum: 1 } } },
      ]),
      PurchaseOrder.aggregate([
        {
          $match: {
            deletedAt: null,
            ...(filters.branchId ? { branchId: filters.branchId } : {}),
          },
        },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      StockTransaction.aggregate([
        {
          $match: {
            deletedAt: null,
            type: { $in: ['ISSUE', 'DISPENSE', 'CONSUMPTION', 'OUT'] },
            ...(filters.branchId ? { branchId: filters.branchId } : {}),
          },
        },
        { $group: { _id: null, quantity: { $sum: { $abs: '$quantity' } }, count: { $sum: 1 } } },
      ]),
    ]);

    const lowCount =
      Array.isArray(lowStock) && lowStock.length
        ? lowStock.length
        : await InventoryItem.countDocuments({
            ...itemMatch,
            isActive: true,
            $expr: { $lte: ['$currentStock', '$reorderLevel'] },
          });

    const expiryCount =
      Array.isArray(nearExpiry) && nearExpiry.length
        ? nearExpiry.length
        : await InventoryItem.countDocuments({
            ...itemMatch,
            'batches.expiryDate': { $lte: nearExpiryBefore, $gte: new Date() },
          });

    const movementRows = movement.map((m) => ({
      type: m._id || 'Unknown',
      quantity: m.quantity,
      count: m.count,
    }));

    return {
      category: 'inventory',
      filters,
      summary: {
        currentStockItems: stock[0]?.items || 0,
        currentStockUnits: stock[0]?.units || 0,
        stockValue: roundMoney(stock[0]?.value || 0),
        lowStock: lowCount,
        expiringProducts: expiryCount,
        consumptionQuantity: consumption[0]?.quantity || 0,
        purchaseOrders: purchases.reduce((s, p) => s + p.count, 0),
      },
      stockMovement: movementRows,
      purchaseSummary: purchases.map((p) => ({ status: p._id, count: p.count })),
      lowStockSample: (Array.isArray(lowStock) ? lowStock : []).slice(0, 20),
      columns: [
        { key: 'type', label: 'Movement Type' },
        { key: 'quantity', label: 'Quantity' },
        { key: 'count', label: 'Transactions' },
      ],
      rows: movementRows,
    };
  }
}

export default InventoryAnalyticsService;
