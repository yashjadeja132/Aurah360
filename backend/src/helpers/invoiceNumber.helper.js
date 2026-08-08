import { getNextSequence } from '../models/Sequence.model.js';
import OrganizationRepository from '../repositories/OrganizationRepository.js';

/** The prefix every invoice was numbered with before `Organization.invoicePrefix` was honoured,
 *  and the schema default. Its counter keeps the original, unnamespaced sequence key. */
const LEGACY_INVOICE_PREFIX = 'INV';
const LEGACY_INVOICE_SEQUENCE_KEY = 'invoice_number';

const organizationRepository = new OrganizationRepository();

export function normalizeInvoicePrefix(prefix) {
  const cleaned = String(prefix ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '');
  return cleaned || LEGACY_INVOICE_PREFIX;
}

/**
 * EACH PREFIX GETS ITS OWN COUNTER.
 *
 * A single shared counter would be wrong in both directions. If the clinic switches from `INV` to
 * `AUR` and later switches back, a shared counter is fine — but a per-prefix counter restarting at
 * 1 for `AUR` cannot collide with `INV-000001` either, because the prefix itself distinguishes
 * them. What a SHARED counter cannot survive is the counter document being reset or a second
 * prefix being introduced on a database already carrying `INV-000123`: numbering would then walk
 * back over live invoice numbers. Namespacing the counter by prefix makes each series
 * independent and monotonic, and `Invoice.invoiceNumber` is uniquely indexed as the backstop.
 *
 * `INV` deliberately keeps the original key so the existing sequence continues uninterrupted —
 * no historical invoice is renumbered and the next number after `INV-000123` is still
 * `INV-000124`.
 */
export function invoiceSequenceKeyFor(prefix) {
  const normalized = normalizeInvoicePrefix(prefix);
  return normalized === LEGACY_INVOICE_PREFIX
    ? LEGACY_INVOICE_SEQUENCE_KEY
    : `${LEGACY_INVOICE_SEQUENCE_KEY}:${normalized}`;
}

/**
 * ORG-001 — uses the configured `Organization.invoicePrefix`. Falls back to `INV` if the
 * organization record cannot be read, so billing never becomes unavailable because of a
 * settings lookup.
 */
export async function generateInvoiceNumber() {
  let prefix = LEGACY_INVOICE_PREFIX;
  try {
    const org = await organizationRepository.getSingleton();
    prefix = normalizeInvoicePrefix(org?.invoicePrefix);
  } catch {
    prefix = LEGACY_INVOICE_PREFIX;
  }
  const next = await getNextSequence(invoiceSequenceKeyFor(prefix));
  return `${prefix}-${String(next).padStart(6, '0')}`;
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
  normalizeInvoicePrefix,
  invoiceSequenceKeyFor,
  generatePaymentNumber,
  generateReceiptNumber,
  generateCreditNoteNumber,
};
