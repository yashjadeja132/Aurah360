import { getNextSequence } from '../models/Sequence.model.js';

export async function generateInvoiceNumber() {
  const next = await getNextSequence('invoice_number');
  return `INV-${String(next).padStart(6, '0')}`;
}

export async function generatePaymentNumber() {
  const next = await getNextSequence('payment_number');
  return `PAY-${String(next).padStart(6, '0')}`;
}

export async function generateReceiptNumber() {
  const next = await getNextSequence('receipt_number');
  return `RCP-${String(next).padStart(6, '0')}`;
}

export async function generateCreditNoteNumber() {
  const next = await getNextSequence('credit_note_number');
  return `CN-${String(next).padStart(6, '0')}`;
}

export default {
  generateInvoiceNumber,
  generatePaymentNumber,
  generateReceiptNumber,
  generateCreditNoteNumber,
};
