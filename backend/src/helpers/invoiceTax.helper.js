/**
 * Per-line GST computation for invoices (BIL-001 / GST).
 *
 * WHY THIS EXISTS
 * ---------------
 * Billing used to apply ONE branch-level `taxPercent` to the whole invoice and then split the
 * resulting tax back across lines pro-rata "for display". That is not a rounding nicety, it is
 * the wrong number: a 5%-GST medicine and an 18%-GST service on the same invoice were taxed
 * identically, so the GST return could never reconcile against the invoice.
 *
 * Tax is now computed PER LINE at that line's own rate, and the invoice tax is the *sum* of the
 * line taxes rather than an independently-rounded figure. `sum(line.tax) === invoice.tax` and
 * `sum(line.taxableAmount) === subtotal - discount` hold exactly, by construction.
 *
 * ROUNDING CONTRACT (explicit, and the only place rounding happens)
 * ----------------------------------------------------------------
 *  1. All arithmetic is done in INTEGER PAISE. Rupee floats are converted once on the way in and
 *     once on the way out. No float is ever compared or accumulated.
 *  2. Each line's gross (`quantity * unitPrice`) is rounded to paise once.
 *  3. The header discount (percentage/flat + any loyalty redemption) is allocated across lines by
 *     the LARGEST-REMAINDER method, weighted by each line's net amount. Largest-remainder is used
 *     rather than round-per-line because it distributes the allocation exactly: the allocated
 *     paise always sum to the header discount, so no stray paise is created or lost.
 *  4. Line tax = round-half-up(taxable * rate / 100) in paise. Half-up (not banker's rounding),
 *     which is the convention Indian GST invoicing uses.
 *  5. Invoice tax = sum of line taxes. Invoice total = sum of line taxables + invoice tax.
 *
 * The invoice's header `taxPercent` becomes a DERIVED, display-only blended rate. It is no longer
 * an input to anything — a mixed-rate invoice has no single rate, and pretending otherwise is
 * what caused the original bug.
 */

const PAISE = 100;

/** Rupees → integer paise, half-up. */
export function toPaise(rupees) {
  const n = Number(rupees);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * PAISE + (n >= 0 ? Number.EPSILON : -Number.EPSILON) * PAISE);
}

/** Integer paise → rupees with exactly 2 decimals of value. */
export function fromPaise(paise) {
  return Math.round(paise) / PAISE;
}

/**
 * Distribute `totalPaise` across `weights` so the parts sum to exactly `totalPaise`.
 *
 * Each part gets `floor(total * weight / sumWeights)`; the leftover paise go one each to the
 * lines with the largest fractional remainder (ties broken by original order, so the result is
 * deterministic and reproducible for a given invoice).
 *
 * When every weight is zero the total is placed on the first entry rather than being dropped —
 * losing it would silently under-discount.
 */
export function allocateByWeight(totalPaise, weights) {
  const n = weights.length;
  const out = new Array(n).fill(0);
  if (n === 0 || totalPaise <= 0) return out;

  const sum = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (sum <= 0) {
    out[0] = totalPaise;
    return out;
  }

  const remainders = [];
  let allocated = 0;
  for (let i = 0; i < n; i += 1) {
    const exact = (totalPaise * Math.max(0, weights[i])) / sum;
    const floored = Math.floor(exact);
    out[i] = floored;
    allocated += floored;
    remainders.push({ i, frac: exact - floored });
  }

  let leftover = totalPaise - allocated;
  remainders.sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; leftover > 0; k = (k + 1) % n) {
    out[remainders[k].i] += 1;
    leftover -= 1;
  }
  return out;
}

/** Half-up percentage of an integer-paise base. */
function taxOnPaise(basePaise, ratePercent) {
  const rate = Number(ratePercent);
  if (!Number.isFinite(rate) || rate <= 0 || basePaise <= 0) return 0;
  return Math.floor((basePaise * rate) / 100 + 0.5);
}

/**
 * Price a whole invoice.
 *
 * `items` must already carry a server-resolved `taxPercent` per line (see
 * BillingService#resolveLineTaxRates) — this function never looks at any client-supplied tax.
 *
 * Returns the priced lines plus header totals. `discountValue`/`loyaltyDiscountInr` are the
 * header-level discounts; `item.discount` is the per-line discount.
 */
export function priceInvoice(items = [], {
  discountType = 'FLAT',
  discountValue = 0,
  loyaltyDiscountInr = 0,
} = {}) {
  const lines = items.map((raw) => {
    const quantity = Number(raw.quantity) > 0 ? Number(raw.quantity) : 1;
    const unitPricePaise = toPaise(raw.unitPrice);
    const grossPaise = Math.round(quantity * unitPricePaise);
    const lineDiscountPaise = Math.min(Math.max(0, toPaise(raw.discount)), grossPaise);
    return {
      raw,
      quantity,
      grossPaise,
      lineDiscountPaise,
      netPaise: grossPaise - lineDiscountPaise,
      ratePercent: Math.max(0, Number(raw.taxPercent) || 0),
    };
  });

  const subtotalPaise = lines.reduce((s, l) => s + l.grossPaise, 0);
  const itemDiscountPaise = lines.reduce((s, l) => s + l.lineDiscountPaise, 0);
  const netPaise = subtotalPaise - itemDiscountPaise;

  // Header discount: percentage is of the SUBTOTAL (unchanged from the previous behaviour), flat
  // is taken as given. Loyalty redemption is a header discount too (LOY-005).
  const dv = Math.max(0, Number(discountValue) || 0);
  let headerDiscountPaise =
    discountType === 'PERCENTAGE'
      ? Math.floor((subtotalPaise * Math.min(dv, 100)) / 100 + 0.5)
      : toPaise(dv);
  headerDiscountPaise += Math.max(0, toPaise(loyaltyDiscountInr));
  // Never discount below zero — the invoice cannot have a negative taxable base.
  headerDiscountPaise = Math.min(headerDiscountPaise, netPaise);

  const allocation = allocateByWeight(headerDiscountPaise, lines.map((l) => l.netPaise));

  let taxPaise = 0;
  let taxablePaise = 0;
  const pricedItems = lines.map((l, i) => {
    const lineTaxablePaise = Math.max(0, l.netPaise - allocation[i]);
    const lineTaxPaise = taxOnPaise(lineTaxablePaise, l.ratePercent);
    taxablePaise += lineTaxablePaise;
    taxPaise += lineTaxPaise;
    return {
      ...l.raw,
      quantity: l.quantity,
      unitPrice: fromPaise(toPaise(l.raw.unitPrice)),
      discount: fromPaise(l.lineDiscountPaise),
      taxPercent: l.ratePercent,
      taxableAmount: fromPaise(lineTaxablePaise),
      tax: fromPaise(lineTaxPaise),
      total: fromPaise(lineTaxablePaise + lineTaxPaise),
    };
  });

  // Display-only blended rate. Derived from the numbers that were actually charged, so it can
  // never disagree with them.
  const blendedRate = taxablePaise > 0 ? Math.round((taxPaise / taxablePaise) * 10000) / 100 : 0;

  return {
    items: pricedItems,
    subtotal: fromPaise(subtotalPaise),
    discount: fromPaise(itemDiscountPaise + headerDiscountPaise),
    taxableAmount: fromPaise(taxablePaise),
    tax: fromPaise(taxPaise),
    total: fromPaise(taxablePaise + taxPaise),
    taxPercent: blendedRate,
  };
}

/**
 * GST return summary: the invoice's tax grouped by rate, which is the shape GSTR-1 needs and
 * the thing a single blended rate made impossible to produce.
 */
export function taxBreakdown(pricedItems = []) {
  const byRate = new Map();
  for (const item of pricedItems) {
    const rate = Math.max(0, Number(item.taxPercent) || 0);
    const bucket = byRate.get(rate) || { taxPercent: rate, taxableAmount: 0, tax: 0 };
    bucket.taxableAmount += toPaise(item.taxableAmount);
    bucket.tax += toPaise(item.tax);
    byRate.set(rate, bucket);
  }
  return [...byRate.values()]
    .sort((a, b) => a.taxPercent - b.taxPercent)
    .map((b) => ({
      taxPercent: b.taxPercent,
      taxableAmount: fromPaise(b.taxableAmount),
      tax: fromPaise(b.tax),
    }));
}

export default { toPaise, fromPaise, allocateByWeight, priceInvoice, taxBreakdown };
