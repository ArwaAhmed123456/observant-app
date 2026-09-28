import React, { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert,
} from 'react-native';
import { AlertTriangle, X, Check, Camera, Zap, Shield } from 'lucide-react-native';
import { useSecurity } from '../../context/SecurityContext';
import { P, SP, BR, FONT, SH_TOKENS, input, btnPrimary } from '../../ds';

const CATEGORIES = ['Trespassing', 'Fire/Hazard', 'Forced Entry', 'Maintenance', 'Suspicious Activity'];
const SEVERITIES = [
  { label: 'Low',      color: P.ok     },
  { label: 'Medium',   color: P.warn   },
  { label: 'High',     color: '#F97316'},
  { label: 'Critical', color: P.danger },
];

export const IncidentModal = ({ visible, onClose }) => {
  const { logIncident, activeShiftSession, currentUser } = useSecurity();
  const [title, setTitle]                 = useState('');
  const [category, setCategory]           = useState('Trespassing');
  const [severity, setSeverity]           = useState('Medium');
  const [notes, setNotes]                 = useState('');
  const [photoCaptured, setPhotoCaptured] = useState(false);

  const handleSubmit = () => {
    if (!title.trim()) {
      Alert.alert('Required Field', 'Please enter an incident title.');
      return;
    }
    logIncident({
      title, category, severity, notes,
      guardId:   currentUser.id,
      guardName: currentUser.name,
      siteId:    activeShiftSession?.siteId || currentUser.assignedSiteId || 'site-1',
      hasPhoto:  photoCaptured,
      timestamp: new Date().toISOString(),
    });
    setTitle(''); setNotes(''); setPhotoCaptured(false);
    onClose();
  };

  const severityColor = SEVERITIES.find(s => s.label === severity)?.color || P.warn;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.card}>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIcon}>
                <AlertTriangle color={P.warn} size={18} />
              </View>
              <Text style={styles.headerTitle}>Report Security Incident</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X color={P.t2} size={18} />
            </TouchableOpacity>
          </View>

          {/* Severity banner */}
          <View style={[styles.severityBanner, { borderColor: severityColor, backgroundColor: `${severityColor}12` }]}>
            <Zap color={severityColor} size={13} />
            <Text style={[styles.severityBannerTxt, { color: severityColor }]}>
              Severity: {severity}
            </Text>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

            {/* Title */}
            <Text style={styles.label}>Incident Title *</Text>
            <TextInput
              style={[input, styles.inputField]}
              placeholder="e.g., Perimeter gate padlock broken"
              placeholderTextColor={P.t4}
              value={title}
              onChangeText={setTitle}
            />

            {/* Category */}
            <Text style={styles.label}>Category</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={[styles.chip, category === cat && styles.chipActive]}
                >
                  <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Severity */}
            <Text style={styles.label}>Severity Level</Text>
            <View style={styles.severityRow}>
              {SEVERITIES.map(sev => {
                const isSelected = severity === sev.label;
                return (
                  <TouchableOpacity
                    key={sev.label}
                    onPress={() => setSeverity(sev.label)}
                    style={[
                      styles.sevButton,
                      isSelected && { borderColor: sev.color, backgroundColor: `${sev.color}18` },
                    ]}
                  >
                    <Text style={[styles.sevText, isSelected && { color: sev.color, fontWeight: '800' }]}>
                      {sev.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Photo */}
            <Text style={styles.label}>Evidence Photo</Text>
            <TouchableOpacity
              onPress={() => setPhotoCaptured(!photoCaptured)}
              style={[styles.photoButton, photoCaptured && styles.photoButtonCaptured]}
            >
              {photoCaptured ? (
                <>
                  <Check color={P.ok} size={17} />
                  <Text style={styles.photoCapturedText}>Photo Attached (IMG_4821.JPG)</Text>
                </>
              ) : (
                <>
                  <Camera color={P.info} size={17} />
                  <Text style={styles.photoButtonText}>Tap to Capture / Attach Photo</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Notes */}
            <Text style={styles.label}>Detailed Observations</Text>
            <TextInput
              style={[input, styles.inputField, styles.textArea]}
              placeholder="Describe exact location, suspect details, actions taken..."
              placeholderTextColor={P.t4}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
            />
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSubmit} style={[styles.submitButton, { backgroundColor: severityColor }]}>
              <Shield color={P.white} size={15} />
              <Text style={styles.submitButtonText}>Submit Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: P.overlay,
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: P.bg2,
    borderTopLeftRadius: BR.xl,
    borderTopRightRadius: BR.xl,
    borderWidth: 1,
    borderColor: P.b2,
    maxHeight: '92%',
    padding: SP.px20,
    ...SH_TOKENS.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SP.px12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: BR.xs,
    backgroundColor: P.warnSubtle,
    borderWidth: 1,
    borderColor: P.warnBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...FONT.h4,
  },
  closeButton: {
    width: 30,
    height: 30,
    backgroundColor: P.bg3,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: P.b2,
  },
  severityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: BR.sm,
    paddingHorizontal: SP.px12,
    paddingVertical: 8,
    marginBottom: SP.px12,
  },
  severityBannerTxt: {
    fontSize: 12,
    fontWeight: '700',
  },
  body: {
    marginBottom: SP.px12,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: P.t3,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: SP.px8,
    marginTop: SP.px12,
  },
  inputField: {
    color: P.t1,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: SP.px12,
    paddingVertical: 7,
    borderRadius: BR.xs,
    backgroundColor: P.bg3,
    borderWidth: 1,
    borderColor: P.b2,
  },
  chipActive: {
    backgroundColor: P.blueSubtle,
    borderColor: P.blueBorder,
  },
  chipText: {
    color: P.t3,
    fontSize: 12,
    fontWeight: '500',
  },
  chipTextActive: {
    color: P.info,
    fontWeight: '700',
  },
  severityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sevButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: BR.xs,
    borderWidth: 1,
    borderColor: P.b2,
    backgroundColor: P.bg3,
    alignItems: 'center',
  },
  sevText: {
    color: P.t3,
    fontSize: 11,
    fontWeight: '600',
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: P.bg3,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: P.infoBorder,
    borderRadius: BR.sm,
    paddingVertical: 13,
  },
  photoButtonCaptured: {
    borderColor: P.okBorder,
    backgroundColor: P.okSubtle,
    borderStyle: 'solid',
  },
  photoButtonText: {
    color: P.info,
    fontSize: 13,
    fontWeight: '600',
  },
  photoCapturedText: {
    color: P.ok,
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: SP.px12,
    paddingTop: SP.px12,
    borderTopWidth: 1,
    borderTopColor: P.b1,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: BR.sm,
    backgroundColor: P.bg3,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: P.b2,
  },
  cancelButtonText: {
    color: P.t2,
    fontWeight: '600',
    fontSize: 14,
  },
  submitButton: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: BR.sm,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonText: {
    color: P.white,
    fontWeight: '800',
    fontSize: 14,
  },
});
