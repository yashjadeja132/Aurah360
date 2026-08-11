import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Sparkle, Gift, Award, ListChecks } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { Card, CardTitle, CardSubtitle, EmptyState, IconBadge, StatusPill } from '../components/Card';
import { SkeletonList } from '../components/Skeleton';
import { DependentBanner } from '../components/DependentBanner';
import { patientApi } from '../api/patientApi';
import { useDependents } from '../context/DependentsContext';
import { colors, radii } from '../theme/colors';

/**
 * §7 — Rewards (Loyalty), VIEW-ONLY. There is deliberately no redeem action anywhere on this
 * screen or in patientApi: redemption only happens at the clinic billing desk (LOY-004). This
 * mirrors the same balance/ledger endpoints already used by HomeScreen's loyalty card and by
 * the staff-side receipt this session, so the backend side of this is already proven out — this
 * screen only had to be built and wired up on the client.
 *
 * "How to earn" intentionally renders from the generic `rewards.earnRules.<code>` i18n table
 * keyed by `ruleCode`, not a live "active rules" list — the patient-portal API has no endpoint
 * that returns the clinic's currently-active earning rules, so a fully rule-engine-generated
 * list is a backend gap (see audit report) and this is the closest safe approximation.
 */
const EARN_RULE_CODES = [
  'VISIT_COMPLETED',
  'SPEND_BASED',
  'TREATMENT_SESSION_COMPLETED',
  'PACKAGE_PURCHASE',
  'REFERRAL_REFERRER',
  'REFERRAL_REFEREE',
  'ON_TIME_FOLLOW_UP',
  'APP_REGISTRATION',
  'REVIEW_SUBMITTED',
  'BIRTHDAY_BONUS',
  'PROFILE_COMPLETION',
];

function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

const ENTRY_TONE = {
  CREDIT: 'success',
  MANUAL_CREDIT: 'success',
  CREDIT_REVERSAL: 'success',
  DEBIT_REDEEM: 'warning',
  DEBIT_EXPIRY: 'destructive',
  DEBIT_CLAWBACK: 'destructive',
  MANUAL_DEBIT: 'destructive',
};

function isCredit(entryType) {
  return entryType === 'CREDIT' || entryType === 'MANUAL_CREDIT' || entryType === 'CREDIT_REVERSAL';
}

export default function RewardsScreen() {
  const { t } = useTranslation();
  const { activeProfile, isViewingDependent } = useDependents();
  const [balance, setBalance] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [balanceResult, ledgerResult] = await Promise.all([
        isViewingDependent ? patientApi.dependentLoyaltyBalance(activeProfile.id) : patientApi.loyaltyBalance(),
        isViewingDependent ? patientApi.dependentLoyaltyLedger(activeProfile.id) : patientApi.loyaltyLedger(),
      ]);
      setBalance(balanceResult);
      setLedger(Array.isArray(ledgerResult) ? ledgerResult : ledgerResult?.items || []);
    } catch {
      setBalance(null);
      setLedger([]);
    } finally {
      setLoading(false);
    }
  }, [isViewingDependent, activeProfile]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <Screen title={t('rewards.title')} subtitle={t('rewards.subtitle')}>
        <SkeletonList />
      </Screen>
    );
  }

  if (!balance?.programEnabled) {
    return (
      <Screen title={t('rewards.title')} subtitle={t('rewards.subtitle')} onRefresh={onRefresh} refreshing={refreshing}>
        {isViewingDependent && <DependentBanner name={activeProfile.fullName} />}
        <EmptyState title={t('rewards.programDisabled')} icon={<Gift size={28} color={colors.mutedForeground} strokeWidth={1.6} />} />
      </Screen>
    );
  }

  return (
    <Screen title={t('rewards.title')} subtitle={t('rewards.subtitle')} onRefresh={onRefresh} refreshing={refreshing}>
      {isViewingDependent && <DependentBanner name={activeProfile.fullName} />}

      <Card style={styles.balanceCard}>
        <View style={styles.balanceRow}>
          <View>
            <CardSubtitle>{t('rewards.pointsBalance')}</CardSubtitle>
            <Text style={styles.amount}>{balance?.currentBalance ?? 0}</Text>
          </View>
          <IconBadge tone="accent" size={48}><Sparkle /></IconBadge>
        </View>
        <View style={styles.statRow}>
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>{t('rewards.redeemable')}</Text>
            <Text style={styles.statValue}>{balance?.redeemableBalance ?? 0}</Text>
          </View>
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>{t('rewards.lifetimeEarned')}</Text>
            <Text style={styles.statValue}>{balance?.lifetimeEarned ?? 0}</Text>
          </View>
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>{t('rewards.lifetimeRedeemed')}</Text>
            <Text style={styles.statValue}>{balance?.lifetimeRedeemed ?? 0}</Text>
          </View>
        </View>
        <Text style={styles.expiring}>
          {balance?.nextExpiringLotPoints
            ? t('rewards.nextExpiring', {
                points: balance.nextExpiringLotPoints,
                date: formatDate(balance.nextExpiringLotDate),
              })
            : t('rewards.noExpiring')}
        </Text>
      </Card>

      <Card>
        <View style={styles.cardHeader}>
          <IconBadge tone="soft" size={38}><ListChecks /></IconBadge>
          <CardTitle>{t('rewards.howToEarn')}</CardTitle>
        </View>
        <View style={{ gap: 6 }}>
          {EARN_RULE_CODES.map((code) => (
            <Text key={code} style={styles.earnRow}>
              • {t(`rewards.earnRules.${code}`)}
            </Text>
          ))}
        </View>
      </Card>

      <Card>
        <View style={styles.cardHeader}>
          <IconBadge tone="soft" size={38}><Award /></IconBadge>
          <CardTitle>{t('rewards.howToRedeem')}</CardTitle>
        </View>
        <Text style={styles.redeemNote}>{t('rewards.redeemAtClinic')}</Text>
      </Card>

      <View style={styles.statementHeader}>
        <Text style={styles.section}>{t('statement.title')}</Text>
      </View>
      {ledger.length === 0 ? (
        <EmptyState title={t('common.noResults')} />
      ) : (
        ledger.map((entry) => (
          <Card key={entry.id} style={styles.ledgerCard}>
            <View style={styles.ledgerRow}>
              <View style={styles.flex}>
                <CardTitle style={styles.ledgerType}>{t(`statement.entryTypes.${entry.entryType}`, entry.entryType)}</CardTitle>
                <Text style={styles.ledgerDate}>{formatDate(entry.createdAt)}</Text>
              </View>
              <StatusPill
                label={`${isCredit(entry.entryType) ? '+' : '-'}${Math.abs(entry.points)}`}
                tone={ENTRY_TONE[entry.entryType] || 'soft'}
              />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  balanceCard: { gap: 12 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amount: { fontSize: 28, fontWeight: '800', color: colors.foreground, marginTop: 2 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statCol: { alignItems: 'flex-start' },
  statLabel: { fontSize: 11.5, color: colors.mutedForeground, fontWeight: '600' },
  statValue: { fontSize: 16, fontWeight: '800', color: colors.foreground, marginTop: 2 },
  expiring: { fontSize: 12.5, color: colors.mutedForeground },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  earnRow: { fontSize: 13.5, color: colors.foreground },
  redeemNote: { fontSize: 13.5, color: colors.mutedForeground, lineHeight: 19 },
  statementHeader: { marginTop: 6 },
  section: { fontSize: 12.5, fontWeight: '700', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.4 },
  ledgerCard: {},
  ledgerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  ledgerType: { fontSize: 14.5 },
  ledgerDate: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  radiiUnused: { borderRadius: radii.pill },
});
