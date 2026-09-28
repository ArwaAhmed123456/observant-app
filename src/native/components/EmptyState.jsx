import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Shield, Radar, Compass, AlertCircle } from 'lucide-react-native';
import { P, SP, BR, FONT, SH_TOKENS } from '../../ds';

export function EmptyState({
  icon = 'shield',
  variant,
  title = 'No Operational Records',
  message = 'There are no active records matching this view right now.',
  actionLabel,
  onAction,
  style,
}) {
  const displayIcon = variant || icon;
  const renderIcon = () => {
    switch (displayIcon) {
      case 'radar':
        return <Radar size={36} color={P.blueLight} strokeWidth={1.8} />;
      case 'compass':
        return <Compass size={36} color={P.gold} strokeWidth={1.8} />;
      case 'alert':
        return <AlertCircle size={36} color={P.warn} strokeWidth={1.8} />;
      case 'shield':
      default:
        return <Shield size={36} color={P.blueLight} strokeWidth={1.8} />;
    }
  };

  return (
    <View style={[styles.container, style]}>
      {/* Outer subtle glow circle */}
      <View style={styles.iconBackdrop}>
        <LinearGradient
          colors={['rgba(27,79,190,0.18)', 'rgba(27,79,190,0.04)']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.iconCircle}>
          {renderIcon()}
        </View>
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>

      {actionLabel && onAction && (
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onAction}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[P.blueLight, P.blueDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.actionGrad}
          >
            <Text style={styles.actionText}>{actionLabel}</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SP.px32,
    paddingHorizontal: SP.px24,
  },
  iconBackdrop: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: P.blueBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SP.px16,
    overflow: 'hidden',
    ...SH_TOKENS.blue,
  },
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...FONT.h3,
    color: P.t1,
    textAlign: 'center',
    marginBottom: SP.px8,
    letterSpacing: -0.2,
  },
  message: {
    ...FONT.body1,
    color: P.t2,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
    marginBottom: SP.px20,
  },
  actionBtn: {
    borderRadius: BR.md,
    overflow: 'hidden',
    ...SH_TOKENS.sm,
  },
  actionGrad: {
    paddingHorizontal: SP.px20,
    paddingVertical: SP.px12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: P.blueBorder,
    borderRadius: BR.md,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    color: P.white,
    letterSpacing: 0.3,
  },
});
