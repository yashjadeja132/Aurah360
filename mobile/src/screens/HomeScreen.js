import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDays, FileText, Receipt, Gift, CalendarClock, Hourglass, CheckCircle2, Sparkle, ChevronRight } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { Card, CardTitle, CardSubtitle, IconBadge } from '../components/Card';
import { useAuth } from '../context/AuthContext';
import { useDependents } from '../context/DependentsContext';
import { patientApi } from '../api/patientApi';
import { colors, radii, shadow } from '../theme/colors';

function initials(first, last) {
  return `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase() || '·';
}

// 'Documents' and 'Offers' live inside the "More" tab's nested stack, not as top-level tabs —
// they need `navigation.navigate('More', { screen })` rather than a direct screen-name navigate.
const QUICK_ACTIONS = [
  { key: 'appointments', screen: 'Appointments', icon: CalendarDays, tone: 'primary' },
  { key: 'documents', screen: 'Documents', icon: FileText, tone: 'info', nested: true },
  { key: 'bills', screen: 'Bills', icon: Receipt, tone: 'accent' },
  { key: 'offers', screen: 'Offers', icon: Gift, tone: 'success', nested: true },
];

export default function HomeScreen({ navigation }) {
  const { t } = useTranslation();
  const { patient } = useAuth();
  const { activeProfile, isViewingDependent } = useDependents();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState(null);
  const [loyalty, setLoyalty] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      // Only the dashboard is dependent-aware today (see DependentsContext) — every other
      // screen still reads the signed-in patient's own records regardless of activeProfile.
      const result = isViewingDependent
        ? await patientApi.dependentDashboard(activeProfile.id)
        : await patientApi.dashboard();
      setData(result);
    } catch {
      // Non-fatal — home renders with whatever it has; a vendor/network hiccup never blocks the app.
    }

    try {
      const balance = isViewingDependent
        ? await patientApi.dependentLoyaltyBalance(activeProfile.id)
        : await patientApi.loyaltyBalance();
      setLoyalty(balance);
    } catch {
      // Non-fatal — the loyalty program may be disabled for this clinic, or the request failed;
      // the summary card simply doesn't render rather than blocking the rest of the home screen.
      setLoyalty(null);
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

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing} noTopPadding edges={['bottom']} style={styles.screenPad}>
      <View style={[styles.hero, { paddingTop: insets.top + 16 }]}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroGreeting}>{t('home.welcome', { name: patient?.firstName || '' })}</Text>
            <Text style={styles.heroSub}>{t('app.tagline')}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(patient?.firstName, patient?.lastName)}</Text>
          </View>
        </View>

        {isViewingDependent && (
          <View style={styles.dependentBanner}>
            <Text style={styles.dependentBannerText}>
              {t('home.viewingDependent', { name: activeProfile.fullName })}
            </Text>
          </View>
        )}

        <View style={styles.heroCard}>
          <View style={styles.heroCardRow}>
            <IconBadge tone="soft" size={40}><CalendarClock /></IconBadge>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroCardLabel}>{t('home.nextAppointment')}</Text>
              <Text style={styles.heroCardValue}>
                {data?.nextAppointment
                  ? `${new Date(data.nextAppointment.appointmentDate).toDateString()} · ${data.nextAppointment.startTime}`
                  : t('home.noUpcoming')}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <Card style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View>
              <CardSubtitle>{t('home.outstanding')}</CardSubtitle>
              <Text style={styles.amount}>₹{data?.outstandingBalance ?? 0}</Text>
            </View>
            <IconBadge tone={data?.outstandingBalance > 0 ? 'warning' : 'success'} size={48}>
              {data?.outstandingBalance > 0 ? <Hourglass /> : <CheckCircle2 />}
            </IconBadge>
          </View>
        </Card>

        {loyalty?.programEnabled && (
          <Pressable
            onPress={() => navigation.navigate('More', { screen: 'Rewards' })}
            accessibilityRole="button"
          >
            <Card style={styles.loyaltyCard}>
              <View style={styles.balanceRow}>
                <View>
                  <CardSubtitle>{t('rewards.pointsBalance')}</CardSubtitle>
                  <Text style={styles.amount}>{loyalty?.currentBalance ?? 0}</Text>
                </View>
                <IconBadge tone="accent" size={48}><Sparkle /></IconBadge>
              </View>
              <View style={styles.loyaltyLinkRow}>
                <Text style={styles.loyaltyLinkText}>{t('rewards.viewRewards')}</Text>
                <ChevronRight size={16} color={colors.primary} strokeWidth={2.2} />
              </View>
            </Card>
          </Pressable>
        )}

        <Text style={styles.section}>{t('home.quickActions')}</Text>
        <View style={styles.quickGrid}>
          {QUICK_ACTIONS.map((item) => (
            <Pressable
              key={item.screen}
              style={({ pressed }) => [styles.quickCard, pressed && styles.quickCardPressed]}
              onPress={() =>
                item.nested
                  ? navigation.navigate('More', { screen: item.screen })
                  : navigation.navigate(item.screen)
              }
              accessibilityRole="button"
            >
              <IconBadge tone={item.tone} size={46}><item.icon /></IconBadge>
              <Text style={styles.quickLabel}>{t(`nav.${item.key}`, t(`${item.key}.title`, item.key))}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroGreeting: { fontSize: 22, fontWeight: '800', color: colors.primaryForeground },
  heroSub: { fontSize: 13, color: 'rgba(250,246,239,0.72)', marginTop: 3, maxWidth: 220 },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: { color: colors.primaryForeground, fontWeight: '800', fontSize: 16 },
  dependentBanner: {
    marginTop: 14,
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dependentBannerText: { color: colors.accentForeground, fontSize: 12.5, fontWeight: '700' },
  heroCard: {
    marginTop: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  heroCardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroCardLabel: { color: 'rgba(250,246,239,0.7)', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  heroCardValue: { color: colors.primaryForeground, fontSize: 14.5, fontWeight: '700', marginTop: 2 },
  screenPad: { paddingHorizontal: 0 },
  body: { paddingHorizontal: 20, paddingVertical: 20, gap: 16 },
  balanceCard: {},
  loyaltyCard: {},
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  loyaltyLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  loyaltyLinkText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  amount: { fontSize: 26, fontWeight: '800', color: colors.foreground, marginTop: 2 },
  section: { fontSize: 12.5, fontWeight: '700', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.4 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickCard: {
    width: '47%',
    minHeight: 116,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 18,
    gap: 10,
    justifyContent: 'space-between',
    ...shadow.card,
  },
  quickCardPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  quickLabel: { fontSize: 14.5, fontWeight: '700', color: colors.foreground },
});
