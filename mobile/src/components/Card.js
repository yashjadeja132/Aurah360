import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FolderX } from 'lucide-react-native';
import { colors, radii, shadow } from '../theme/colors';

export function Card({ children, style, flat }) {
  return <View style={[styles.card, !flat && shadow.card, style]}>{children}</View>;
}

export function CardTitle({ children, style }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function CardSubtitle({ children, style }) {
  return <Text style={[styles.subtitle, style]}>{children}</Text>;
}

const TONE_COLORS = {
  primary: colors.primary,
  accent: colors.accent,
  success: colors.success,
  warning: colors.warning,
  info: colors.info,
  soft: colors.muted,
};

/** Icon container — pass a Lucide icon element sized/colored to match the badge tone. */
export function IconBadge({ children, tone = 'primary', size = 44 }) {
  const bg = TONE_COLORS[tone] || colors.primary;
  const fg = tone === 'soft' ? colors.primary : colors.white;

  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      {React.isValidElement(children)
        ? React.cloneElement(children, { size: size * 0.52, color: fg, strokeWidth: 2.1 })
        : children}
    </View>
  );
}

const PILL_TONE = {
  primary: { bg: colors.successSoft, fg: colors.primary },
  success: { bg: colors.successSoft, fg: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  info: { bg: colors.infoSoft, fg: colors.info },
  accent: { bg: colors.accentSoft, fg: colors.accentForeground },
  destructive: { bg: colors.destructiveSoft, fg: colors.destructive },
  soft: { bg: colors.muted, fg: colors.mutedForeground },
};

/** Small rounded status label — shared across Appointments/Treatments/Bills so every
 *  list screen reads the same color language for state (scheduled/paid/due/etc.). */
export function StatusPill({ label, tone = 'soft' }) {
  const t = PILL_TONE[tone] || PILL_TONE.soft;
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      <Text style={[styles.pillText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, icon }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIconWrap}>{icon || <FolderX size={30} color={colors.mutedForeground} strokeWidth={1.6} />}</View>
      <Text style={styles.emptyText}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 18,
    gap: 8,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.foreground, letterSpacing: 0.1 },
  subtitle: { fontSize: 13.5, color: colors.mutedForeground, lineHeight: 19 },
  badge: { alignItems: 'center', justifyContent: 'center' },
  pill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radii.pill, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '700' },
  empty: { paddingVertical: 48, alignItems: 'center', gap: 12 },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.muted,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyText: { color: colors.mutedForeground, fontSize: 14.5 },
});

export default Card;
