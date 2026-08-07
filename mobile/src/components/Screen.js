import React from 'react';
import { View, Text, StyleSheet, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

/**
 * In-content title+subtitle block for screens that sit directly on a bottom tab (no native
 * stack header above them — e.g. Appointments/Treatments/Bills). Pushed screens reachable via
 * a back button use `HeaderTitle`/`headerTitleFor` in the native header instead.
 */
export function ScreenHeader({ title, subtitle }) {
  if (!title) return null;
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{title}</Text>
      {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/** Consistent screen chrome — safe area + optional title/subtitle + pull-to-refresh scroll container.
 *  `floatingAction` renders outside the ScrollView, anchored bottom-right, so it stays fixed on
 *  screen instead of scrolling away with the list (e.g. a "Book appointment" FAB). */
export function Screen({ children, title, subtitle, scroll = true, onRefresh, refreshing, style, noTopPadding, edges = ['top', 'bottom'], floatingAction }) {
  const content = (
    <View style={[styles.padded, noTopPadding && styles.noTopPadding, style]}>
      <ScreenHeader title={title} subtitle={subtitle} />
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, floatingAction && styles.scrollContentWithFab]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.primary} />
            ) : undefined
          }
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
      {floatingAction ? <View style={styles.fabWrap}>{floatingAction}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1 },
  scrollContentWithFab: { paddingBottom: 88 },
  fabWrap: { position: 'absolute', right: 20, bottom: 20 },
  padded: { padding: 16, gap: 14 },
  noTopPadding: { paddingTop: 0 },
  header: { gap: 2, marginBottom: 2 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.foreground },
  headerSubtitle: { fontSize: 13, color: colors.mutedForeground },
});

export default Screen;
