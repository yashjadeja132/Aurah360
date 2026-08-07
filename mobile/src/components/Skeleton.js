import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { colors, radii, shadow } from '../theme/colors';

/** Base shimmering placeholder block — a looping opacity pulse (cheap, no native deps,
 *  works the same on old/low-end Android devices this clinic's patients are likely to use). */
export function SkeletonBox({ width, height = 14, radius = 6, style }) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.box,
        { width, height, borderRadius: radius, opacity },
        style,
      ]}
    />
  );
}

/** Mimics a Card with an IconBadge + title/subtitle + pill — the shape shared by
 *  Appointments/Treatments/Bills/Documents/Offers list rows. */
export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <SkeletonBox width={44} height={44} radius={22} />
        <View style={styles.flex}>
          <SkeletonBox width="70%" height={15} style={styles.gapSm} />
          <SkeletonBox width="45%" height={12} style={styles.gapSm} />
        </View>
      </View>
      <SkeletonBox width={90} height={22} radius={radii.pill} style={styles.gapMd} />
    </View>
  );
}

/** N stacked CardSkeletons — drop in wherever a list screen is loading its first page. */
export function SkeletonList({ count = 3 }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.muted },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 18,
    gap: 12,
    ...shadow.card,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  flex: { flex: 1 },
  gapSm: { marginTop: 6 },
  gapMd: { marginTop: 2 },
  list: { gap: 14 },
});

export default SkeletonList;
