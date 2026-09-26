import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Alert, Animated
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { COLORS, R, S, TYPE, shadows, inputStyle } from '../../theme';
import { LOGO } from '../../theme';
import { Eye, EyeOff, Mail, Lock, CheckCircle2 } from 'lucide-react-native';

const STEPS = { LOGIN: 'login', FORGOT_SEND: 'forgot_send', FORGOT_VERIFY: 'forgot_verify' };

export function LoginScreen() {
  const { login, resetPasswordWithCode } = useApp();

  const [step, setStep]       = useState(STEPS.LOGIN);
  const [email, setEmail]     = useState('');
  const [password, setPass]   = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [loginSuccess, setLoginSuccess] = useState(false);

  // Forgot password state
  const [resetEmail, setResetEmail]   = useState('');
  const [resetCode, setResetCode]     = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // Shake animation for error
  const shakeAnim = useRef(new Animated.Value(0)).current;
  // Fade-in animation for card
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const successScaleAnim = useRef(new Animated.Value(0.8)).current;
  const successFadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const shake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8,   duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 50, useNativeDriver: true }),
    ]).start();
  };

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your work email and password.');
      shake();
      return;
    }
    setLoading(true);
    const result = await login(email.trim(), password);
    if (!result.success) {
      setLoading(false);
      // Security standard: generic error without revealing whether username or password was wrong
      setError(result.error && result.error.includes('deactivated')
        ? result.error
        : 'Incorrect email or password. Please verify your credentials and try again.');
      shake();
      return;
    }

    // Success transition
    setLoginSuccess(true);
    Animated.parallel([
      Animated.spring(successScaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
      Animated.timing(successFadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
    // On success: AppContext sets currentUser → App.js routes automatically
  };

  // ── Forgot password — send code ────────────────────────────────────────────
  const handleSendCode = async () => {
    if (!resetEmail.trim()) { Alert.alert('Missing Email', 'Please enter your work email address.'); return; }
    setResetLoading(true);
    await new Promise(r => setTimeout(r, 600));
    setResetLoading(false);
    const demoCode = '492810';
    setResetCode(demoCode);
    setStep(STEPS.FORGOT_VERIFY);
    Alert.alert(
      'Verification Code Sent',
      `A 6-digit password reset code was dispatched to ${resetEmail}.\n\nDemo Verification Code: ${demoCode}`
    );
  };

  // ── Forgot password — verify + reset ──────────────────────────────────────
  const handleResetPassword = async () => {
    if (!resetCode || !newPassword) { Alert.alert('Missing Fields', 'Please enter the verification code and your new password.'); return; }
    if (newPassword.length < 8) { Alert.alert('Password Too Short', 'Password must be at least 8 characters.'); return; }
    setResetLoading(true);
    const res = await resetPasswordWithCode(resetEmail, resetCode, newPassword);
    setResetLoading(false);
    if (!res.success) {
      Alert.alert('Reset Failed', res.error || 'Unable to reset password.');
      return;
    }
    setStep(STEPS.LOGIN);
    Alert.alert('Password Updated', 'Your password has been reset successfully. Please sign in with your new credentials.');
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <Animated.View style={[styles.logoWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <View style={styles.logoBrand} />
          <Text style={styles.tagline}>Security & Patrol Intelligence</Text>
        </Animated.View>

        {/* Success Overlay Banner */}
        {loginSuccess && (
          <Animated.View style={[styles.successBanner, { opacity: successFadeAnim, transform: [{ scale: successScaleAnim }] }]}>
            <CheckCircle2 color={COLORS.ok} size={28} />
            <View>
              <Text style={styles.successTitle}>Authenticated Successfully</Text>
              <Text style={styles.successSub}>Routing to your operational terminal…</Text>
            </View>
          </Animated.View>
        )}

        {/* Card */}
        <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateX: shakeAnim }, { translateY: slideAnim }] }]}>

          {/* ── LOGIN ── */}
          {step === STEPS.LOGIN && (
            <>
              <Text style={styles.heading}>Sign In</Text>
              <Text style={styles.sub}>Enter your enterprise credentials</Text>

              {!!error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Text style={styles.label}>Email Address / Username</Text>
              <View style={styles.fieldRow}>
                <Mail size={16} color={COLORS.textMuted} style={styles.fieldIcon} />
                <TextInput
                  style={[styles.fieldInput]}
                  value={email} onChangeText={v => { setEmail(v); setError(''); }}
                  placeholder="name@observant.com"
                  placeholderTextColor={COLORS.textDisabled}
                  keyboardType="email-address"
                  autoCapitalize="none" autoCorrect={false}
                />
              </View>

              <Text style={styles.label}>Password</Text>
              <View style={styles.fieldRow}>
                <Lock size={16} color={COLORS.textMuted} style={styles.fieldIcon} />
                <TextInput
                  style={[styles.fieldInput, { flex: 1 }]}
                  value={password} onChangeText={v => { setPass(v); setError(''); }}
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.textDisabled}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPass(v => !v)} style={styles.eyeBtn}>
                  {showPass
                    ? <EyeOff size={18} color={COLORS.textMuted} />
                    : <Eye    size={18} color={COLORS.textMuted} />
                  }
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => { setStep(STEPS.FORGOT_SEND); setError(''); setResetEmail(email); }}
                style={styles.forgotLink}
              >
                <Text style={styles.forgotLinkTxt}>Forgot password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, (loading || loginSuccess) && styles.btnDisabled]}
                onPress={handleLogin} disabled={loading || loginSuccess}
              >
                {loading
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={styles.btnTxt}>{loginSuccess ? 'Signing In…' : 'Sign In'}</Text>
                }
              </TouchableOpacity>
            </>
          )}

          {/* ── FORGOT — send code ── */}
          {step === STEPS.FORGOT_SEND && (
            <>
              <TouchableOpacity onPress={() => setStep(STEPS.LOGIN)} style={styles.backBtn}>
                <Text style={styles.backBtnTxt}>← Back to sign in</Text>
              </TouchableOpacity>
              <Text style={styles.heading}>Reset Password</Text>
              <Text style={styles.sub}>Enter your email to receive a 6-digit verification code.</Text>

              <Text style={styles.label}>Email Address</Text>
              <View style={styles.fieldRow}>
                <Mail size={16} color={COLORS.textMuted} style={styles.fieldIcon} />
                <TextInput
                  style={styles.fieldInput}
                  value={resetEmail} onChangeText={setResetEmail}
                  placeholder="your@observant.com"
                  placeholderTextColor={COLORS.textDisabled}
                  keyboardType="email-address" autoCapitalize="none"
                />
              </View>

              <TouchableOpacity
                style={[styles.btn, resetLoading && styles.btnDisabled]}
                onPress={handleSendCode} disabled={resetLoading}
              >
                {resetLoading
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={styles.btnTxt}>Send Reset Code</Text>
                }
              </TouchableOpacity>
            </>
          )}

          {/* ── FORGOT — verify + new password ── */}
          {step === STEPS.FORGOT_VERIFY && (
            <>
              <TouchableOpacity onPress={() => setStep(STEPS.FORGOT_SEND)} style={styles.backBtn}>
                <Text style={styles.backBtnTxt}>← Back</Text>
              </TouchableOpacity>
              <Text style={styles.heading}>Enter Verification Code</Text>
              <Text style={styles.sub}>Enter the 6-digit code sent to your email.</Text>

              <Text style={styles.label}>6-Digit Code</Text>
              <TextInput
                style={[inputStyle, styles.codeInput]}
                value={resetCode} onChangeText={setResetCode}
                placeholder="000000" placeholderTextColor={COLORS.textDisabled}
                keyboardType="number-pad" maxLength={6}
              />

              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={[inputStyle, { marginBottom: S.xl }]}
                value={newPassword} onChangeText={setNewPassword}
                placeholder="Min 8 characters" placeholderTextColor={COLORS.textDisabled}
                secureTextEntry autoCapitalize="none"
              />

              <TouchableOpacity
                style={[styles.btn, resetLoading && styles.btnDisabled]}
                onPress={handleResetPassword} disabled={resetLoading}
              >
                {resetLoading
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={styles.btnTxt}>Set New Password</Text>
                }
              </TouchableOpacity>
            </>
          )}
        </Animated.View>

        {/* Demo hint */}
        <Animated.View style={[styles.hintBox, { opacity: fadeAnim }]}>
          <Text style={styles.hintTitle}>Demo Credentials (Auto-Role Routing)</Text>
          <Text style={styles.hint}>Super Admin: admin@observant.com / admin123</Text>
          <Text style={styles.hint}>Manager:     elena@observant.com / manager123</Text>
          <Text style={styles.hint}>Guard:       ahmad@observant.com / guard123</Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: COLORS.bgRoot },
  scroll:     { flexGrow: 1, justifyContent: 'center', padding: S.xl },
  logoWrap:   { alignItems: 'center', marginBottom: S.xxxl },
  logo:       { width: 200, height: 66 },
  logoBrand:  { width: 60, height: 3, backgroundColor: COLORS.brand, borderRadius: 2, marginTop: S.md, marginBottom: S.sm },
  tagline:    { color: COLORS.textMuted, fontSize: 13, letterSpacing: 0.5 },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    backgroundColor: COLORS.okBg,
    borderWidth: 1,
    borderColor: COLORS.okBorder,
    borderRadius: R.lg,
    padding: S.lg,
    marginBottom: S.lg,
    ...shadows.md,
  },
  successTitle: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
  successSub:   { color: COLORS.ok, fontSize: 12, fontWeight: '600', marginTop: 2 },
  card:       { backgroundColor: COLORS.bgCard, borderRadius: R.xl, padding: S.xxl, borderWidth: 1, borderColor: COLORS.borderSubtle, ...shadows.md, marginBottom: S.xl },
  heading:    { ...TYPE.title, marginBottom: S.xs },
  sub:        { color: COLORS.textMuted, fontSize: 13, marginBottom: S.xl },
  errorBox:   { backgroundColor: COLORS.missedBg, borderWidth: 1, borderColor: COLORS.missedBorder, borderRadius: R.sm, padding: S.md, marginBottom: S.md },
  errorText:  { color: COLORS.missed, fontSize: 13, fontWeight: '600' },
  label:      { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: S.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgInput, borderWidth: 1, borderColor: COLORS.borderMid, borderRadius: R.md, paddingHorizontal: S.md, marginBottom: S.lg },
  fieldIcon:  { marginRight: S.sm },
  fieldInput: { flex: 1, color: COLORS.textPrimary, fontSize: 15, paddingVertical: S.md },
  eyeBtn:     { padding: S.sm },
  forgotLink: { alignSelf: 'flex-end', marginTop: -S.sm, marginBottom: S.xl },
  forgotLinkTxt: { color: COLORS.info, fontSize: 13, fontWeight: '600' },
  btn:        { backgroundColor: COLORS.brand, borderRadius: R.md, paddingVertical: 14, alignItems: 'center', ...shadows.brand },
  btnDisabled:{ opacity: 0.6 },
  btnTxt:     { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  backBtn:    { marginBottom: S.lg },
  backBtnTxt: { color: COLORS.info, fontSize: 13, fontWeight: '600' },
  codeInput:  { fontSize: 24, letterSpacing: 8, textAlign: 'center', marginBottom: S.lg },
  hintBox:    { backgroundColor: COLORS.bgCard, borderRadius: R.md, padding: S.lg, borderWidth: 1, borderColor: COLORS.borderSubtle },
  hintTitle:  { color: COLORS.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: S.sm },
  hint:       { color: COLORS.textDisabled, fontSize: 12, marginBottom: 3, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
});
