import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { Card, CardTitle, CardSubtitle, EmptyState, IconBadge, StatusPill } from '../components/Card';
import { SkeletonList } from '../components/Skeleton';
import { DependentBanner } from '../components/DependentBanner';
import { patientApi } from '../api/patientApi';
import { useDependents } from '../context/DependentsContext';
import { colors, radii } from '../theme/colors';

const STATUS_LABEL = {
  DRAFT: 'Draft',
  RECOMMENDED: 'Recommended',
  APPROVED: 'Approved',
  ACCEPTED: 'Active',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const STATUS_TONE = {
  DRAFT: 'soft',
  RECOMMENDED: 'info',
  APPROVED: 'info',
  ACCEPTED: 'primary',
  IN_PROGRESS: 'primary',
  COMPLETED: 'success',
  CANCELLED: 'soft',
};

/** Package progress and upcoming sessions — internal cost/margin never shown (§10.4). */
export default function TreatmentsScreen() {
  const { t } = useTranslation();
  const { activeProfile, isViewingDependent } = useDependents();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      // Dependent-aware (Task #33) — mirrors HomeScreen.js so a guardian "acting as" a
      // dependent sees that dependent's treatment plans, not their own.
      const result = isViewingDependent
        ? await patientApi.dependentTreatmentPlans(activeProfile.id)
        : await patientApi.listTreatmentPlans();
      setPlans(Array.isArray(result) ? result : result.items || []);
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
      <Screen title={t('treatments.title')} subtitle={t('treatments.subtitle')}>
        <SkeletonList />
      </Screen>
    );
  }

  if (plans.length === 0) {
    return (
      <Screen title={t('treatments.title')} subtitle={t('treatments.subtitle')} onRefresh={onRefresh} refreshing={refreshing}>
        {isViewingDependent && <DependentBanner name={activeProfile.fullName} />}
        <EmptyState title={t('common.noResults')} />
      </Screen>
    );
  }

  return (
    <Screen title={t('treatments.title')} subtitle={t('treatments.subtitle')} onRefresh={onRefresh} refreshing={refreshing}>
      {isViewingDependent && <DependentBanner name={activeProfile.fullName} />}
      {plans.map((plan) => {
        const pkg = plan.packageSnapshot;
        const total = pkg?.maximumSessions ?? null;
        const remaining = pkg?.unusedSessions ?? null;
        const done = total != null && remaining != null ? total - remaining : null;
        const progress = total ? Math.min(1, Math.max(0, (done ?? 0) / total)) : null;

        return (
          <Card key={plan.id}>
            <View style={styles.row}>
              <IconBadge tone={STATUS_TONE[plan.status] === 'soft' ? 'soft' : 'accent'} size={44}>
                <Sparkles />
              </IconBadge>
              <View style={styles.flex}>
                <CardTitle>{plan.title || plan.planNumber}</CardTitle>
                {pkg?.packageName ? <CardSubtitle>{pkg.packageName}</CardSubtitle> : null}
              </View>
            </View>

            <StatusPill label={STATUS_LABEL[plan.status] || plan.status} tone={STATUS_TONE[plan.status]} />

            {total != null && (
              <View style={styles.progressBlock}>
                <View style={styles.progressRow}>
                  <Text style={styles.progressLabel}>{t('treatments.sessionsUsed', 'Sessions used')}</Text>
                  <Text style={styles.progressValue}>{done ?? 0}/{total}</Text>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${(progress ?? 0) * 100}%` }]} />
                </View>
              </View>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  flex: { flex: 1 },
  progressBlock: { gap: 6, marginTop: 2 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 12.5, color: colors.mutedForeground, fontWeight: '600' },
  progressValue: { fontSize: 12.5, color: colors.foreground, fontWeight: '700' },
  track: { height: 8, borderRadius: radii.pill, backgroundColor: colors.muted, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radii.pill, backgroundColor: colors.primary },
});
