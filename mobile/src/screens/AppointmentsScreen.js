import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CalendarPlus, Stethoscope, CalendarClock, X } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { Card, CardTitle, CardSubtitle, EmptyState, IconBadge, StatusPill } from '../components/Card';
import { SkeletonList } from '../components/Skeleton';
import { Button } from '../components/Button';
import { DependentBanner } from '../components/DependentBanner';
import { patientApi } from '../api/patientApi';
import { useDependents } from '../context/DependentsContext';
import { colors, shadow } from '../theme/colors';

const STATUS_LABEL = {
  REQUESTED: 'Requested',
  PENDING_APPROVAL: 'Pending approval',
  SCHEDULED: 'Scheduled',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No-show',
  CHECKED_IN: 'Checked in',
};

/** Tone per status — mirrors Card.js's IconBadge tone palette so the pill and the icon
 *  badge read as one coherent color language across the card. */
const STATUS_TONE = {
  REQUESTED: 'info',
  PENDING_APPROVAL: 'warning',
  SCHEDULED: 'primary',
  CONFIRMED: 'success',
  COMPLETED: 'success',
  CANCELLED: 'soft',
  NO_SHOW: 'soft',
  CHECKED_IN: 'accent',
};

const RESCHEDULABLE_STATUSES = ['SCHEDULED', 'CONFIRMED', 'REQUESTED', 'PENDING_APPROVAL'];

export default function AppointmentsScreen({ navigation }) {
  const { t } = useTranslation();
  const { activeProfile, isViewingDependent } = useDependents();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      // Dependent-aware (Task #33) — mirrors HomeScreen.js so a guardian "acting as" a
      // dependent sees that dependent's appointments, not their own.
      const result = isViewingDependent
        ? await patientApi.dependentAppointments(activeProfile.id)
        : await patientApi.listAppointments();
      setAppointments(Array.isArray(result) ? result : result.items || []);
    } catch (err) {
      Alert.alert(t('app.name'), err?.response?.data?.message || 'Could not load appointments.');
    } finally {
      setLoading(false);
    }
  }, [t, isViewingDependent, activeProfile]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onCancel = (appt) => {
    Alert.alert(t('appointments.cancel'), appt.appointmentNumber, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: async () => {
          try {
            await patientApi.cancelAppointment(appt.id, 'Cancelled by patient via app');
            load();
          } catch (err) {
            Alert.alert(t('app.name'), err?.response?.data?.message || 'Could not cancel.');
          }
        },
      },
    ]);
  };

  const onReschedule = (appt) => {
    navigation.navigate('RescheduleAppointment', { appointment: appt });
  };

  const fab = (
    <Pressable
      onPress={() => navigation.navigate('BookAppointment')}
      style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      accessibilityRole="button"
      accessibilityLabel={t('appointments.book')}
    >
      <CalendarPlus size={22} color={colors.primaryForeground} strokeWidth={2.2} />
      <Text style={styles.fabLabel}>{t('appointments.book')}</Text>
    </Pressable>
  );

  if (loading) {
    return (
      <Screen title={t('appointments.title')} subtitle={t('appointments.subtitle')}>
        <SkeletonList />
      </Screen>
    );
  }

  if (appointments.length === 0) {
    return (
      <Screen title={t('appointments.title')} subtitle={t('appointments.subtitle')} onRefresh={onRefresh} refreshing={refreshing} floatingAction={fab}>
        {isViewingDependent && <DependentBanner name={activeProfile.fullName} />}
        <EmptyState title={t('common.noResults')} />
      </Screen>
    );
  }

  return (
    <Screen title={t('appointments.title')} subtitle={t('appointments.subtitle')} onRefresh={onRefresh} refreshing={refreshing} floatingAction={fab}>
      {isViewingDependent && <DependentBanner name={activeProfile.fullName} />}
      {appointments.map((appt) => {
        const canModify = RESCHEDULABLE_STATUSES.includes(appt.status);
        return (
          <Card key={appt.id}>
            <View style={styles.row}>
              <IconBadge tone={STATUS_TONE[appt.status] === 'soft' ? 'soft' : 'primary'} size={44}>
                <Stethoscope />
              </IconBadge>
              <View style={styles.flex}>
                <CardTitle>{appt.service?.name || appt.appointmentType}</CardTitle>
                <View style={styles.dateRow}>
                  <CalendarClock size={13} color={colors.mutedForeground} strokeWidth={2} />
                  <CardSubtitle style={styles.dateText}>
                    {new Date(appt.appointmentDate).toDateString()} · {appt.startTime}–{appt.endTime}
                  </CardSubtitle>
                </View>
              </View>
              <StatusPill label={STATUS_LABEL[appt.status] || appt.status} tone={STATUS_TONE[appt.status]} />
            </View>

            {appt.requiresApproval && (
              <Text style={styles.pending}>{t('appointments.pendingApproval')}</Text>
            )}

            {canModify && (
              <View style={styles.actions}>
                <Button title={t('appointments.reschedule')} variant="outline" style={styles.actionButton} onPress={() => onReschedule(appt)} />
                <Button
                  title={t('common.cancel')}
                  variant="ghost"
                  icon={<X size={16} color={colors.destructive} />}
                  style={styles.cancelButton}
                  textStyle={styles.cancelText}
                  onPress={() => onCancel(appt)}
                />
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
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dateText: { marginTop: 0 },
  metaRow: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  pending: { fontSize: 12, color: colors.warning, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  actionButton: { flex: 1, minHeight: 46 },
  cancelButton: { flex: 1, minHeight: 46, borderWidth: 1.5, borderColor: colors.destructiveSoft, backgroundColor: colors.destructiveSoft },
  cancelText: { color: colors.destructive },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 999,
    ...shadow.floating,
  },
  fabPressed: { opacity: 0.9, transform: [{ scale: 0.97 }] },
  fabLabel: { color: colors.primaryForeground, fontWeight: '700', fontSize: 15 },
});
