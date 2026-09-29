/**
 * LoginScreen — Tactical Command Center
 * Full brand immersion: badge logo, animated entrance, shake on error, forgot-password flow.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Animated, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../context/AppContext';
import { API_ENABLED, apiPost } from '../../services/api';
import {
  P, SP, BR, FONT, SH_TOKENS, GR, card, input, btnPrimary, btnPrimaryText,
  LOGO, LOGO_SIZES, ANIM,
} from '../../ds';

const STEPS = { LOGIN: 'login', FORGOT_SEND: 'forgot_send', FORGOT_VERIFY: 'forgot_verify' };

export function LoginScreen() {
  const { login, resetPasswordWithCode } = useApp();

  // ── State ──────────────────────────────────────────────────────────────────
  const [step, setStep]         = useState(STEPS.LOGIN);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const [resetEmail, setResetEmail]   = useState('');
  const [resetCode, setResetCode]     = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // ── Animations ─────────────────────────────────────────────────────────────
  const logoScale   = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const cardSlide   = useRef(new Animated.Value(40)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const shakeX      = useRef(new Animated.Value(0)).current;
  const logoPulse   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entrance: logo scales in, then card slides up
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale,   { toValue: 1, friction: 7, tension: 50, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(cardSlide,   { toValue: 0,   duration: 350, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1,   duration: 350, useNativeDriver: true }),
      ]),
    ]).start();

    // Idle logo pulse
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(logoPulse, { toValue: 1.04, duration: 2000, useNativeDriver: true }),
        Animated.timing(logoPulse, { toValue: 1,    duration: 2000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const shake = () => {
    shakeX.setValue(0);
    Animated.sequence(
      [12, -12, 9, -9, 6, -6, 0].map(v =>
        Animated.timing(shakeX, { toValue: v, duration: 45, useNativeDriver: true })
      )
    ).start();
  };

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your email address and password.');
      shake();
      return;
    }
    setLoading(true);
    const result = await login(email.trim().toLowerCase(), password);
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Sign in failed. Please try again.');
      shake();
    }
  };

  // ── Forgot password ────────────────────────────────────────────────────────
  const handleSendCode = async () => {
    if (!resetEmail.trim()) { setError('Enter your email address.'); return; }
    if (!API_ENABLED) { setError('Password reset requires a connected server. Ask your manager for account help.'); return; }
    setResetLoading(true);
    try {
      await apiPost('/api/auth/forgot-password', { email: resetEmail.trim().toLowerCase() });
      setError('');
      setStep(STEPS.FORGOT_VERIFY);
    } catch (requestError) { setError(requestError.message); }
    finally { setResetLoading(false); }
  };

  const handleResetPassword = async () => {
    if (!resetCode || !newPassword) { setError('Fill in all fields.'); return; }
    if (newPassword.length < 12)   { setError('Password must be at least 12 characters.'); return; }
    setResetLoading(true);
    const result = await resetPasswordWithCode(resetEmail, resetCode, newPassword);
    setResetLoading(false);
    if (!result.success) { setError(result.error || 'Could not reset the password.'); return; }
    setError('Password updated. Sign in with your new password.');
    setPassword('');
    setStep(STEPS.LOGIN);
  };

  const goBack = () => { setStep(STEPS.LOGIN); setError(''); };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={P.bg0} />
      {/* Deep background gradient */}
      <LinearGradient colors={['#0D1828', P.bg0]} style={StyleSheet.absoluteFillObject} />

      {/* Radial glow behind logo */}
      <Animated.View style={[styles.glowOrb, { transform: [{ scale: logoPulse }] }]}>
        <LinearGradient
          colors={['rgba(27,79,190,0.22)', 'transparent']}
          style={styles.glowOrbInner}
        />
      </Animated.View>

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Badge Logo ── */}
          <Animated.View style={[styles.logoSection, {
            opacity: logoOpacity,
            transform: [{ scale: Animated.multiply(logoScale, logoPulse) }],
          }]}>
            <View style={styles.badgeWrap}>
              <Image source={LOGO} style={styles.badge} resizeMode="contain" />
              {/* Outer gold ring */}
              <View style={styles.outerRing} />
            </View>
            <Text style={styles.orgName}>OBSERVANT SECURITY</Text>
            <View style={styles.goldDivider} />
            <Text style={styles.appLabel}>GUARD OPERATIONS PORTAL</Text>
          </Animated.View>

          {/* ── Card ── */}
          <Animated.View style={[
            styles.card,
            {
              opacity: cardOpacity,
              transform: [{ translateY: cardSlide }, { translateX: shakeX }],
            },
          ]}>
            <LinearGradient colors={['#26364B', '#182333']} style={styles.cardGradient} />

            {/* Step: Login */}
            {step === STEPS.LOGIN && (
              <>
                <Text style={styles.cardTitle}>Sign In</Text>
                <Text style={styles.cardSub}>Use your work credentials to continue</Text>

                {!!error && <ErrorBox text={error} />}

                <Label text="Email Address" />
                <TextInput
                  style={[styles.input, error && styles.inputError]}
                  value={email}
                  onChangeText={v => { setEmail(v); setError(''); }}
                  placeholder="officer@observant.com"
                  placeholderTextColor={P.t4}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  selectionColor={P.blue}
                />

                <Label text="Password" />
                <View style={styles.passRow}>
                  <TextInput
                    style={[styles.input, styles.passInput, error && styles.inputError]}
                    value={password}
                    onChangeText={v => { setPassword(v); setError(''); }}
                    placeholder="••••••••"
                    placeholderTextColor={P.t4}
                    secureTextEntry={!showPass}
                    autoCapitalize="none"
                    selectionColor={P.blue}
                  />
                  <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(v => !v)}>
                    <Text style={styles.eyeTxt}>{showPass ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.forgotBtn}
                  onPress={() => { setStep(STEPS.FORGOT_SEND); setError(''); }}
                >
                  <Text style={styles.forgotTxt}>Forgot password?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.btnDisabled]}
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={loading ? [P.bg3, P.bg3] : [P.blueLight, P.blueDark]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.primaryBtnGrad}
                  >
                    {loading
                      ? <ActivityIndicator color={P.white} size="small" />
                      : <Text style={styles.primaryBtnTxt}>SIGN IN</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            {/* Step: Forgot — send code */}
            {step === STEPS.FORGOT_SEND && (
              <>
                <TouchableOpacity onPress={goBack} style={styles.backBtn}>
                  <Text style={styles.backTxt}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.cardTitle}>Reset Password</Text>
                <Text style={styles.cardSub}>Enter your email and we'll send a 6-digit reset code.</Text>

                {!!error && <ErrorBox text={error} />}

                <Label text="Email Address" />
                <TextInput
                  style={styles.input}
                  value={resetEmail}
                  onChangeText={v => { setResetEmail(v); setError(''); }}
                  placeholder="officer@observant.com"
                  placeholderTextColor={P.t4}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  selectionColor={P.blue}
                />

                <TouchableOpacity
                  style={[styles.primaryBtn, resetLoading && styles.btnDisabled]}
                  onPress={handleSendCode}
                  disabled={resetLoading}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={resetLoading ? [P.bg3, P.bg3] : [P.blueLight, P.blueDark]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.primaryBtnGrad}
                  >
                    {resetLoading
                      ? <ActivityIndicator color={P.white} size="small" />
                      : <Text style={styles.primaryBtnTxt}>SEND RESET CODE</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            {/* Step: Forgot — enter code + new password */}
            {step === STEPS.FORGOT_VERIFY && (
              <>
                <TouchableOpacity onPress={() => setStep(STEPS.FORGOT_SEND)} style={styles.backBtn}>
                  <Text style={styles.backTxt}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.cardTitle}>Enter Reset Code</Text>
                <Text style={styles.cardSub}>Check your email for the 6-digit code.</Text>

                {!!error && <ErrorBox text={error} />}

                <Label text="6-Digit Code" />
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  value={resetCode}
                  onChangeText={setResetCode}
                  placeholder="0 0 0 0 0 0"
                  placeholderTextColor={P.t4}
                  keyboardType="number-pad"
                  maxLength={6}
                  selectionColor={P.blue}
                />

                <Label text="New Password" />
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Minimum 12 characters"
                  placeholderTextColor={P.t4}
                  secureTextEntry
                  autoCapitalize="none"
                  selectionColor={P.blue}
                />

                <TouchableOpacity
                  style={[styles.primaryBtn, resetLoading && styles.btnDisabled, { marginTop: SP.px24 }]}
                  onPress={handleResetPassword}
                  disabled={resetLoading}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={resetLoading ? [P.bg3, P.bg3] : [P.blueLight, P.blueDark]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.primaryBtnGrad}
                  >
                    {resetLoading
                      ? <ActivityIndicator color={P.white} size="small" />
                      : <Text style={styles.primaryBtnTxt}>SET NEW PASSWORD</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>

          {/* Local preview credentials or live server status */}
          <Animated.View style={[styles.hint, { opacity: cardOpacity }]}>
            <View style={styles.hintHeader}>
              <View style={styles.hintDot} />
              <Text style={styles.hintLabel}>{API_ENABLED ? 'SECURE SERVER SIGN-IN' : 'DEVICE-ONLY DEMO ACCESS'}</Text>
              <View style={styles.hintDot} />
            </View>
            {API_ENABLED ? (
              <Text style={styles.hintLine}>Accounts and shift activity are stored in your organisation database.</Text>
            ) : (
              <>
                <Text style={styles.hintLine}>Manager: elena@observant.com  /  manager123</Text>
                <Text style={styles.hintLine}>Guard:   ahmad@observant.com   /  guard123</Text>
                <Text style={styles.previewNote}>OFFLINE PREVIEW · DATA STAYS ON THIS DEVICE</Text>
              </>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Label({ text }) {
  return <Text style={styles.label}>{text}</Text>;
}

function ErrorBox({ text }) {
  return (
    <View style={styles.errorBox}>
      <View style={styles.errorStripe} />
      <Text style={styles.errorTxt}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: P.bg0 },
  kav:        { flex: 1 },
  scroll:     { flexGrow: 1, justifyContent: 'center', paddingHorizontal: SP.px24, paddingVertical: SP.px40 },

  glowOrb:    { position: 'absolute', top: -60, alignSelf: 'center', width: 340, height: 340 },
  glowOrbInner:{ flex: 1, borderRadius: 170 },

  // Logo section
  logoSection:{ alignItems: 'center', marginBottom: SP.px40 },
  badgeWrap:  { position: 'relative', marginBottom: SP.px20 },
  badge:      { width: 120, height: 120 },
  outerRing:  {
    position: 'absolute', inset: -6,
    borderRadius: 66, borderWidth: 1.5, borderColor: P.goldBorder,
  },
  orgName:    { fontSize: 15, fontWeight: '800', color: P.t1, letterSpacing: 3.5, marginBottom: SP.px8 },
  goldDivider:{ width: 60, height: 1.5, backgroundColor: P.gold, borderRadius: 1, marginBottom: SP.px8 },
  appLabel:   { ...FONT.label, color: P.gold, letterSpacing: 2 },

  // Card
  card: {
    borderRadius: BR.xl,
    borderWidth: 1,
    borderColor: P.b3,
    padding: SP.px24,
    overflow: 'hidden',
    ...SH_TOKENS.lg,
    marginBottom: SP.px24,
  },
  cardGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BR.xl,
  },
  cardTitle:  { ...FONT.h2, marginBottom: SP.px4 },
  cardSub:    { ...FONT.body2, marginBottom: SP.px24 },

  // Inputs
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: P.t3,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: SP.px8,
    marginTop: SP.px4,
  },
  input: {
    backgroundColor: P.bg3,
    borderWidth: 1,
    borderColor: P.b2,
    borderRadius: BR.sm,
    paddingHorizontal: SP.px16,
    paddingVertical: SP.px12,
    color: P.t1,
    fontSize: 15,
    marginBottom: SP.px4,
  },
  inputError: { borderColor: P.redBorder },
  passRow:    { flexDirection: 'row', alignItems: 'center', gap: SP.px8, marginBottom: SP.px4 },
  passInput:  { flex: 1, marginBottom: 0 },
  eyeBtn:     { paddingHorizontal: SP.px12, paddingVertical: SP.px12 },
  eyeTxt:     { color: P.info, fontSize: 13, fontWeight: '600' },
  codeInput:  { fontSize: 22, letterSpacing: 10, textAlign: 'center' },

  forgotBtn:  { alignSelf: 'flex-end', marginTop: SP.px8, marginBottom: SP.px24 },
  forgotTxt:  { color: P.info, fontSize: 13, fontWeight: '600' },

  // Primary button
  primaryBtn: { borderRadius: BR.md, overflow: 'hidden', marginTop: SP.px8, ...SH_TOKENS.blue },
  primaryBtnGrad: { paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  primaryBtnTxt: { color: P.white, fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },
  btnDisabled:{ opacity: 0.55 },

  backBtn:    { marginBottom: SP.px16 },
  backTxt:    { color: P.info, fontSize: 13, fontWeight: '600' },

  // Error
  errorBox:   {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: P.redSubtle,
    borderWidth: 1,
    borderColor: P.redBorder,
    borderRadius: BR.sm,
    marginBottom: SP.px16,
    overflow: 'hidden',
  },
  errorStripe:{ width: 4, alignSelf: 'stretch', backgroundColor: P.red },
  errorTxt:   { color: P.redLight, fontSize: 13, fontWeight: '500', flex: 1, padding: SP.px12 },

  // Hint
  hint: {
    borderWidth: 1,
    borderColor: P.b2,
    borderRadius: BR.md,
    padding: SP.px16,
    backgroundColor: 'rgba(13,20,40,0.7)',
  },
  hintHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SP.px8, marginBottom: SP.px8 },
  hintDot:    { width: 20, height: 1, backgroundColor: P.goldBorder },
  hintLabel:  { ...FONT.label, color: P.gold },
  hintLine:   {
    color: P.t4,
    fontSize: 11,
    textAlign: 'center',
    marginBottom: SP.px4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  previewNote: {
    color: P.warn,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.8,
    marginTop: SP.px12,
  },
});
