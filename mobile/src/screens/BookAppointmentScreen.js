import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Stethoscope, Clock, CheckCircle2, CalendarPlus } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { Card, CardTitle, CardSubtitle, IconBadge, EmptyState } from '../components/Card';
import { Button } from '../components/Button';
import { DependentBanner } from '../components/DependentBanner';
import { patientApi } from '../api/patientApi';
import { useDependents } from '../context/DependentsContext';
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

/** APP booking flow — pick a doctor (from the patient's own visit history, no staff-only
 *  doctor directory is exposed to the patient API), a date, then an open slot. */
export default function BookAppointmentScreen({ navigation }) {
  const { t } = useTranslation();
  const { activeProfile, isViewingDependent } = useDependents();
  const days = useMemo(() => nextDays(14), []);

  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState(days[0]);
  const [slotsResult, setSlotsResult] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [booking, setBooking] = useState(false);

  // "Can't find a good time? Request a specific time" — a custom-time request that goes to
  // the clinic as Pending Approval instead of an instantly-bookable slot (spec: "Custom/
  // unavailable time → [Request] → Pending Approval → doctor/branch accepts/proposes
  // alternative/rejects → patient notified"). Deliberately not tied to the slot grid above —
  // no date/time picker library is installed here, so it's a plain text entry, same pattern as
  // other free-text inputs in this app (e.g. SettingsScreen's privacy request details field).
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestDate, setRequestDate] = useState('');
  const [requestTime, setRequestTime] = useState('');
  const [requestNotes, setRequestNotes] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Dependent-aware (Task #33) — when booking on behalf of a dependent, base the
        // doctor list on the dependent's own visit history, not the guardian's.
        const result = isViewingDependent
          ? await patientApi.dependentAppointments(activeProfile.id)
          : await patientApi.listAppointments();
        const items = Array.isArray(result) ? result : result.items || [];
        const seen = new Map();
        items.forEach((appt) => {
          if (appt.doctor?.id && !seen.has(appt.doctor.id)) {
            seen.set(appt.doctor.id, {
              id: appt.doctor.id,
              name: appt.doctor.name || appt.doctor.doctorCode,
              specialization: appt.doctor.specialization,
              branchId: appt.branch?.id || appt.branchId || null,
            });
          }
        });
        setDoctors(Array.from(seen.values()));
      } catch (err) {
        Alert.alert(t('app.name'), err?.response?.data?.message || 'Could not load doctors.');
      } finally {
        setLoadingDoctors(false);
      }
    })();
  }, [t, isViewingDependent, activeProfile]);

  const loadSlots = useCallback(async (doctor, date) => {
    if (!doctor || !date) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    try {
      const params = { doctorId: doctor.id, date: toIsoDate(date) };
      if (doctor.branchId) params.branchId = doctor.branchId;
      const result = await patientApi.availableSlots(params);
      setSlotsResult(result);
    } catch (err) {
      Alert.alert(t('app.name'), err?.response?.data?.message || 'Could not load available slots.');
      setSlotsResult(null);
    } finally {
      setLoadingSlots(false);
    }
  }, [t]);

  useEffect(() => {
    if (selectedDoctor) loadSlots(selectedDoctor, selectedDate);
  }, [selectedDoctor, selectedDate, loadSlots]);

  const onConfirm = async () => {
    if (!selectedDoctor || !selectedSlot) return;
    setBooking(true);
    try {
      const payload = {
        doctorId: selectedDoctor.id,
        appointmentDate: toIsoDate(selectedDate),
        startTime: selectedSlot.start,
        endTime: selectedSlot.end,
      };
      if (selectedDoctor.branchId) payload.branchId = selectedDoctor.branchId;
      // Dependent-aware (Task #33) — books on the active dependent's record so a guardian
      // "acting as" a dependent never silently books an appointment for themselves instead.
      if (isViewingDependent) {
        await patientApi.bookDependentAppointment(activeProfile.id, payload);
      } else {
        await patientApi.bookAppointment(payload);
      }
      Alert.alert(t('appointments.bookingConfirmed'), '', [
        { text: t('common.confirm'), onPress: () => navigation.navigate('AppointmentsList') },
      ]);
    } catch (err) {
      Alert.alert(t('app.name'), err?.response?.data?.message || 'Could not book this appointment.');
    } finally {
      setBooking(false);
    }
  };

  const onSubmitCustomRequest = async () => {
    if (!selectedDoctor || !requestDate.trim() || !requestTime.trim()) return;
    setSubmittingRequest(true);
    try {
      const payload = {
        doctorId: selectedDoctor.id,
        appointmentDate: requestDate.trim(),
        startTime: requestTime.trim(),
        endTime: requestTime.trim(),
        notes: requestNotes.trim() || undefined,
        // APT-003 — tells AppointmentService.create() to hold this as Pending Approval instead
        // of validating/claiming it against the computed open-slot grid (see
        // backend/src/services/AppointmentService.js and patientPortal.validator.js).
        requiresApproval: true,
      };
      if (selectedDoctor.branchId) payload.branchId = selectedDoctor.branchId;
      if (isViewingDependent) {
        await patientApi.bookDependentAppointment(activeProfile.id, payload);
      } else {
        await patientApi.bookAppointment(payload);
      }
      Alert.alert(t('app.name'), t('appointments.requestSubmitted'), [
        { text: t('common.confirm'), onPress: () => navigation.navigate('AppointmentsList') },
      ]);
      setShowRequestForm(false);
      setRequestDate('');
      setRequestTime('');
      setRequestNotes('');
    } catch (err) {
      Alert.alert(t('app.name'), err?.response?.data?.message || 'Could not submit this request.');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const groups = groupSlots(slotsResult?.slots);
  const hasSlots = slotsResult?.available && (slotsResult?.slots || []).length > 0;

  return (
    <Screen>
      {isViewingDependent && <DependentBanner name={activeProfile.fullName} />}
      <Text style={styles.section}>{t('appointments.selectDoctor')}</Text>
      {loadingDoctors ? (
        <ActivityIndicator color={colors.primary} />
      ) : doctors.length === 0 ? (
        <EmptyState title={t('appointments.noDoctors')} icon={<Stethoscope size={28} color={colors.mutedForeground} strokeWidth={1.6} />} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {doctors.map((doctor) => {
            const active = selectedDoctor?.id === doctor.id;
            return (
              <Pressable
                key={doctor.id}
                onPress={() => setSelectedDoctor(doctor)}
                style={[styles.doctorChip, active && styles.doctorChipActive]}
                accessibilityRole="button"
              >
                <IconBadge tone={active ? 'primary' : 'soft'} size={36}><Stethoscope /></IconBadge>
                <View>
                  <Text style={[styles.doctorName, active && styles.doctorNameActive]}>{doctor.name}</Text>
                  {!!doctor.specialization && <Text style={styles.doctorSpec}>{doctor.specialization}</Text>}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {doctors.length > 0 && (
        <>
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
          {!selectedDoctor ? (
            <EmptyState title={t('appointments.chooseDoctorFirst')} icon={<CalendarDays size={28} color={colors.mutedForeground} strokeWidth={1.6} />} />
          ) : loadingSlots ? (
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
        </>
      )}

      {selectedDoctor && (
        <Card style={styles.requestCard}>
          <Pressable
            onPress={() => setShowRequestForm((v) => !v)}
            style={styles.requestToggle}
            accessibilityRole="button"
          >
            <IconBadge tone="soft" size={34}><CalendarPlus /></IconBadge>
            <Text style={styles.requestToggleText}>{t('appointments.requestTime')}</Text>
          </Pressable>

          {showRequestForm && (
            <View style={{ gap: 10, marginTop: 12 }}>
              <Text style={styles.requestHint}>{t('appointments.requestTimeHint')}</Text>

              <Text style={styles.label}>{t('appointments.requestedDate')}</Text>
              <TextInput
                style={styles.requestInput}
                value={requestDate}
                onChangeText={setRequestDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel={t('appointments.requestedDate')}
              />

              <Text style={styles.label}>{t('appointments.requestedTime')}</Text>
              <TextInput
                style={styles.requestInput}
                value={requestTime}
                onChangeText={setRequestTime}
                placeholder="HH:MM"
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel={t('appointments.requestedTime')}
              />

              <Text style={styles.label}>{t('appointments.notes')}</Text>
              <TextInput
                style={[styles.requestInput, styles.requestNotesInput]}
                value={requestNotes}
                onChangeText={setRequestNotes}
                placeholder=""
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={3}
                accessibilityLabel={t('appointments.notes')}
              />

              <Button
                title={t('appointments.submitRequest')}
                onPress={onSubmitCustomRequest}
                loading={submittingRequest}
                disabled={!requestDate.trim() || !requestTime.trim()}
              />
            </View>
          )}
        </Card>
      )}

      {selectedSlot && (
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <IconBadge tone="success" size={44}><CheckCircle2 /></IconBadge>
            <View style={{ flex: 1 }}>
              <CardTitle>{selectedDoctor?.name}</CardTitle>
              <CardSubtitle>
                {selectedDate.toDateString()} · {selectedSlot.start}–{selectedSlot.end}
              </CardSubtitle>
            </View>
          </View>
          <Button title={t('appointments.confirmBooking')} onPress={onConfirm} loading={booking} />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 12.5, fontWeight: '700', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 6 },
  chipRow: { gap: 10, paddingVertical: 4 },
  doctorChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.card, borderRadius: radii.lg, padding: 10, paddingRight: 16,
    borderWidth: 1.5, borderColor: colors.border, ...shadow.card,
  },
  doctorChipActive: { borderColor: colors.primary, backgroundColor: colors.successSoft },
  doctorName: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  doctorNameActive: { color: colors.primary },
  doctorSpec: { fontSize: 12, color: colors.mutedForeground, marginTop: 1 },
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
  requestCard: { gap: 4 },
  requestToggle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  requestToggleText: { fontSize: 14, fontWeight: '700', color: colors.primary, flex: 1 },
  requestHint: { fontSize: 13, color: colors.mutedForeground, lineHeight: 18 },
  label: { fontSize: 12.5, fontWeight: '600', color: colors.foreground },
  requestInput: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.foreground,
  },
  requestNotesInput: { height: 80, paddingTop: 10, textAlignVertical: 'top' },
});
