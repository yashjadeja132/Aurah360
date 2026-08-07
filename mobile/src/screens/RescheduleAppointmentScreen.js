import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Clock, CheckCircle2 } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { Card, CardTitle, CardSubtitle, IconBadge, EmptyState } from '../components/Card';
import { Button } from '../components/Button';
import { patientApi } from '../api/patientApi';
import { colors, radii, shadow } from '../theme/colors';

function nextDays(count) {
  const days = [];
  const now = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    days.push(d);
  }
  return days;
}

function toIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function groupSlots(slots) {
  const groups = { morning: [], afternoon: [], evening: [] };
  (slots || []).forEach((slot) => {
    const hour = Number((slot.start || '').split(':')[0]);
    if (hour < 12) groups.morning.push(slot);
    else if (hour < 17) groups.afternoon.push(slot);
    else groups.evening.push(slot);
  });
  return groups;
}

/** Reschedules an existing appointment — same doctor, a newly picked date + slot. */
export default function RescheduleAppointmentScreen({ navigation, route }) {
  const { t } = useTranslation();
  const appointment = route.params?.appointment;
  const days = useMemo(() => nextDays(14), []);
  const doctorId = appointment?.doctor?.id || appointment?.doctorId;
  const branchId = appointment?.branch?.id || appointment?.branchId;

  const [selectedDate, setSelectedDate] = useState(days[0]);
  const [slotsResult, setSlotsResult] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadSlots = useCallback(async (date) => {
    if (!doctorId || !date) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    try {
      const params = { doctorId, date: toIsoDate(date) };
      if (branchId) params.branchId = branchId;
      const result = await patientApi.availableSlots(params);
      setSlotsResult(result);
    } catch (err) {
      Alert.alert(t('app.name'), err?.response?.data?.message || 'Could not load available slots.');
      setSlotsResult(null);
    } finally {
      setLoadingSlots(false);
    }
  }, [doctorId, branchId, t]);

  useEffect(() => {
    loadSlots(selectedDate);
  }, [selectedDate, loadSlots]);

  const onConfirm = async () => {
    if (!appointment?.id || !selectedSlot) return;
    setSaving(true);
    try {
      const payload = {
        appointmentDate: toIsoDate(selectedDate),
        startTime: selectedSlot.start,
        endTime: selectedSlot.end,
      };
      await patientApi.rescheduleAppointment(appointment.id, payload);
      Alert.alert(t('appointments.rescheduleConfirmed'), '', [
        { text: t('common.confirm'), onPress: () => navigation.navigate('AppointmentsList') },
      ]);
    } catch (err) {
      Alert.alert(t('app.name'), err?.response?.data?.message || 'Could not reschedule this appointment.');
    } finally {
      setSaving(false);
    }
  };

  if (!appointment || !doctorId) {
    return (
      <Screen>
        <EmptyState title={t('common.noResults')} />
      </Screen>
    );
  }

  const groups = groupSlots(slotsResult?.slots);
  const hasSlots = slotsResult?.available && (slotsResult?.slots || []).length > 0;

  return (
    <Screen>
      <Card>
        <CardSubtitle>{t('appointments.currentAppointment')}</CardSubtitle>
        <CardTitle>{appointment.doctor?.name || appointment.appointmentType}</CardTitle>
        <CardSubtitle>
          {new Date(appointment.appointmentDate).toDateString()} · {appointment.startTime}–{appointment.endTime}
        </CardSubtitle>
      </Card>

      <Text style={styles.section}>{t('appointments.selectDate')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {days.map((day) => {
          const active = toIsoDate(day) === toIsoDate(selectedDate);
          return (
            <Pressable
              key={toIsoDate(day)}
              onPress={() => setSelectedDate(day)}
              style={[styles.dateChip, active && styles.dateChipActive]}
              accessibilityRole="button"
            >
              <Text style={[styles.dateWeekday, active && styles.dateTextActive]}>
                {day.toLocaleDateString(undefined, { weekday: 'short' })}
              </Text>
              <Text style={[styles.dateNum, active && styles.dateTextActive]}>{day.getDate()}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.section}>{t('appointments.selectSlot')}</Text>
      {loadingSlots ? (
        <ActivityIndicator color={colors.primary} />
      ) : !hasSlots ? (
        <EmptyState title={t('appointments.noSlots')} icon={<Clock size={28} color={colors.mutedForeground} strokeWidth={1.6} />} />
      ) : (
        ['morning', 'afternoon', 'evening'].map((groupKey) =>
          groups[groupKey].length > 0 ? (
            <View key={groupKey} style={styles.slotGroup}>
              <CardSubtitle style={styles.groupLabel}>{t(`appointments.${groupKey}`)}</CardSubtitle>
              <View style={styles.slotWrap}>
                {groups[groupKey].map((slot) => {
                  const active = selectedSlot?.start === slot.start;
                  return (
                    <Pressable
                      key={slot.start}
                      onPress={() => setSelectedSlot(slot)}
                      style={[styles.slotChip, active && styles.slotChipActive]}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.slotText, active && styles.slotTextActive]}>{slot.start}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null
        )
      )}

      {selectedSlot && (
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <IconBadge tone="success" size={44}><CheckCircle2 /></IconBadge>
            <View style={{ flex: 1 }}>
              <CardTitle>{t('appointments.newTime')}</CardTitle>
              <CardSubtitle>
                {selectedDate.toDateString()} · {selectedSlot.start}–{selectedSlot.end}
              </CardSubtitle>
            </View>
          </View>
          <Button title={t('appointments.reschedule')} onPress={onConfirm} loading={saving} />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 12.5, fontWeight: '700', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 6 },
  chipRow: { gap: 10, paddingVertical: 4 },
  dateChip: {
    width: 56, alignItems: 'center', gap: 2, paddingVertical: 12,
    backgroundColor: colors.card, borderRadius: radii.md,
    borderWidth: 1.5, borderColor: colors.border,
  },
  dateChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dateWeekday: { fontSize: 11.5, fontWeight: '600', color: colors.mutedForeground },
  dateNum: { fontSize: 17, fontWeight: '800', color: colors.foreground },
  dateTextActive: { color: colors.primaryForeground },
  slotGroup: { gap: 8 },
  groupLabel: { textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: '700', fontSize: 11.5 },
  slotWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: radii.pill,
    backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border,
  },
  slotChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  slotText: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  slotTextActive: { color: colors.primaryForeground },
  summaryCard: { gap: 14 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
