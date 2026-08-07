import { getNextSequence } from '../models/Sequence.model.js';

export async function generateItemCode() {
  const next = await getNextSequence('inventory_item_code');
  return `ITM-${String(next).padStart(6, '0')}`;
}

export async function generateStockTxNumber() {
  const next = await getNextSequence('stock_transaction_number');
  return `STX-${String(next).padStart(8, '0')}`;
}

export async function generateSupplierCode() {
  const next = await getNextSequence('supplier_code');
  return `SUP-${String(next).padStart(5, '0')}`;
}

export async function generatePoNumber() {
  const next = await getNextSequence('purchase_order_number');
  return `PO-${String(next).padStart(6, '0')}`;
}

export async function generateGrnNumber() {
  const next = await getNextSequence('goods_receipt_number');
  return `GRN-${String(next).padStart(6, '0')}`;
}

export async function generateDispenseNumber() {
  const next = await getNextSequence('dispense_number');
  return `DSP-${String(next).padStart(6, '0')}`;
}

export default {
  generateItemCode,
  generateStockTxNumber,
  generateSupplierCode,
  generatePoNumber,
  generateGrnNumber,
  generateDispenseNumber,
};
