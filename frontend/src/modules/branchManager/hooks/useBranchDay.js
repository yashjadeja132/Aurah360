import { useMemo } from 'react';
import { useReportGenerate } from '@/modules/reports/hooks/useReports';
import { useDiscountApprovalQueue } from '@/modules/billing/hooks/useBilling';
import { useCashCloses } from '@/modules/billing/hooks/useBillingOps';
import {
  useInventoryExpiryReport,
  useInventoryItems,
  useTransfers,
} from '@/modules/inventory/hooks/useInventory';
import { useBranchQueue, useQueueSummary } from '@/modules/reception/hooks/useReception';
/** Local YYYY-MM-DD — the reports filter treats a bare date as a local-day boundary. */
import { localDateKey } from '@/utils/date';

/** A doctor's queue is "backed up" past this — the bottleneck signal the manager lens needs. */
export const BOTTLENECK_WAIT_MINUTES = 20;

/** Pending states, i.e. "this is sitting in the manager's inbox". */
export const PENDING_DISCOUNT_STATUS = 'PENDING_APPROVAL';
export const PENDING_CASH_CLOSE_STATUS = 'SUBMITTED';
export const PENDING_TRANSFER_STATUS = 'REQUESTED';

function minutesSince(value) {
  if (!value) return 0;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

function sumRecorded(rows = []) {
  let total = 0;
  let count = 0;
  const byMode = {};
  for (const r of rows) {
    if (r.status !== 'RECORDED') continue;
    const amount = Number(r.amount) || 0;
    total += amount;
    count += 1;
    byMode[r.method] = (byMode[r.method] || 0) + amount;
  }
  return { total, count, byMode };
}

/**
 * B1 — the Branch Manager command screen, assembled entirely from endpoints that already exist.
 *
 * The flow diff calls B1 "the single biggest structural flow gap in Part B": there is no
 * branch-manager screen at all, so the manager "must visit 4-5 unrelated modules (Reception,
 * Reports, Inventory, Billing) to reconstruct the same picture". This hook is that reconstruction,
 * done once, server-side data unchanged:
 *
 *  · queue load + waiting times across doctors
 *        → `GET /queue/summary?branchId&date` (per-doctor waiting/called/inConsultation counts and
 *          the branch average wait) joined with `GET /queue/branch?branchId&date` (each entry's
 *          `arrivalTime`, which is what actually yields a per-doctor LONGEST wait — the summary only
 *          carries an average over completed visits).
 *  · today's revenue vs last week
 *        → `GET /reports/generate/payments?dateFrom&dateTo&branchId` twice: today, and the SAME
 *          WEEKDAY seven days ago (a like-for-like comparison; a clinic's Monday and Saturday are
 *          not comparable). Totals sum RECORDED rows only, so refunds never inflate the figure.
 *  · low stock / expiring stock
 *        → `GET /inventory/items?branchId&lowStock=true` and `GET /inventory/reports/expiry?branchId`
 *          (one row per batch, already flagged EXPIRED | NEAR_EXPIRY).
 *  · everything awaiting their approval
 *        → `GET /billing/discount-approvals?status=PENDING_APPROVAL&branchId`,
 *          `GET /billing-ops/cash-close?status=SUBMITTED&branchId`,
 *          `GET /inventory/transfers?status=REQUESTED&branchId`.
 *
 * NOTE on `/reports/dashboards/branch-manager`: that dashboard type exists in the enum, but
 * `ReportService.dashboard()` falls it straight through to `#ownerDashboard` — it is the OWNER
 * dashboard under a second name. It carries org-wide top-doctor/top-branch rollups and no queue,
 * stock or approvals data at all, so it cannot answer any of the four questions above. It is
 * deliberately NOT used here.
 *
 * RBAC: BRANCH_MANAGER holds queue.*, reception.*, reports.view, billing.view,
 * billing.discount_approve, billing.cash_close_approve, inventory.view and
 * inventory.transfer_approve — every read AND every action on this screen is permitted for the role.
 */
export function useBranchDay({ branchId } = {}) {
  const enabled = Boolean(branchId);
  const scope = enabled ? { branchId } : {};

  const today = localDateKey();
  const lastWeekDate = new Date();
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
  const lastWeek = localDateKey(lastWeekDate);

  // --- Queue load across doctors -------------------------------------------------
  const summaryQuery = useQueueSummary(branchId, today);
  const queueQuery = useBranchQueue(branchId, today);

  const summary = summaryQuery.data?.data || {};
  const entries = queueQuery.data?.data || [];

  const doctorLoad = useMemo(() => {
    const byDoctor = new Map();

    for (const row of summary.byDoctor || []) {
      byDoctor.set(String(row.doctorId), {
        doctorId: String(row.doctorId),
        doctorName: null,
        waiting: row.waiting || 0,
        called: row.called || 0,
        inConsultation: row.inConsultation || 0,
        longestWait: 0,
        currentToken: null,
      });
    }

    for (const e of entries) {
      const key = e.doctorId ? String(e.doctorId) : null;
      if (!key) continue;
      if (!byDoctor.has(key)) {
        byDoctor.set(key, {
          doctorId: key,
          doctorName: null,
          waiting: 0,
          called: 0,
          inConsultation: 0,
          longestWait: 0,
          currentToken: null,
        });
      }
      const row = byDoctor.get(key);
      if (e.doctor?.name) row.doctorName = e.doctor.name;
      if (e.queueStatus === 'WAITING') {
        row.longestWait = Math.max(row.longestWait, minutesSince(e.arrivalTime));
      }
      if (['CALLED', 'IN_CONSULTATION'].includes(e.queueStatus) && !row.currentToken) {
        row.currentToken = e.tokenNumber;
      }
    }

    return [...byDoctor.values()]
      .map((row) => ({ ...row, isBottleneck: row.longestWait >= BOTTLENECK_WAIT_MINUTES }))
      // Worst first: that is the whole point of a manager lens.
      .sort((a, b) => b.longestWait - a.longestWait || b.waiting - a.waiting);
  }, [summary.byDoctor, entries]);

  /** The comparative line the flow diff asks for ("Dr. Shah 45 min vs Dr. X empty"). */
  const bottleneck = doctorLoad.find((d) => d.isBottleneck) || null;
  const idle = useMemo(
    () => doctorLoad.filter((d) => d.waiting === 0 && d.inConsultation === 0 && d.called === 0),
    [doctorLoad]
  );

  // --- Revenue today vs the same weekday last week -------------------------------
  const todayPayments = useReportGenerate(
    'payments',
    { dateFrom: today, dateTo: today, ...scope },
    enabled
  );
  const lastWeekPayments = useReportGenerate(
    'payments',
    { dateFrom: lastWeek, dateTo: lastWeek, ...scope },
    enabled
  );

  const revenue = useMemo(() => {
    const now = sumRecorded(todayPayments.data?.rows || []);
    const then = sumRecorded(lastWeekPayments.data?.rows || []);
    const delta = now.total - then.total;
    return {
      total: now.total,
      count: now.count,
      byMode: now.byMode,
      lastWeekTotal: then.total,
      lastWeekCount: then.count,
      delta,
      // null (not 0) when there is no baseline — "up 100%" from zero is a lie.
      deltaPercent: then.total > 0 ? Math.round((delta / then.total) * 100) : null,
      comparedTo: lastWeek,
      isLoading: todayPayments.isLoading || lastWeekPayments.isLoading,
      isError: todayPayments.isError || lastWeekPayments.isError,
    };
  }, [todayPayments.data, lastWeekPayments.data, todayPayments.isLoading, lastWeekPayments.isLoading, todayPayments.isError, lastWeekPayments.isError, lastWeek]);

  // --- Stock alerts ---------------------------------------------------------------
  const lowStockQuery = useInventoryItems({ ...scope, lowStock: 'true', limit: 100 });
  const expiryQuery = useInventoryExpiryReport(scope);

  const lowStock = useMemo(() => lowStockQuery.data?.items || [], [lowStockQuery.data]);
  const expiring = useMemo(() => expiryQuery.data || [], [expiryQuery.data]);
  const expiredCount = useMemo(
    () => expiring.filter((r) => r.status === 'EXPIRED').length,
    [expiring]
  );

  // --- Approvals inbox -----------------------------------------------------------
  const discountQuery = useDiscountApprovalQueue({ status: PENDING_DISCOUNT_STATUS, ...scope });
  const cashCloseQuery = useCashCloses({ status: PENDING_CASH_CLOSE_STATUS, ...scope });
  const transferQuery = useTransfers({ status: PENDING_TRANSFER_STATUS, ...scope });

  const discounts = discountQuery.data?.items || [];
  const cashCloses = cashCloseQuery.data || [];
  const transfers = transferQuery.data || [];

  const approvalsTotal = discounts.length + cashCloses.length + transfers.length;

  return {
    branchId,
    today,
    isDisabled: !enabled,
    queue: {
      counts: summary.counts || {},
      averageWaitTime: summary.averageWaitTime || 0,
      doctorLoad,
      bottleneck,
      idle,
      isLoading: summaryQuery.isLoading || queueQuery.isLoading,
      isError: summaryQuery.isError || queueQuery.isError,
      error: summaryQuery.error || queueQuery.error,
      refetch: () => {
        summaryQuery.refetch();
        queueQuery.refetch();
      },
    },
    revenue,
    stock: {
      lowStock,
      lowStockCount: lowStock.length,
      expiring,
      expiringCount: expiring.length,
      expiredCount,
      isLoading: lowStockQuery.isLoading || expiryQuery.isLoading,
      isError: lowStockQuery.isError || expiryQuery.isError,
    },
    approvals: {
      discounts,
      cashCloses,
      transfers,
      total: approvalsTotal,
      isLoading: discountQuery.isLoading || cashCloseQuery.isLoading || transferQuery.isLoading,
    },
  };
}

export default useBranchDay;
