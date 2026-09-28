/**
 * AppHeader — Tactical Command Center branded header.
 * Gold hairline accent strip at the bottom of every header.
 * Badge-logo on the left, optional right-slot actions.
 */
import React from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { P, SP, BR, FONT, SH_TOKENS, LOGO, LOGO_SIZES, HEADER_PT, GR } from '../../ds';

export function AppHeader({ right, title, subtitle, style }) {
  return (
    <View style={[styles.wrap, style]}>
      <LinearGradient
        colors={GR.header}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.inner}>
        {/* Badge logo */}
        <View style={styles.logoWrap}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          {/* Gold ring around badge */}
          <View style={styles.logoRing} />
        </View>

        {/* Optional center title */}
        {title ? (
          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
        ) : (
          <View style={styles.titleBlock}>
            <Text style={styles.brandName}>OBSERVANT</Text>
            <Text style={styles.brandSub}>SECURITY</Text>
          </View>
        )}

        {/* Right slot */}
        <View style={styles.right}>
          {right || <View style={styles.rightPlaceholder} />}
        </View>
      </View>

      {/* Gold accent strip */}
      <LinearGradient
        colors={['transparent', P.gold, P.goldDark, P.gold, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.goldStrip}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: P.bg1,
    paddingTop: HEADER_PT,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SP.px16,
    paddingBottom: SP.px12,
    gap: SP.px12,
  },
  logoWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  logoRing: {
    position: 'absolute',
    inset: 0,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: P.goldBorder,
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    ...FONT.h4,
    letterSpacing: 0.2,
  },
  subtitle: {
    ...FONT.caption,
    marginTop: 1,
  },
  brandName: {
    fontSize: 14,
    fontWeight: '800',
    color: P.t1,
    letterSpacing: 2.5,
  },
  brandSub: {
    fontSize: 9,
    fontWeight: '600',
    color: P.gold,
    letterSpacing: 3,
    marginTop: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.px12,
    minWidth: 44,
    justifyContent: 'flex-end',
  },
  rightPlaceholder: {
    width: 44,
  },
  goldStrip: {
    height: 1.5,
    width: '100%',
  },
});
