import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

/**
 * Custom native-stack header title with a subtitle line underneath — React Navigation's
 * built-in `title` option only renders a single line, so pushed screens (Documents,
 * Notifications, Offers, Profile, booking flows, …) use this via `options.headerTitle`
 * to get the same professional title+subtitle treatment as the in-content Screen header.
 */
export function HeaderTitle({ title, subtitle }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
    </View>
  );
}

/** Convenience factory for `options={{ headerTitle: headerTitleFor(title, subtitle) }}`. */
export function headerTitleFor(title, subtitle) {
  return () => <HeaderTitle title={title} subtitle={subtitle} />;
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-start' },
  title: { fontSize: 17, fontWeight: '800', color: colors.foreground },
  subtitle: { fontSize: 12, color: colors.mutedForeground, marginTop: 1 },
});

export default HeaderTitle;
