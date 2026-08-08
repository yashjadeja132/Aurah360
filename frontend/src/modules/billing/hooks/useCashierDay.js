import { useMemo } from 'react';
import { useReportGenerate } from '@/modules/reports/hooks/useReports';
import { useInvoices, useDuePayments, useDiscountApprovalQueue } from './useBilling';

/** Local YYYY-MM-DD — the reports filter treats a bare date as a local-day boundary. */
export function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * A.1 — everything the cashier landing needs, from endpoints that already exist. No new backend
 * route: each question maps onto a list the API already serves.
 *
 *  · "finished treatment, awaiting billing" → DRAFT invoices (`GET /billing?status=DRAFT`). A draft
 *    is a bill raised for completed work that nobody has finalized or collected yet, and it is the
 *    only such worklist a CASHIER can actually read — the role holds `billing.*` but neither
 *    `appointments.view` nor `queue.view`, so the APPOINTMENT_STATUS.AWAITING_BILLING list would
 *    403 for the very user this screen is for.
 *  · "dues, with a Collect action"        → `GET /billing/due-payments` (+ its `checkedInToday`
 *    filter for the patients still standing at the desk).
 *  · "awaiting discount approval"         → `GET /billing/discount-approvals?status=PENDING_APPROVAL`.
 *  · "today's collection total"           → `GET /reports/generate/payments` for today, summed over
 *    RECORDED rows (a REFUNDED row is money that came back, so it is excluded from the total and
 *    reported separately).
 */
export function useCashierDay({ branchId } = {}) {
  const scope = branchId ? { branchId } : {};

  // Draft invoices = the "finish this bill" queue. limit is capped at 100 server-side.
  const awaitingBilling = useInvoices({ ...scope, status: 'DRAFT', limit: 100 });

  // Full dues picture (for the outstanding headline) and the at-the-desk subset.
  const dues = useDuePayments({ ...scope, limit: 1 });
  const duesAtDesk = useDuePayments({ ...scope, checkedInToday: 'true', limit: 100 });

  const approvals = useDiscountApprovalQueue({ ...scope, status: 'PENDING_APPROVAL' });

  const day = todayISO();
  const payments = useReportGenerate('payments', { dateFrom: day, dateTo: day, ...scope });

  const collection = useMemo(() => {
    const rows = payments.data?.rows || [];
    const recorded = rows.filter((r) => r.status === 'RECORDED');
    const byMode = {};
    let total = 0;
    for (const r of recorded) {
      const amount = Number(r.amount) || 0;
      total += amount;
      byMode[r.method] = (byMode[r.method] || 0) + amount;
    }
    const refunded = rows
      .filter((r) => r.status === 'REFUNDED')
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    return { total, refunded, count: recorded.length, byMode, rows };
  }, [payments.data]);

  return {
    awaitingBilling: {
      items: awaitingBilling.data?.items || [],
      total: awaitingBilling.data?.meta?.total || 0,
      isLoading: awaitingBilling.isLoading,
    },
    dues: {
      totalOutstanding: dues.data?.meta?.totalOutstanding || 0,
      count: dues.data?.meta?.total || 0,
      buckets: dues.data?.meta?.buckets || {},
      isLoading: dues.isLoading,
    },
    duesAtDesk: {
      count: duesAtDesk.data?.meta?.total || 0,
      outstanding: duesAtDesk.data?.meta?.totalOutstanding || 0,
      isLoading: duesAtDesk.isLoading,
    },
    approvals: {
      count: approvals.data?.meta?.total ?? (approvals.data?.items || []).length,
      isLoading: approvals.isLoading,
    },
    collection: { ...collection, isLoading: payments.isLoading, isError: payments.isError },
  };
}

export default useCashierDay;
