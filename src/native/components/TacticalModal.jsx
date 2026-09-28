import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle2, AlertTriangle, AlertOctagon, Info, X } from 'lucide-react-native';
import { P, SP, BR, FONT, SH_TOKENS } from '../../ds';

export function TacticalModal({
  visible,
  onClose,
  type = 'routine', // 'routine' | 'action' | 'critical'
  title,
  subtitle,
  children,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  autoDismissMs,
}) {
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }).start();

      if (type === 'critical') {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          ])
        );
        loop.start();
        return () => loop.stop();
      }

      if (type === 'routine' && autoDismissMs) {
        const timer = setTimeout(() => {
          onClose?.();
        }, autoDismissMs);
        return () => clearTimeout(timer);
      }
    } else {
      scaleAnim.setValue(0.92);
    }
  }, [visible, type]);

  if (!visible) return null;

  const isCritical = type === 'critical';
  const isRoutine = type === 'routine';

  // Modal styling based on seriousness
  let accentColor = P.blueLight;
  let borderColor = P.b3;
  let bgGrad = ['#162036', '#0F1626'];

  if (isCritical) {
    accentColor = P.danger;
    borderColor = P.dangerBorder;
    bgGrad = ['#2E0A0D', '#160406'];
  } else if (isRoutine) {
    accentColor = P.ok;
    borderColor = P.okBorder;
    bgGrad = ['#111C2C', '#0E1522'];
  }

  const renderIcon = () => {
    if (isCritical) {
      return (
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <View style={[styles.iconWrap, { backgroundColor: P.dangerSubtle, borderColor: P.dangerBorder }]}>
            <AlertOctagon size={32} color={P.danger} />
          </View>
        </Animated.View>
      );
    }
    if (isRoutine) {
      return (
        <View style={[styles.iconWrap, { backgroundColor: P.okSubtle, borderColor: P.okBorder }]}>
          <CheckCircle2 size={28} color={P.ok} />
        </View>
      );
    }
    return (
      <View style={[styles.iconWrap, { backgroundColor: P.blueSubtle, borderColor: P.blueBorder }]}>
        <Info size={28} color={P.blueLight} />
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <LinearGradient
          colors={isCritical ? ['rgba(200,35,44,0.35)', P.overlay] : ['rgba(11,14,20,0.85)', P.overlay]}
          style={StyleSheet.absoluteFillObject}
        />

        <Animated.View style={[
          styles.card,
          { borderColor },
          isCritical && SH_TOKENS.danger,
          { transform: [{ scale: scaleAnim }] },
        ]}>
          <LinearGradient colors={bgGrad} style={StyleSheet.absoluteFillObject} />

          {/* Top colored accent line */}
          <View style={[styles.topAccentBar, { backgroundColor: accentColor }]} />

          {/* Dismiss button if not auto-dismiss routine */}
          {!isRoutine && onClose && (
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={18} color={P.t3} />
            </TouchableOpacity>
          )}

          <View style={styles.contentWrap}>
            {renderIcon()}

            {title && (
              <Text style={[styles.title, isCritical && { color: P.danger }]}>
                {title}
              </Text>
            )}

            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

            {children}

            {/* Action buttons */}
            {(primaryActionLabel || secondaryActionLabel) && (
              <View style={styles.btnRow}>
                {secondaryActionLabel && onSecondaryAction && (
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={onSecondaryAction}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.secondaryBtnText}>{secondaryActionLabel}</Text>
                  </TouchableOpacity>
                )}

                {primaryActionLabel && onPrimaryAction && (
                  <TouchableOpacity
                    style={[styles.primaryBtn, !secondaryActionLabel && { flex: 1 }]}
                    onPress={onPrimaryAction}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={isCritical ? [P.danger, P.dangerDark] : [P.blueLight, P.blueDark]}
                      style={styles.primaryBtnGrad}
                    >
                      <Text style={styles.primaryBtnText}>{primaryActionLabel}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SP.px20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: BR.xl,
    borderWidth: 1.5,
    overflow: 'hidden',
    position: 'relative',
    ...SH_TOKENS.md,
  },
  topAccentBar: {
    height: 3,
    width: '100%',
  },
  closeBtn: {
    position: 'absolute',
    top: SP.px12,
    right: SP.px12,
    padding: SP.px8,
    zIndex: 10,
  },
  contentWrap: {
    padding: SP.px24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SP.px16,
  },
  title: {
    ...FONT.h2,
    color: P.t1,
    textAlign: 'center',
    marginBottom: SP.px8,
    letterSpacing: -0.4,
  },
  subtitle: {
    ...FONT.body1,
    color: P.t2,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SP.px20,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.px12,
    width: '100%',
    marginTop: SP.px12,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: P.bg3,
    borderWidth: 1,
    borderColor: P.b3,
    borderRadius: BR.md,
    paddingVertical: SP.px12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    ...FONT.body2,
    color: P.t2,
    fontWeight: '600',
  },
  primaryBtn: {
    flex: 1,
    borderRadius: BR.md,
    overflow: 'hidden',
  },
  primaryBtnGrad: {
    paddingVertical: SP.px12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    ...FONT.body2,
    color: P.white,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
