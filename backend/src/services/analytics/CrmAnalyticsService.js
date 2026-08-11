import Lead from '../../models/Lead.model.js';
import Referral, { REFERRAL_STATUS } from '../../models/Referral.model.js';
import LoyaltyLedgerEntry from '../../models/LoyaltyLedgerEntry.model.js';
import CrmService from '../CrmService.js';
import { parseReportFilters, pct } from '../../helpers/reportFilters.helper.js';
import { LOYALTY_EARNING_EVENT, LOYALTY_SOURCE_REF_TYPE } from '../../enums/loyalty.js';

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
      referralPerformance: await this.#referralPerformance(filters),
      columns: [
        { key: 'source', label: 'Lead Source' },
        { key: 'total', label: 'Total' },
        { key: 'won', label: 'Won' },
        { key: 'conversionPercent', label: 'Conversion %' },
      ],
      rows: sourceRows,
    };
  }

  /**
   * LOY Flow C — real referral report replacing the previous fake `sourceRows.filter(source
   * matches /refer/i)` heuristic (that matched Lead.source text, which has nothing to do with
   * the actual Referral tracking model this task introduces).
   *
   * Referrer leaderboard: top referrers by CREDITED referral count + points credited to them
   * (REFERRAL_REFERRER ledger entries keyed by sourceRefType=REFERRAL/sourceRefId=referral._id —
   * same join key ReferralService uses when crediting).
   *
   * GAP: referral-CAC-vs-ad-CAC comparison is NOT computed. This CRM module has no ad-spend
   * figure anywhere (Lead/campaign records carry no cost field) to divide by a referral count to
   * get a comparable CAC — fabricating one would be a made-up number, so it is omitted rather
   * than guessed. `adSpendCacComparison: null` marks this explicitly rather than silently
   * dropping the key.
   */
  async #referralPerformance(filters) {
    // Referral.model.js has no soft-delete field; branch-scope via the (optional) branchId it does carry.
    const match = {};
    if (filters.branchId) match.branchId = filters.branchId;

    const [leaderboard, totals] = await Promise.all([
      Referral.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$referrerPatientId',
            totalReferrals: { $sum: 1 },
            creditedReferrals: {
              $sum: { $cond: [{ $eq: ['$status', REFERRAL_STATUS.CREDITED] }, 1, 0] },
            },
          },
        },
        { $sort: { creditedReferrals: -1, totalReferrals: -1 } },
        { $limit: 20 },
        {
          $lookup: {
            from: 'patients',
            localField: '_id',
            foreignField: '_id',
            as: 'patient',
          },
        },
        { $unwind: { path: '$patient', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            referrerPatientId: '$_id',
            referrerName: {
              $trim: {
                input: {
                  $concat: [
                    { $ifNull: ['$patient.firstName', ''] },
                    ' ',
                    { $ifNull: ['$patient.lastName', ''] },
                  ],
                },
              },
            },
            totalReferrals: 1,
            creditedReferrals: 1,
          },
        },
      ]),
      Referral.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const creditedReferralIds = await Referral.find({ ...match, status: REFERRAL_STATUS.CREDITED })
      .select('_id')
      .lean();
    const pointsCredited = creditedReferralIds.length
      ? await LoyaltyLedgerEntry.aggregate([
          {
            $match: {
              sourceRefType: LOYALTY_SOURCE_REF_TYPE.REFERRAL,
              sourceRefId: { $in: creditedReferralIds.map((r) => r._id) },
              ruleCode: { $in: [LOYALTY_EARNING_EVENT.REFERRAL_REFERRER, LOYALTY_EARNING_EVENT.REFERRAL_REFEREE] },
            },
          },
          { $group: { _id: null, totalPoints: { $sum: '$points' } } },
        ])
      : [];

    const byStatus = Object.fromEntries(totals.map((t) => [t._id, t.count]));

    return {
      leaderboard,
      totalReferrals: totals.reduce((sum, t) => sum + t.count, 0),
      convertedReferrals: byStatus[REFERRAL_STATUS.CREDITED] || 0,
      pendingReferrals: byStatus[REFERRAL_STATUS.PENDING] || 0,
      blockedReferrals:
        (byStatus[REFERRAL_STATUS.BLOCKED_SELF_REFERRAL] || 0) +
        (byStatus[REFERRAL_STATUS.BLOCKED_DUPLICATE_DEVICE] || 0) +
        (byStatus[REFERRAL_STATUS.BLOCKED_MONTHLY_CAP] || 0),
      totalPointsCredited: pointsCredited[0]?.totalPoints || 0,
      // Not computed — no ad-spend figure exists anywhere in CRM data to compare against. See
      // method comment above.
      adSpendCacComparison: null,
    };
  }
}

export default CrmAnalyticsService;
