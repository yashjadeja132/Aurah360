export const INVENTORY_ITEM_TYPE = Object.freeze({
  MEDICINE: 'MEDICINE',
  CONSUMABLE: 'CONSUMABLE',
});

export const INVENTORY_ITEM_TYPE_LIST = Object.freeze(Object.values(INVENTORY_ITEM_TYPE));

export const STOCK_TX_TYPE = Object.freeze({
  PURCHASE: 'PURCHASE',
  ADJUSTMENT: 'ADJUSTMENT',
  DISPENSE: 'DISPENSE',
  RETURN: 'RETURN',
  TRANSFER: 'TRANSFER',
  CONSUMPTION: 'CONSUMPTION',
  OPENING_STOCK: 'OPENING_STOCK',
});

export const STOCK_TX_TYPE_LIST = Object.freeze(Object.values(STOCK_TX_TYPE));

export const DISPENSE_STATUS = Object.freeze({
  PENDING: 'PENDING',
  PARTIAL: 'PARTIAL',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

export const DISPENSE_STATUS_LIST = Object.freeze(Object.values(DISPENSE_STATUS));

export const DISPENSE_ITEM_STATUS = Object.freeze({
  PENDING: 'PENDING',
  PARTIAL: 'PARTIAL',
  DISPENSED: 'DISPENSED',
});

export const DISPENSE_ITEM_STATUS_LIST = Object.freeze(Object.values(DISPENSE_ITEM_STATUS));

/** PHARM-DIRECT — whether a Dispense record is anchored to a signed prescription or is a
 * standalone retail/counter sale. */
export const SALE_TYPE = Object.freeze({
  PRESCRIPTION: 'PRESCRIPTION',
  DIRECT: 'DIRECT',
});

export const SALE_TYPE_LIST = Object.freeze(Object.values(SALE_TYPE));

export const PO_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  ORDERED: 'ORDERED',
  PARTIAL_RECEIVED: 'PARTIAL_RECEIVED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
});

export const PO_STATUS_LIST = Object.freeze(Object.values(PO_STATUS));

export const GR_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  POSTED: 'POSTED',
});

export const GR_STATUS_LIST = Object.freeze(Object.values(GR_STATUS));

export const CONSUMABLE_CATEGORIES = Object.freeze([
  'Needles',
  'Gloves',
  'PRP Kits',
  'Laser Tips',
  'Gauze',
  'Creams',
  'Syringes',
  'Other',
]);

/** Days ahead considered near-expiry */
export const NEAR_EXPIRY_DAYS = 90;

export const INVENTORY_EVENTS = Object.freeze({
  MEDICINE_DISPENSED: 'MedicineDispensed',
  STOCK_ADJUSTED: 'StockAdjusted',
  LOW_STOCK_DETECTED: 'LowStockDetected',
  NEAR_EXPIRY_DETECTED: 'NearExpiryDetected',
  GOODS_RECEIVED: 'GoodsReceived',
  STOCK_CONSUMED: 'StockConsumed',
  /** PHARM-DIRECT — same "billing hears about it" hook that MEDICINE_DISPENSED already provides. */
  DIRECT_SALE_CREATED: 'DirectSaleCreated',
});

export default {
  INVENTORY_ITEM_TYPE,
  STOCK_TX_TYPE,
  DISPENSE_STATUS,
  SALE_TYPE,
  INVENTORY_EVENTS,
};
