import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, Switch
} from 'react-native';
import { useApp, formatDate } from '../../context/AppContext';
import { ChevronLeft, ChevronRight, Save, Bookmark, Trash2, Send } from 'lucide-react-native';
import { AppHeader } from '../components/AppHeader';
import { T } from '../../theme';

const DAY_KEYS   = ['mon','tue','wed','thu','fri','sat','sun'];
const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toWeekKey(date) {
  return date.toISOString().slice(0,10);
}

const DEFAULT_DAYS = { mon:null,tue:null,wed:null,thu:null,fri:null,sat:null,sun:null };

export function ManagerRosterScreen() {
  const { currentUser, users, sites, publishRoster, getWeekRosters, getGuardRoster, rosterTemplates, saveRosterTemplate, deleteRosterTemplate } = useApp();

  const [weekStart, setWeekStart] = useState(getMondayOfWeek(new Date()));
  const [selectedGuard, setSelectedGuard] = useState(null);
  const [editDays, setEditDays] = useState({ ...DEFAULT_DAYS });
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [timeModal, setTimeModal] = useState(null); // { dayKey }
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime]     = useState('06:00');
  const [templateName, setTemplateName] = useState('');
  const [saveTemplateModal, setSaveTemplateModal] = useState(false);
  const [templateModal, setTemplateModal] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const guards = users.filter(u => u.role === 'guard' && currentUser.siteIds?.includes(u.siteId));
  const weekKey = toWeekKey(weekStart);

  const prevWeek = () => setWeekStart(prev => addDays(prev, -7));
  const nextWeek = () => setWeekStart(prev => addDays(prev, 7));

  const openEditForGuard = (guard) => {
    setSelectedGuard(guard);
    const existing = getGuardRoster(guard.id, weekKey);
    setEditDays(existing?.days ? { ...DEFAULT_DAYS, ...existing.days } : { ...DEFAULT_DAYS });
    setEditModalVisible(true);
  };

  const toggleDay = (dayKey) => {
    setEditDays(prev => {
      if (prev[dayKey]) return { ...prev, [dayKey]: null };
      // Open time picker
      setTimeModal({ dayKey });
      return prev;
    });
  };

  const confirmTime = () => {
    if (!timeModal) return;
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
      Alert.alert('Invalid time', 'Use HH:MM format (e.g. 18:00)');
      return;
    }
    setEditDays(prev => ({ ...prev, [timeModal.dayKey]: { start: startTime, end: endTime } }));
    setTimeModal(null);
  };

  const handleSaveRoster = async () => {
    if (!selectedGuard) return;
    setPublishing(true);
    await publishRoster({
      guardId: selectedGuard.id,
      siteId: selectedGuard.siteId,
      weekStartDate: weekKey,
      days: editDays,
      publishedBy: currentUser.id,
      publishedAt: new Date().toISOString(),
    });
    setPublishing(false);
    setEditModalVisible(false);
    Alert.alert('Published', `Schedule for ${selectedGuard.name} has been saved.`);
  };

  const handleLoadTemplate = (template) => {
    setEditDays({ ...DEFAULT_DAYS, ...template.days });
    setTemplateModal(false);
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) { Alert.alert('Name required', 'Enter a template name.'); return; }
    await saveRosterTemplate({
      name: templateName.trim(),
      guardId: selectedGuard?.id,
      days: editDays,
    });
    setTemplateName('');
    setSaveTemplateModal(false);
    Alert.alert('Saved', 'Template saved successfully.');
  };

  const weekRosters = getWeekRosters(weekKey);

  return (
    <View style={styles.root}>
      <AppHeader />
      <View style={styles.content}>
      <Text style={styles.screenTitle}>Weekly Roster</Text>

      {/* Week nav */}
      <View style={styles.weekNav}>
        <TouchableOpacity onPress={prevWeek} style={styles.navBtn}>
          <ChevronLeft color="#94a3b8" size={22} />
        </TouchableOpacity>
        <Text style={styles.weekLabel}>{formatDate(weekStart)} – {formatDate(addDays(weekStart, 6))}</Text>
        <TouchableOpacity onPress={nextWeek} style={styles.navBtn}>
          <ChevronRight color="#94a3b8" size={22} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {guards.length === 0 && (
          <Text style={styles.emptyHint}>No guards assigned to your sites.</Text>
        )}

        {guards.map(guard => {
          const site = sites.find(s => s.id === guard.siteId);
          const roster = getGuardRoster(guard.id, weekKey);
          const workedDays = roster ? DAY_KEYS.filter(k => roster.days?.[k]).length : 0;

          return (
            <TouchableOpacity key={guard.id} style={styles.guardRow} onPress={() => openEditForGuard(guard)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.guardName}>{guard.name}</Text>
                <Text style={styles.guardSite}>{site?.name}</Text>
                {roster ? (
                  <View style={styles.dayPills}>
                    {DAY_KEYS.map((k, i) => (
                      <View key={k} style={[styles.dayPill, roster.days?.[k] && styles.dayPillActive]}>
                        <Text style={[styles.dayPillTxt, roster.days?.[k] && styles.dayPillTxtActive]}>
                          {DAY_LABELS[i].charAt(0)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noRoster}>No schedule yet</Text>
                )}
              </View>
              <View style={styles.editBtn}>
                <Text style={styles.editBtnTxt}>{roster ? 'Edit' : '+ Add'}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Edit Roster Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedGuard?.name}</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>{formatDate(weekStart)} – {formatDate(addDays(weekStart, 6))}</Text>

            {/* Template buttons */}
            <View style={styles.templateRow}>
              <TouchableOpacity style={styles.templateBtn} onPress={() => setTemplateModal(true)}>
                <Bookmark color="#38bdf8" size={14} />
                <Text style={styles.templateBtnTxt}>Load Template</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.templateBtn} onPress={() => setSaveTemplateModal(true)}>
                <Save color="#10b981" size={14} />
                <Text style={styles.templateBtnTxt}>Save as Template</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              {DAY_KEYS.map((key, i) => {
                const shift = editDays[key];
                return (
                  <View key={key} style={styles.dayRow}>
                    <Text style={styles.dayLabel}>{DAY_LABELS[i]}</Text>
                    {shift ? (
                      <View style={styles.shiftSet}>
                        <Text style={styles.shiftTime}>{shift.start} – {shift.end}</Text>
                        <TouchableOpacity onPress={() => setTimeModal({ dayKey: key, editing: true, currentShift: shift })}>
                          <Text style={styles.editTime}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setEditDays(prev => ({ ...prev, [key]: null }))}>
                          <Trash2 color="#ef4444" size={16} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.addDayBtn} onPress={() => {
                        setStartTime('18:00');
                        setEndTime('06:00');
                        setTimeModal({ dayKey: key });
                      }}>
                        <Text style={styles.addDayTxt}>+ Add Shift</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.publishBtn, publishing && styles.disabled]}
              onPress={handleSaveRoster}
              disabled={publishing}
            >
              <Send color="#fff" size={16} />
              <Text style={styles.publishBtnTxt}>{publishing ? 'Saving...' : 'Save & Publish'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Time Picker Modal */}
      <Modal visible={!!timeModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: 24 }]}>
            <Text style={styles.modalTitle}>Set Shift Times</Text>
            <Text style={styles.fieldLabel}>Start Time (HH:MM)</Text>
            <TextInput style={styles.timeInput} value={startTime} onChangeText={setStartTime}
              placeholder="e.g. 18:00" placeholderTextColor="#475569" keyboardType="numbers-and-punctuation" />
            <Text style={styles.fieldLabel}>End Time (HH:MM)</Text>
            <TextInput style={styles.timeInput} value={endTime} onChangeText={setEndTime}
              placeholder="e.g. 06:00" placeholderTextColor="#475569" keyboardType="numbers-and-punctuation" />
            <TouchableOpacity style={styles.publishBtn} onPress={confirmTime}>
              <Text style={styles.publishBtnTxt}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setTimeModal(null)}>
              <Text style={styles.cancelBtnTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Save Template Modal */}
      <Modal visible={saveTemplateModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Save as Template</Text>
            <TextInput style={styles.timeInput} value={templateName} onChangeText={setTemplateName}
              placeholder="e.g. Ahmad's usual week" placeholderTextColor="#475569" />
            <TouchableOpacity style={styles.publishBtn} onPress={handleSaveTemplate}>
              <Text style={styles.publishBtnTxt}>Save Template</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setSaveTemplateModal(false)}>
              <Text style={styles.cancelBtnTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Load Template Modal */}
      <Modal visible={templateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Load Template</Text>
            {rosterTemplates.length === 0 && (
              <Text style={styles.emptyHint}>No templates saved yet.</Text>
            )}
            <ScrollView style={{ maxHeight: 320 }}>
              {rosterTemplates.map(t => (
                <View key={t.id} style={styles.templateItem}>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => handleLoadTemplate(t)}>
                    <Text style={styles.templateItemName}>{t.name}</Text>
                    <Text style={styles.templateItemDays}>
                      {DAY_KEYS.filter(k => t.days?.[k]).map((k, i) => DAY_LABELS[DAY_KEYS.indexOf(k)]).join(', ') || 'No days'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteRosterTemplate(t.id)}>
                    <Trash2 color="#ef4444" size={16} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setTemplateModal(false)}>
              <Text style={styles.cancelBtnTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: T.bgRoot },
  content:      { flex: 1, padding: 20 },
  screenTitle:  { color: T.textPrimary, fontSize: 22, fontWeight: '800', marginBottom: 16 },
  weekNav:      { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  navBtn:       { padding: 8 },
  weekLabel:    { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  emptyHint:    { color: '#475569', fontSize: 13, textAlign: 'center', marginTop: 16 },
  guardRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#1e293b' },
  guardName:    { color: '#fff', fontSize: 15, fontWeight: '700' },
  guardSite:    { color: '#64748b', fontSize: 12, marginBottom: 8 },
  dayPills:     { flexDirection: 'row', gap: 4 },
  dayPill:      { width: 22, height: 22, borderRadius: 11, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  dayPillActive:{ backgroundColor: '#10b981' },
  dayPillTxt:   { color: '#475569', fontSize: 10, fontWeight: '700' },
  dayPillTxtActive:{ color: '#fff' },
  noRoster:     { color: '#475569', fontSize: 12, fontStyle: 'italic' },
  editBtn:      { backgroundColor: '#1e293b', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  editBtnTxt:   { color: '#38bdf8', fontSize: 13, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard:    { backgroundColor: '#0f172a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, borderWidth: 1, borderColor: '#1e293b' },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitle:   { color: '#fff', fontSize: 18, fontWeight: '800' },
  closeBtn:     { color: '#64748b', fontSize: 18, padding: 4 },
  modalSub:     { color: '#64748b', fontSize: 12, marginBottom: 16 },
  templateRow:  { flexDirection: 'row', gap: 10, marginBottom: 16 },
  templateBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1e293b', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, justifyContent: 'center' },
  templateBtnTxt:{ color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  dayRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  dayLabel:     { color: '#94a3b8', fontSize: 13, width: 44, fontWeight: '700' },
  shiftSet:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  shiftTime:    { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  editTime:     { color: '#38bdf8', fontSize: 12 },
  addDayBtn:    { flex: 1, paddingVertical: 4 },
  addDayTxt:    { color: '#334155', fontSize: 13 },
  publishBtn:   { backgroundColor: '#10b981', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  publishBtnTxt:{ color: '#fff', fontSize: 15, fontWeight: '800' },
  cancelBtn:    { backgroundColor: '#1e293b', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  cancelBtnTxt: { color: '#94a3b8', fontSize: 14 },
  disabled:     { opacity: 0.6 },
  fieldLabel:   { color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  timeInput:    { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 16 },
  templateItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b', gap: 10 },
  templateItemName:{ color: '#fff', fontSize: 14, fontWeight: '700' },
  templateItemDays:{ color: '#64748b', fontSize: 12, marginTop: 2 },
});
