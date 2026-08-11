import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Share } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Gift, Users } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { Card, CardTitle, CardSubtitle, EmptyState, IconBadge, StatusPill } from '../components/Card';
import { Button } from '../components/Button';
import { SkeletonList } from '../components/Skeleton';
import { patientApi } from '../api/patientApi';
import { colors } from '../theme/colors';

/**
 * LOY Flow C — patient-facing "refer & earn" screen. View-only balance/status, same as
 * RewardsScreen: sharing is the only action here, redemption still only happens at the clinic
 * billing desk. The referral list intentionally shows only first-name-or-initial + a generic
 * status label per referee (never clinical/financial detail) — that redaction is enforced
 * server-side by ReferralService.myReferrals / PatientPortalService.referralSummary.
 */
const STATUS_TONE = {
  PENDING: 'soft',
  QUALIFIED: 'warning',
  CREDITED: 'success',
  BLOCKED_SELF_REFERRAL: 'destructive',
  BLOCKED_DUPLICATE_DEVICE: 'destructive',
  BLOCKED_MONTHLY_CAP: 'destructive',
};

function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function ReferralScreen() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await patientApi.referral();
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onShare = async () => {
    if (!data?.referralCode) return;
    try {
      await Share.share({
        message: t('referral.shareMessage', { code: data.referralCode, link: data.shareUrl || data.referralCode }),
      });
    } catch {
      // user cancelled or share sheet unavailable — nothing to do
    }
  };

  if (loading) {
    return (
      <Screen title={t('referral.title')} subtitle={t('referral.subtitle')}>
        <SkeletonList />
      </Screen>
    );
  }

  if (!data?.referralCode) {
    return (
      <Screen title={t('referral.title')} subtitle={t('referral.subtitle')} onRefresh={onRefresh} refreshing={refreshing}>
        <EmptyState title={t('rewards.programDisabled')} icon={<Gift size={28} color={colors.mutedForeground} strokeWidth={1.6} />} />
      </Screen>
    );
  }

  const referrals = data.referrals || [];
  const creditedCount = referrals.filter((r) => r.status === 'CREDITED').length;

  return (
    <Screen title={t('referral.title')} subtitle={t('referral.subtitle')} onRefresh={onRefresh} refreshing={refreshing}>
      <Card style={styles.codeCard}>
        <View style={styles.codeRow}>
          <View style={styles.flex}>
            <CardSubtitle>{t('referral.yourCode')}</CardSubtitle>
            <Text style={styles.code}>{data.referralCode}</Text>
          </View>
          <IconBadge tone="accent" size={48}><Gift /></IconBadge>
        </View>
        <Button title={t('referral.share')} onPress={onShare} />
        <Text style={styles.howItWorks}>{t('referral.howItWorks')}</Text>
      </Card>

      <View style={styles.statementHeader}>
        <Text style={styles.section}>{t('referral.yourReferrals')}</Text>
      </View>

      {referrals.length === 0 ? (
        <EmptyState title={t('referral.noReferrals')} icon={<Users size={28} color={colors.mutedForeground} strokeWidth={1.6} />} />
      ) : (
        referrals.map((r) => (
          <Card key={r.id} style={styles.referralCard}>
            <View style={styles.referralRow}>
              <View style={styles.flex}>
                <CardTitle style={styles.referralName}>
                  {r.refereeFirstName || t('referral.someoneJoined')}
                </CardTitle>
                <Text style={styles.referralDate}>{formatDate(r.createdAt)}</Text>
              </View>
              <StatusPill label={t(`referral.status.${r.status}`, r.status)} tone={STATUS_TONE[r.status] || 'soft'} />
            </View>
          </Card>
        ))
      )}

      {creditedCount > 0 && (
        <Text style={styles.footerNote}>
          {t('referral.someoneJoined')}: {creditedCount}
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  codeCard: { gap: 12 },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontSize: 24, fontWeight: '800', color: colors.foreground, marginTop: 2, letterSpacing: 1 },
  howItWorks: { fontSize: 12.5, color: colors.mutedForeground, lineHeight: 18 },
  statementHeader: { marginTop: 6 },
  section: { fontSize: 12.5, fontWeight: '700', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.4 },
  referralCard: {},
  referralRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  referralName: { fontSize: 14.5 },
  referralDate: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  footerNote: { fontSize: 12.5, color: colors.mutedForeground, textAlign: 'center', marginTop: 4 },
});
