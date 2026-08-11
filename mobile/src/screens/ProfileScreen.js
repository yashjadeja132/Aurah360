import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Users, Check, Settings as SettingsIcon, ChevronRight,
  History, FileText, Bell, Gift, Sparkle,
} from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { Card, CardTitle, IconBadge } from '../components/Card';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { useDependents } from '../context/DependentsContext';
import { useAppLock } from '../context/AppLockContext';
import { useNotificationsBadge } from '../context/NotificationsBadgeContext';
import { colors, radii, shadow } from '../theme/colors';

function initials(first, last) {
  return `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase() || '🙂';
}

/** Root of the last tab — identity, dependents, and every other "More"-style destination
 *  (timeline/documents/inbox/offers/settings) live here as quick links, rather than behind a
 *  separate generic menu screen. */
export default function ProfileScreen({ navigation }) {
  const { t } = useTranslation();
  const { patient, logout } = useAuth();
  const { dependents, activeProfile, setActiveProfile } = useDependents();
  const { lock } = useAppLock();
  const { unreadCount } = useNotificationsBadge();
  const insets = useSafeAreaInsets();
  const [loggingOut, setLoggingOut] = useState(false);

  const onLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      lock(); // re-lock so the next session that logs in starts from a locked state if a PIN is set
    } finally {
      setLoggingOut(false);
    }
  };

  const menuItems = [
    { label: t('timeline.title'), screen: 'Timeline', icon: History, tone: 'primary' },
    { label: t('documents.title'), screen: 'Documents', icon: FileText, tone: 'info' },
    { label: t('rewards.title'), screen: 'Rewards', icon: Sparkle, tone: 'accent' },
    { label: t('notifications.title'), screen: 'Notifications', icon: Bell, tone: 'accent', badge: unreadCount },
    { label: t('offers.title'), screen: 'Offers', icon: Gift, tone: 'success' },
    { label: t('settings.title'), screen: 'Settings', icon: SettingsIcon, tone: 'soft' },
  ];

  return (
    <Screen noTopPadding edges={['bottom']} style={styles.screenPad}>
      <View style={[styles.hero, { paddingTop: insets.top + 20 }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(patient?.firstName, patient?.lastName)}</Text>
        </View>
        <Text style={styles.name}>{patient?.firstName} {patient?.lastName}</Text>
        <Text style={styles.meta}>{patient?.mobile}</Text>
        <View style={styles.mrnChip}>
          <Text style={styles.mrnText}>MRN {patient?.mrn}</Text>
        </View>
      </View>

      <View style={styles.body}>
        {dependents.length > 0 && (
          <Card>
            <View style={styles.cardHeader}>
              <IconBadge tone="soft" size={38}><Users /></IconBadge>
              <CardTitle>{t('profile.switchProfile')}</CardTitle>
            </View>
            <View style={{ gap: 6 }}>
              <Pressable
                style={styles.profileRow}
                onPress={() => setActiveProfile('self')}
                accessibilityRole="button"
              >
                <Text style={styles.profileRowName}>{t('profile.myself')}</Text>
                {activeProfile === 'self' && <Check size={18} color={colors.primary} strokeWidth={2.4} />}
              </Pressable>
              {dependents.map((dep) => {
                const isActive = activeProfile !== 'self' && activeProfile?.id === dep.id;
                return (
                  <Pressable
                    key={dep.id}
                    style={styles.profileRow}
                    onPress={() => setActiveProfile(dep)}
                    accessibilityRole="button"
                  >
                    <View>
                      <Text style={styles.profileRowName}>{dep.fullName}</Text>
                      {dep.relationship ? (
                        <Text style={styles.profileRowMeta}>{dep.relationship}</Text>
                      ) : null}
                    </View>
                    {isActive && <Check size={18} color={colors.primary} strokeWidth={2.4} />}
                  </Pressable>
                );
              })}
            </View>
          </Card>
        )}

        <View style={styles.menuList}>
          {menuItems.map((item) => (
            <Pressable
              key={item.screen}
              style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
              onPress={() => navigation.navigate(item.screen)}
              accessibilityRole="button"
            >
              <IconBadge tone={item.tone} size={44}><item.icon /></IconBadge>
              <Text style={styles.menuLabel}>{item.label}</Text>
              {item.badge > 0 && (
                <View style={styles.menuBadge}>
                  <Text style={styles.menuBadgeText}>{item.badge}</Text>
                </View>
              )}
              <ChevronRight size={20} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </View>

        <Button title={t('common.logout')} variant="destructive" onPress={onLogout} loading={loggingOut} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    paddingBottom: 28,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
    gap: 6,
  },
  avatar: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    marginBottom: 6,
  },
  avatarText: { color: colors.primaryForeground, fontWeight: '800', fontSize: 24 },
  name: { color: colors.primaryForeground, fontSize: 19, fontWeight: '800' },
  meta: { color: 'rgba(250,246,239,0.75)', fontSize: 13.5 },
  mrnChip: {
    marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  mrnText: { color: colors.primaryForeground, fontSize: 12, fontWeight: '700' },
  screenPad: { paddingHorizontal: 0 },
  body: { paddingHorizontal: 20, paddingVertical: 20, gap: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  profileRowName: { fontSize: 14.5, fontWeight: '700', color: colors.foreground },
  profileRowMeta: { fontSize: 12.5, color: colors.mutedForeground, marginTop: 1 },
  menuList: { gap: 10 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 14,
    ...shadow.card,
  },
  menuRowPressed: { opacity: 0.8 },
  menuLabel: { flex: 1, fontSize: 15.5, fontWeight: '700', color: colors.foreground },
  menuBadge: {
    minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
    backgroundColor: colors.destructive, alignItems: 'center', justifyContent: 'center',
  },
  menuBadgeText: { color: colors.white, fontSize: 12, fontWeight: '800' },
});
