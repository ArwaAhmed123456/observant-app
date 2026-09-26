/**
 * AppHeader — shared branded header used on every screen.
 * Shows the logo on the left, optional right-side action slot.
 * A thin brand-green accent line runs across the bottom.
 */
import React from 'react';
import { View, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { T, LOGO } from '../../theme';

export function AppHeader({ right, style }) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.inner}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {/* Brand accent line */}
      <View style={styles.accentLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: T.bgRoot,
    paddingTop: 52,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  logo: {
    width: 130,
    height: 40,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  accentLine: {
    height: 2,
    backgroundColor: T.brand,
    opacity: 0.35,
    marginHorizontal: 20,
    borderRadius: 1,
  },
});
