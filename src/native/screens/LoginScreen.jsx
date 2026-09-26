import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Alert
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { T, LOGO } from '../../theme';

export function LoginScreen() {
  const { login } = useApp();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (!result.success) {
      Alert.alert('Login Failed', result.error);
    }
    // Navigation is handled in App.js via currentUser state
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoWrap}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          {/* Brand accent bar below logo */}
          <View style={styles.logoBrand} />
          <Text style={styles.tagline}>Security Guard Management</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.heading}>Sign In</Text>
          <Text style={styles.sub}>Use your work credentials to continue</Text>

          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor="#475569"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#475569"
              secureTextEntry={!showPass}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.showBtn} onPress={() => setShowPass(!showPass)}>
              <Text style={styles.showTxt}>{showPass ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnTxt}>Sign In</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Demo credentials hint */}
        <View style={styles.hintBox}>
          <Text style={styles.hintTitle}>Demo Credentials</Text>
          <Text style={styles.hint}>Manager: elena@observant.com / manager123</Text>
          <Text style={styles.hint}>Guard:   ahmad@observant.com / guard123</Text>
          <Text style={styles.hint}>Guard:   marcus@observant.com / guard123</Text>
          <Text style={styles.hint}>Guard:   sofia@observant.com / guard123</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: T.bgRoot },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoWrap: { alignItems: 'center', marginBottom: 32 },
  logo:   { width: 200, height: 66 },
  logoBrand: { width: 60, height: 3, backgroundColor: T.brand, borderRadius: 2, marginTop: 10, marginBottom: 4 },
  tagline:{ color: T.textMuted, fontSize: 13, marginTop: 4, letterSpacing: 0.5 },
  card:   { backgroundColor: T.bgCard, borderRadius: T.radiusLg, padding: 24, borderWidth: 1, borderColor: T.borderSubtle },
  heading:{ color: T.textPrimary, fontSize: 22, fontWeight: '800', marginBottom: 4 },
  sub:    { color: T.textMuted, fontSize: 13, marginBottom: 24 },
  label:  { color: T.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:  {
    backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.borderMid,
    borderRadius: T.radiusSm + 2, paddingHorizontal: 14, paddingVertical: 12,
    color: T.textPrimary, fontSize: 15, marginBottom: 16,
  },
  passRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 8 },
  showBtn:  { paddingHorizontal: 12, paddingVertical: 12 },
  showTxt:  { color: T.accentBlue, fontSize: 13, fontWeight: '600' },
  btn:      { backgroundColor: T.brand, borderRadius: T.radiusSm + 2, paddingVertical: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnTxt:   { color: '#fff', fontSize: 16, fontWeight: '800' },
  hintBox:  { marginTop: 24, backgroundColor: T.bgCard, borderRadius: T.radiusMd, padding: 16, borderWidth: 1, borderColor: T.borderSubtle },
  hintTitle:{ color: T.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  hint:     { color: T.textDisabled, fontSize: 12, marginBottom: 3, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
});
