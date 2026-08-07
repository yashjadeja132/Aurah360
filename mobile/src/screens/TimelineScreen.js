import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Stethoscope, Pill } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { Card, CardTitle, CardSubtitle, IconBadge, StatusPill, EmptyState } from '../components/Card';
import { SkeletonList } from '../components/Skeleton';
import { DependentBanner } from '../components/DependentBanner';
import { patientApi } from '../api/patientApi';
import { useDependents } from '../context/DependentsContext';
import { colors, radii } from '../theme/colors';

/** §13.2 — health timeline is built ONLY from safely-released data:
 *  - `/timeline` events (consultation started/signed, etc.) — lightweight title/description,
 *    never raw SOAP/diagnosis/photos, so safe to show as-is.
 *  - `/prescriptions` — medicines are always visible to the owning patient once issued (no
 *    release gate applies to prescriptions).
 *  We deliberately do NOT call `/consultations` or drill into a consultation detail screen:
 *  that endpoint returns the full clinical record (SOAP/diagnosis/examination/photos) with no
 *  filter on doctor release status, so it isn't safe to surface in the app yet. */

const FILTERS = ['all', 'consultations', 'prescriptions'];

function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

const STATUS_TONE = {
  DRAFT: 'soft',
  FINALIZED: 'success',
  CANCELLED: 'destructive',
};

export default function TimelineScreen() {
  const { t } = useTranslation();
  const { activeProfile, isViewingDependent } = useDependents();
  const [events, setEvents] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      // Dependent-aware (Task #33 follow-up) — mirrors every other list screen so a guardian
      // "acting as" a dependent sees that dependent's timeline, not their own (§13.2).
      const [timelineResult, prescriptionResult] = await Promise.all([
        isViewingDependent ? patientApi.dependentTimeline(activeProfile.id) : patientApi.timeline(),
        isViewingDependent ? patientApi.dependentPrescriptions(activeProfile.id) : patientApi.listPrescriptions(),
      ]);
      const timelineItems = Array.isArray(timelineResult)
        ? timelineResult
        : timelineResult?.items || [];
      const rxItems = Array.isArray(prescriptionResult)
        ? prescriptionResult
        : prescriptionResult?.items || [];
      setEvents(timelineItems);
      setPrescriptions(rxItems);
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

  const consultationEntries = events
    .filter((e) => String(e.eventType || '').startsWith('CONSULTATION_'))
    .map((e) => ({
      kind: 'consultation',
      id: e.id,
      title: e.title,
      subtitle: e.description,
      date: e.occurredAt || e.createdAt,
    }));

  const prescriptionEntries = prescriptions.map((rx) => ({
    kind: 'prescription',
    id: rx.id,
    title: rx.prescriptionNumber,
    subtitle: (rx.items || [])
      .map((item) => item.medicineName)
      .filter(Boolean)
      .join(', '),
    doctor: rx.doctor?.name,
    status: rx.status,
    date: rx.finalizedAt || rx.createdAt,
  }));

  const combined = [...consultationEntries, ...prescriptionEntries].sort(
    (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
  );

  const filtered =
    filter === 'all'
      ? combined
      : filter === 'consultations'
      ? consultationEntries
      : prescriptionEntries;

  if (loading) {
    return (
      <Screen>
        <SkeletonList />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing}>
      {isViewingDependent && <DependentBanner name={activeProfile.fullName} />}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            accessibilityRole="button"
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {t(`timeline.filter.${f}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {filtered.length === 0 ? (
        <EmptyState title={t('common.noResults')} />
      ) : (
        filtered.map((entry) => (
          <Card key={`${entry.kind}-${entry.id}`} style={styles.card}>
            <View style={styles.row}>
              <IconBadge tone={entry.kind === 'consultation' ? 'primary' : 'accent'} size={44}>
                {entry.kind === 'consultation' ? <Stethoscope /> : <Pill />}
              </IconBadge>
              <View style={styles.flex}>
                <CardTitle>
                  {entry.kind === 'consultation' ? entry.title : t('timeline.prescriptionLabel', { number: entry.title })}
                </CardTitle>
                {entry.subtitle ? <CardSubtitle>{entry.subtitle}</CardSubtitle> : null}
                <Text style={styles.meta}>
                  {formatDate(entry.date)}
                  {entry.doctor ? ` · ${t('timeline.with', { name: entry.doctor })}` : ''}
                </Text>
              </View>
            </View>
            {entry.status ? (
              <StatusPill
                label={entry.status}
                tone={STATUS_TONE[entry.status] || 'soft'}
              />
            ) : null}
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.muted,
  },
  filterChipActive: { backgroundColor: colors.primary },
  filterChipText: { fontSize: 13, fontWeight: '700', color: colors.mutedForeground },
  filterChipTextActive: { color: colors.white },
  card: {},
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  flex: { flex: 1 },
  meta: { fontSize: 12, color: colors.mutedForeground, marginTop: 4 },
});
