import Invoice from '../../models/Invoice.model.js';
import Payment from '../../models/Payment.model.js';
import { dayBucket } from '../../utils/date.util.js';
import {
  parseReportFilters,
  applyCommonMatch,
  roundMoney,
  startOfDay,
  endOfDay,
} from '../../helpers/reportFilters.helper.js';

class BillingAnalyticsService {
  async report(query = {}) {
    const filters = parseReportFilters(query);
    const invMatch = applyCommonMatch({}, filters, { dateField: 'invoiceDate' });
    if (filters.paymentStatus) invMatch.paymentStatus = filters.paymentStatus;
    const payMatch = applyCommonMatch(
      { status: 'RECORDED' },
      filters,
      { dateField: 'paidAt', includeDoctor: false }
    );
    if (query.paymentMethod) payMatch.method = query.paymentMethod;

    const todayStart = startOfDay();
    const todayEnd = endOfDay();

    const [invoices, collections, outstanding, refunds, discounts, methods, trend, cashToday] =
      await Promise.all([
        Invoice.aggregate([
          { $match: invMatch },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              total: { $sum: '$total' },
              paid: { $sum: '$paidAmount' },
            },
          },
        ]),
        Payment.aggregate([
          { $match: payMatch },
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
        Invoice.aggregate([
          {
            $match: {
              deletedAt: null,
              ...(filters.branchId ? { branchId: filters.branchId } : {}),
              paymentStatus: { $in: ['PENDING', 'PARTIALLY_PAID'] },
              status: { $ne: 'VOID' },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$balanceAmount' },
              count: { $sum: 1 },
            },
          },
        ]),
        Payment.aggregate([
          {
            $match: {
              deletedAt: null,
              ...(filters.branchId ? { branchId: filters.branchId } : {}),
              $or: [{ status: 'REFUNDED' }, { refundedAmount: { $gt: 0 } }],
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: { $ifNull: ['$refundedAmount', '$amount'] } },
              count: { $sum: 1 },
            },
          },
        ]),
        Invoice.aggregate([
          { $match: invMatch },
          {
            $group: {
              _id: null,
              discount: { $sum: { $ifNull: ['$discountValue', '$discount', 0] } },
            },
          },
        ]),
        Payment.aggregate([
          { $match: payMatch },
          { $group: { _id: '$method', total: { $sum: '$amount' }, count: { $sum: 1 } } },
          { $sort: { total: -1 } },
        ]),
        Payment.aggregate([
          { $match: payMatch },
          {
            $group: {
              // paidAt is a true instant, but revenue-by-day must follow the CLINIC's day: a
              // payment taken at 01:00 IST belongs to that day's takings, not the previous one.
              _id: dayBucket('$paidAt'),
              amount: { $sum: '$amount' },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        Payment.aggregate([
          {
            $match: {
              deletedAt: null,
              status: 'RECORDED',
              method: 'CASH',
              ...(filters.branchId ? { branchId: filters.branchId } : {}),
              paidAt: { $gte: todayStart, $lte: todayEnd },
            },
          },
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
      ]);

    const methodRows = methods.map((m) => ({
      method: m._id || 'Unknown',
      amount: roundMoney(m.total),
      count: m.count,
    }));

    return {
      category: 'billing',
      filters,
      summary: {
        invoices: invoices[0]?.count || 0,
        invoiceTotal: roundMoney(invoices[0]?.total || 0),
        collections: roundMoney(collections[0]?.total || 0),
        outstandingPayments: roundMoney(outstanding[0]?.total || 0),
        outstandingCount: outstanding[0]?.count || 0,
        refunds: roundMoney(refunds[0]?.total || 0),
        discounts: roundMoney(discounts[0]?.discount || 0),
        dailyCashSummary: roundMoney(cashToday[0]?.total || 0),
        dailyCashCount: cashToday[0]?.count || 0,
      },
      paymentMethods: methodRows,
      revenueTrend: trend.map((t) => ({ date: t._id, value: roundMoney(t.amount) })),
      columns: [
        { key: 'method', label: 'Payment Method' },
        { key: 'amount', label: 'Amount' },
        { key: 'count', label: 'Count' },
      ],
      rows: methodRows,
    };
  }
}

export default BillingAnalyticsService;
