import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert
} from 'react-native';
import { AlertTriangle, X, Check, Camera } from 'lucide-react-native';
import { useSecurity } from '../../context/SecurityContext';

export const IncidentModal = ({ visible, onClose }) => {
  const { logIncident, activeShiftSession, currentUser } = useSecurity();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Trespassing');
  const [severity, setSeverity] = useState('Medium');
  const [notes, setNotes] = useState('');
  const [photoCaptured, setPhotoCaptured] = useState(false);

  const categories = ['Trespassing', 'Fire/Hazard', 'Forced Entry', 'Maintenance', 'Suspicious Activity'];
  const severities = [
    { label: 'Low', color: '#10b981' },
    { label: 'Medium', color: '#f59e0b' },
    { label: 'High', color: '#f97316' },
    { label: 'Critical', color: '#ef4444' }
  ];

  const handleSubmit = () => {
    if (!title.trim()) {
      Alert.alert('Required Field', 'Please enter an incident title.');
      return;
    }

    logIncident({
      title,
      category,
      severity,
      notes,
      guardId: currentUser.id,
      guardName: currentUser.name,
      siteId: activeShiftSession?.siteId || currentUser.assignedSiteId || 'site-1',
      hasPhoto: photoCaptured,
      timestamp: new Date().toISOString()
    });

    setTitle('');
    setNotes('');
    setPhotoCaptured(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <AlertTriangle color="#f59e0b" size={20} />
              <Text style={styles.headerTitle}>Report Security Incident</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X color="#94a3b8" size={20} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Title */}
            <Text style={styles.label}>Incident Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Perimeter gate padlock broken"
              placeholderTextColor="#64748b"
              value={title}
              onChangeText={setTitle}
            />

            {/* Category */}
            <Text style={styles.label}>Category</Text>
            <View style={styles.chipRow}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={[
                    styles.chip,
                    category === cat && styles.chipActive
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      category === cat && styles.chipTextActive
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Severity */}
            <Text style={styles.label}>Severity Level</Text>
            <View style={styles.severityRow}>
              {severities.map((sev) => {
                const isSelected = severity === sev.label;
                return (
                  <TouchableOpacity
                    key={sev.label}
                    onPress={() => setSeverity(sev.label)}
                    style={[
                      styles.sevButton,
                      isSelected && { borderColor: sev.color, backgroundColor: `${sev.color}20` }
                    ]}
                  >
                    <Text
                      style={[
                        styles.sevText,
                        isSelected && { color: sev.color, fontWeight: '700' }
                      ]}
                    >
                      {sev.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Photo Capture Simulation */}
            <Text style={styles.label}>Evidence Photo</Text>
            <TouchableOpacity
              onPress={() => setPhotoCaptured(!photoCaptured)}
              style={[
                styles.photoButton,
                photoCaptured && styles.photoButtonCaptured
              ]}
            >
              {photoCaptured ? (
                <>
                  <Check color="#10b981" size={18} />
                  <Text style={styles.photoCapturedText}>Photo Attached (IMG_4821.JPG)</Text>
                </>
              ) : (
                <>
                  <Camera color="#38bdf8" size={18} />
                  <Text style={styles.photoButtonText}>Tap to Capture / Attach Photo</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Notes */}
            <Text style={styles.label}>Detailed Observations</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe exact location, suspect details, actions taken..."
              placeholderTextColor="#64748b"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
            />
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSubmit} style={styles.submitButton}>
              <Text style={styles.submitButtonText}>Submit Dispatch Report</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end'
  },
  card: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    maxHeight: '90%',
    padding: 20
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc'
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#1e293b'
  },
  body: {
    marginBottom: 16
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 6,
    marginTop: 10
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top'
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155'
  },
  chipActive: {
    backgroundColor: '#0369a1',
    borderColor: '#38bdf8'
  },
  chipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500'
  },
  chipTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  severityRow: {
    flexDirection: 'row',
    gap: 8
  },
  sevButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
    alignItems: 'center'
  },
  sevText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600'
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#38bdf8',
    borderRadius: 10,
    paddingVertical: 12
  },
  photoButtonCaptured: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderStyle: 'solid'
  },
  photoButtonText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '600'
  },
  photoCapturedText: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '600'
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e293b'
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    alignItems: 'center'
  },
  cancelButtonText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 14
  },
  submitButton: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#0284c7',
    alignItems: 'center'
  },
  submitButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14
  }
});
