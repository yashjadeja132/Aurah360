import Lead from '../../models/Lead.model.js';
import CrmService from '../CrmService.js';
import { parseReportFilters, pct } from '../../helpers/reportFilters.helper.js';

/** Reuses CrmService.reports() — no duplicated CRM business logic. */
class CrmAnalyticsService {
  constructor() {
    this.crmService = new CrmService();
  }

  async report(query = {}) {
    const filters = parseReportFilters(query);
    const branchId = filters.branchId?.toString?.() || null;
    const crmQuery = {
      branchId: branchId || undefined,
      leadSource: filters.leadSource || query.leadSource,
    };

    const [source, conversion, counsellor, lost] = await Promise.all([
      this.crmService.reports('source', crmQuery),
      this.crmService.reports('conversion', crmQuery),
      this.crmService.reports('counsellor', crmQuery),
      this.crmService.reports('lost-reasons', crmQuery).catch(() => ({ items: [] })),
    ]);

    const followUp = await Lead.aggregate([
      {
        $match: {
          deletedAt: null,
          ...(filters.branchId ? { branchId: filters.branchId } : {}),
          status: { $nin: ['WON', 'LOST', 'JUNK'] },
        },
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$nextFollowUp', null] },
              'NO_FOLLOW_UP',
              {
                $cond: [{ $lt: ['$nextFollowUp', new Date()] }, 'OVERDUE', 'SCHEDULED'],
              },
            ],
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const campaign = await Lead.aggregate([
      {
        $match: {
          deletedAt: null,
          ...(filters.branchId ? { branchId: filters.branchId } : {}),
          campaign: { $nin: [null, ''] },
        },
      },
      {
        $group: {
          _id: '$campaign',
          total: { $sum: 1 },
          won: { $sum: { $cond: [{ $eq: ['$status', 'WON'] }, 1, 0] } },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 15 },
    ]);

    const sourceRows = (source.items || []).map((s) => ({
      source: s.source,
      total: s.total,
      won: s.won,
      conversionPercent: s.conversionPercent,
    }));

    return {
      category: 'crm',
      filters,
      summary: {
        totalLeads: conversion.total || 0,
        won: conversion.won || 0,
        conversionRate: conversion.conversionPercent || 0,
      },
      leadSources: sourceRows,
      counsellorPerformance: counsellor.items || [],
      followUpStatus: followUp.map((f) => ({ status: f._id, count: f.count })),
      campaignPerformance: campaign.map((c) => ({
        campaign: c._id,
        total: c.total,
        won: c.won,
        conversionPercent: pct(c.won, c.total),
      })),
      lostReasons: lost.items || [],
      referralPerformance: sourceRows.filter((s) =>
        /refer/i.test(String(s.source || ''))
      ),
      columns: [
        { key: 'source', label: 'Lead Source' },
        { key: 'total', label: 'Total' },
        { key: 'won', label: 'Won' },
        { key: 'conversionPercent', label: 'Conversion %' },
      ],
      rows: sourceRows,
    };
  }
}

export default CrmAnalyticsService;
