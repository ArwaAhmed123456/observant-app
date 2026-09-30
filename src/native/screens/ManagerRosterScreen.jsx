import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, Switch,
} from 'react-native';
import { useApp, formatDate } from '../../context/AppContext';
import { ChevronLeft, ChevronRight, Save, Bookmark, Trash2, Send, Clock } from 'lucide-react-native';
import { AppHeader } from '../components/AppHeader';
import { EmptyState } from '../components/EmptyState';
import { P, SP, BR, FONT, SH_TOKENS, card, input, btnPrimary, btnGold } from '../../ds';

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
  const {
    currentUser, users, sites, checkpoints, publishRoster,
    getWeekRosters, getGuardRoster,
    rosterTemplates, saveRosterTemplate, deleteRosterTemplate,
  } = useApp();

  const [weekStart, setWeekStart]         = useState(getMondayOfWeek(new Date()));
  const [selectedGuard, setSelectedGuard] = useState(null);
  const [editDays, setEditDays]           = useState({ ...DEFAULT_DAYS });
  const [editCheckpointIds, setEditCheckpointIds] = useState([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [timeModal, setTimeModal]         = useState(null);
  const [startTime, setStartTime]         = useState('18:00');
  const [endTime, setEndTime]             = useState('06:00');
  const [templateName, setTemplateName]   = useState('');
  const [saveTemplateModal, setSaveTemplateModal] = useState(false);
  const [templateModal, setTemplateModal] = useState(false);
  const [publishing, setPublishing]       = useState(false);

  const guards  = users.filter(u => u.role === 'guard' && currentUser.siteIds?.includes(u.siteId));
  const weekKey = toWeekKey(weekStart);

  const prevWeek = () => setWeekStart(prev => addDays(prev, -7));
  const nextWeek = () => setWeekStart(prev => addDays(prev, 7));

  const openEditForGuard = (guard) => {
    setSelectedGuard(guard);
    const existing = getGuardRoster(guard.id, weekKey);
    setEditDays(existing?.days ? { ...DEFAULT_DAYS, ...existing.days } : { ...DEFAULT_DAYS });
    setEditCheckpointIds(existing?.checkpointIds || []);
    setEditModalVisible(true);
  };

  const confirmTime = () => {
    if (!timeModal) return;
    const validTime = value => {
      if (!/^\d{2}:\d{2}$/.test(value)) return false;
      const [hours, minutes] = value.split(':').map(Number);
      return hours < 24 && minutes < 60;
    };
    if (!validTime(startTime) || !validTime(endTime) || startTime === endTime) {
      Alert.alert('Invalid time', 'Use HH:MM format (e.g. 18:00)');
      return;
    }
    setEditDays(prev => ({ ...prev, [timeModal.dayKey]: { start: startTime, end: endTime } }));
    setTimeModal(null);
  };

  const handleSaveRoster = async () => {
    if (!selectedGuard) return;
    const workDays = DAY_KEYS.filter(key => editDays[key]);
    if (!workDays.length) return Alert.alert('Add a shift first', 'Choose at least one working day before publishing this rota.');
    setPublishing(true);
    try {
      const saved = await publishRoster({
        guardId: selectedGuard.id,
        siteId: selectedGuard.siteId,
        weekStartDate: weekKey,
        days: editDays,
        checkpointIds: editCheckpointIds,
        publishedBy: currentUser.id,
        publishedAt: new Date().toISOString(),
      });
      setEditModalVisible(false);
      const summary = workDays.map(key => `${DAY_LABELS[DAY_KEYS.indexOf(key)]} ${editDays[key].start}–${editDays[key].end}`).join(', ');
      const notification = saved?.id?.startsWith('ro_')
        ? `Demo notification preview for ${selectedGuard.name}: ${summary}.`
        : saved?.notifiedAt
          ? `${selectedGuard.name} was notified: ${summary}.`
          : `The rota was saved, but no push was sent because the guard has no registered device: ${summary}.`;
      Alert.alert('Rota published', `${notification}\n${editCheckpointIds.length} patrol checkpoint${editCheckpointIds.length === 1 ? '' : 's'} assigned.`);
    } catch (error) {
      Alert.alert('Could not publish rota', error.message || 'Check your connection and try again.');
    } finally {
      setPublishing(false);
    }
  };

  const handleLoadTemplate = (template) => {
    setEditDays({ ...DEFAULT_DAYS, ...template.days });
    const siteCheckpointIds = new Set((checkpoints || []).filter(checkpoint => checkpoint.siteId === selectedGuard?.siteId).map(checkpoint => checkpoint.id));
    setEditCheckpointIds((template.checkpointIds || []).filter(id => siteCheckpointIds.has(id)));
    setTemplateModal(false);
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) { Alert.alert('Name required'); return; }
    await saveRosterTemplate({ name: templateName.trim(), guardId: selectedGuard?.id, days: editDays, checkpointIds: editCheckpointIds });
    setTemplateName('');
    setSaveTemplateModal(false);
  };

  return (
    <View style={styles.root}>
      <AppHeader />
      <View style={styles.content}>
        <Text style={styles.screenTitle}>Shift Scheduler</Text>
        <Text style={styles.screenIntro}>Plan guard coverage, checkpoints, and notifications for the week.</Text>

        {/* Week nav */}
        <View style={styles.weekNav}>
          <TouchableOpacity onPress={prevWeek} style={styles.navBtn}>
            <ChevronLeft color={P.t2} size={20} />
          </TouchableOpacity>
          <Text style={styles.weekLabel}>
            {formatDate(weekStart)} – {formatDate(addDays(weekStart, 6))}
          </Text>
          <TouchableOpacity onPress={nextWeek} style={styles.navBtn}>
            <ChevronRight color={P.t2} size={20} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {guards.length === 0 ? (
            <View style={{ marginTop: SP.px24 }}>
              <EmptyState
                variant="shield"
                title="No guards assigned"
                message="No guards are currently assigned to your sites."
              />
            </View>
          ) : (
            guards.map(guard => {
              const site      = sites.find(s => s.id === guard.siteId);
              const roster    = getGuardRoster(guard.id, weekKey);
              const workedDays = roster ? DAY_KEYS.filter(k => roster.days?.[k]).length : 0;

              return (
                <TouchableOpacity
                  key={guard.id}
                  style={styles.guardRow}
                  onPress={() => openEditForGuard(guard)}
                >
                  {/* Status accent */}
                  <View style={[styles.guardAccent, { backgroundColor: roster ? P.ok : P.b3 }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.guardName}>{guard.name}</Text>
                    <Text style={styles.guardSite}>{site?.name}</Text>
                    {roster ? (
                      <View>
                        <View style={styles.dayPills}>
                          {DAY_KEYS.map((k, i) => (
                            <View key={k} style={[styles.dayPill, roster.days?.[k] && styles.dayPillActive]}>
                              <Text style={[styles.dayPillTxt, roster.days?.[k] && styles.dayPillTxtActive]}>{DAY_LABELS[i].charAt(0)}</Text>
                            </View>
                          ))}
                        </View>
                        <Text style={styles.rotaSummary} numberOfLines={2}>
                          {DAY_KEYS.filter(key => roster.days?.[key]).map(key => `${DAY_LABELS[DAY_KEYS.indexOf(key)]} ${roster.days[key].start}–${roster.days[key].end}`).join('  ·  ')}
                        </Text>
                        {!!roster.checkpointIds?.length && <Text style={styles.rotaSummary}>{roster.checkpointIds.length} assigned checkpoint{roster.checkpointIds.length === 1 ? '' : 's'}</Text>}
                      </View>
                    ) : (
                      <Text style={styles.noRoster}>No schedule published</Text>
                    )}
                  </View>
                  <View style={[styles.editBtn, { backgroundColor: roster ? P.blueSubtle : P.bg3, borderColor: roster ? P.blueBorder : P.b2 }]}>
                    <Text style={[styles.editBtnTxt, { color: roster ? P.info : P.t3 }]}>
                      {roster ? 'Edit' : '+ Add'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        {/* Edit Roster Modal */}
        <Modal visible={editModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>{selectedGuard?.name}</Text>
                  <Text style={styles.modalSub}>{formatDate(weekStart)} – {formatDate(addDays(weekStart, 6))}</Text>
                </View>
                <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnTxt}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Template buttons */}
              <View style={styles.templateRow}>
                <TouchableOpacity style={styles.templateBtn} onPress={() => setTemplateModal(true)}>
                  <Bookmark color={P.info} size={13} />
                  <Text style={styles.templateBtnTxt}>Load Template</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.templateBtn} onPress={() => setSaveTemplateModal(true)}>
                  <Save color={P.ok} size={13} />
                  <Text style={styles.templateBtnTxt}>Save as Template</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 360 }}>
                {DAY_KEYS.map((key, i) => {
                  const shift = editDays[key];
                  return (
                    <View key={key} style={styles.dayRow}>
                      <Text style={styles.dayLabel}>{DAY_LABELS[i]}</Text>
                      {shift ? (
                        <View style={styles.shiftSet}>
                          <Clock size={12} color={P.ok} />
                          <Text style={styles.shiftTime}>{shift.start} – {shift.end}</Text>
                          <TouchableOpacity onPress={() => { setStartTime(shift.start); setEndTime(shift.end); setTimeModal({ dayKey: key, editing: true }); }}>
                            <Text style={styles.editTimeBtn}>Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setEditDays(prev => ({ ...prev, [key]: null }))}>
                            <Trash2 color={P.danger} size={15} />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.addDayBtn}
                          onPress={() => { setStartTime('18:00'); setEndTime('06:00'); setTimeModal({ dayKey: key }); }}
                        >
                          <Text style={styles.addDayTxt}>+ Add Shift</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
                <View style={styles.checkpointSection}>
                  <View style={styles.checkpointHeading}>
                    <Text style={styles.modalSub}>SITE CHECKPOINTS</Text>
                    <Text style={styles.checkpointCount}>{editCheckpointIds.length} selected</Text>
                  </View>
                  {(checkpoints || []).filter(checkpoint => checkpoint.siteId === selectedGuard?.siteId && checkpoint.active !== false).length === 0 ? (
                    <Text style={styles.emptyHint}>No active checkpoints are configured for this guard’s site.</Text>
                  ) : (checkpoints || []).filter(checkpoint => checkpoint.siteId === selectedGuard?.siteId && checkpoint.active !== false).map((checkpoint, index) => {
                    const selected = editCheckpointIds.includes(checkpoint.id);
                    return (
                      <TouchableOpacity
                        key={checkpoint.id}
                        style={styles.checkpointRow}
                        onPress={() => setEditCheckpointIds(previous => selected ? previous.filter(id => id !== checkpoint.id) : [...previous, checkpoint.id])}
                      >
                        <View style={[styles.checkpointMarker, selected && styles.checkpointMarkerSelected]}>
                          <Text style={[styles.checkpointMarkerText, selected && styles.checkpointMarkerTextSelected]}>{selected ? '✓' : index + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.checkpointName}>{checkpoint.name}</Text>
                          <Text style={styles.checkpointMeta}>{checkpoint.nfcRequired ? 'NFC verification' : checkpoint.required ? 'Required photo' : 'Optional checkpoint'}</Text>
                        </View>
                        <Switch value={selected} onValueChange={() => setEditCheckpointIds(previous => selected ? previous.filter(id => id !== checkpoint.id) : [...previous, checkpoint.id])} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <TouchableOpacity
                style={[btnGold, { marginTop: SP.px16, opacity: publishing ? 0.6 : 1 }]}
                onPress={handleSaveRoster}
                disabled={publishing}
              >
                <Send color={P.black} size={15} />
                <Text style={styles.publishBtnTxt}>{publishing ? 'Publishing…' : 'Publish & Notify Rota'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Time Picker Modal */}
        <Modal visible={!!timeModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { paddingBottom: SP.px24 }]}>
              <Text style={styles.modalTitle}>Set Shift Times</Text>
              <Text style={styles.fieldLabel}>Start Time (HH:MM)</Text>
              <TextInput
                style={[input, { color: P.t1, marginBottom: SP.px12 }]}
                value={startTime} onChangeText={setStartTime}
                placeholder="e.g. 18:00" placeholderTextColor={P.t4}
                keyboardType="numbers-and-punctuation"
              />
              <Text style={styles.fieldLabel}>End Time (HH:MM)</Text>
              <TextInput
                style={[input, { color: P.t1, marginBottom: SP.px16 }]}
                value={endTime} onChangeText={setEndTime}
                placeholder="e.g. 06:00" placeholderTextColor={P.t4}
                keyboardType="numbers-and-punctuation"
              />
              <TouchableOpacity style={btnPrimary} onPress={confirmTime}>
                <Text style={{ color: P.white, fontSize: 15, fontWeight: '800' }}>Confirm</Text>
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
              <TextInput
                style={[input, { color: P.t1, marginBottom: SP.px16, marginTop: SP.px16 }]}
                value={templateName} onChangeText={setTemplateName}
                placeholder="e.g. Ahmad's usual week"
                placeholderTextColor={P.t4}
              />
              <TouchableOpacity style={btnPrimary} onPress={handleSaveTemplate}>
                <Text style={{ color: P.white, fontSize: 15, fontWeight: '800' }}>Save Template</Text>
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
              <ScrollView style={{ maxHeight: 300, marginTop: SP.px16 }}>
                {rosterTemplates.map(t => (
                  <View key={t.id} style={styles.templateItem}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => handleLoadTemplate(t)}>
                      <Text style={styles.templateItemName}>{t.name}</Text>
                      <Text style={styles.templateItemDays}>
                        {DAY_KEYS.filter(k => t.days?.[k]).map(k => DAY_LABELS[DAY_KEYS.indexOf(k)]).join(', ') || 'No days'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteRosterTemplate(t.id)}>
                      <Trash2 color={P.danger} size={15} />
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
  root:          { flex: 1, backgroundColor: P.bg0 },
  content:       { flex: 1, padding: SP.px20 },
  screenTitle:   { ...FONT.h2, marginBottom: SP.px16 },
  screenIntro:   { color: P.t3, fontSize: 13, lineHeight: 18, marginTop: -SP.px12, marginBottom: SP.px16 },

  weekNav:       { flexDirection: 'row', alignItems: 'center', marginBottom: SP.px16 },
  navBtn:        { padding: 8, backgroundColor: P.bg2, borderRadius: BR.sm, borderWidth: 1, borderColor: P.b2 },
  weekLabel:     { flex: 1, color: P.t1, fontSize: 13, fontWeight: '600', textAlign: 'center' },

  emptyHint:     { color: P.t3, fontSize: 13, textAlign: 'center', marginTop: SP.px16 },
  checkpointSection:{ marginTop: SP.px16, paddingTop: SP.px16, borderTopWidth: 1, borderTopColor: P.b1 },
  checkpointHeading:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SP.px8 },
  checkpointCount:{ color: P.info, fontSize: 11, fontWeight: '700' },
  checkpointRow:{ flexDirection: 'row', alignItems: 'center', gap: SP.px12, paddingVertical: SP.px10, borderBottomWidth: 1, borderBottomColor: P.b1 },
  checkpointMarker:{ width: 30, height: 30, borderRadius: 15, backgroundColor: P.bg3, alignItems: 'center', justifyContent: 'center' },
  checkpointMarkerSelected:{ backgroundColor: P.okSubtle, borderWidth: 1, borderColor: P.okBorder },
  checkpointMarkerText:{ color: P.t3, fontSize: 12, fontWeight: '700' },
  checkpointMarkerTextSelected:{ color: P.ok },
  checkpointName:{ color: P.t1, fontSize: 13, fontWeight: '700' },
  checkpointMeta:{ color: P.t3, fontSize: 11, marginTop: 2 },

  guardRow:      { ...card, flexDirection: 'row', alignItems: 'center', padding: SP.px16, marginBottom: SP.px8, overflow: 'hidden' },
  guardAccent:   { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: BR.lg, borderBottomLeftRadius: BR.lg },
  guardName:     { color: P.t1, fontSize: 15, fontWeight: '700' },
  guardSite:     { color: P.t3, fontSize: 12, marginBottom: 8 },
  dayPills:      { flexDirection: 'row', gap: 4 },
  rotaSummary:   { color: P.t3, fontSize: 10, marginTop: 5, fontVariant: ['tabular-nums'] },
  dayPill:       { width: 22, height: 22, borderRadius: 11, backgroundColor: P.bg3, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: P.b2 },
  dayPillActive: { backgroundColor: P.okSubtle, borderColor: P.okBorder },
  dayPillTxt:    { color: P.t4, fontSize: 9, fontWeight: '800' },
  dayPillTxtActive:{ color: P.ok },
  noRoster:      { color: P.t4, fontSize: 12, fontStyle: 'italic' },
  editBtn:       { borderRadius: BR.xs, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 },
  editBtnTxt:    { fontSize: 12, fontWeight: '700' },

  modalOverlay:  { flex: 1, backgroundColor: P.overlay, justifyContent: 'flex-end' },
  modalCard:     { backgroundColor: P.bg2, borderTopLeftRadius: BR.xl, borderTopRightRadius: BR.xl, padding: SP.px24, borderWidth: 1, borderColor: P.b2, ...SH_TOKENS.lg },
  modalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SP.px16 },
  modalTitle:    { ...FONT.h3 },
  modalSub:      { color: P.t3, fontSize: 12, marginTop: 3 },
  closeBtn:      { width: 30, height: 30, backgroundColor: P.bg3, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: P.b2 },
  closeBtnTxt:   { color: P.t2, fontSize: 16 },

  templateRow:   { flexDirection: 'row', gap: SP.px8, marginBottom: SP.px16 },
  templateBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: P.bg3, borderRadius: BR.sm, paddingHorizontal: SP.px12, paddingVertical: 9, justifyContent: 'center', borderWidth: 1, borderColor: P.b2 },
  templateBtnTxt:{ color: P.t2, fontSize: 12, fontWeight: '600' },

  dayRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: P.b1 },
  dayLabel:      { color: P.t2, fontSize: 13, width: 44, fontWeight: '700' },
  shiftSet:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  shiftTime:     { color: P.t1, fontSize: 14, fontWeight: '700', flex: 1 },
  editTimeBtn:   { color: P.info, fontSize: 12, fontWeight: '600' },
  addDayBtn:     { flex: 1, paddingVertical: 4 },
  addDayTxt:     { color: P.t3, fontSize: 13 },

  publishBtnTxt: { color: P.black, fontSize: 15, fontWeight: '800' },
  cancelBtn:     { backgroundColor: P.bg3, borderRadius: BR.md, paddingVertical: 13, alignItems: 'center', marginTop: SP.px8, borderWidth: 1, borderColor: P.b2 },
  cancelBtnTxt:  { color: P.t2, fontSize: 14 },
  fieldLabel:    { color: P.t2, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SP.px8 },

  templateItem:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: P.b1, gap: 10 },
  templateItemName:  { color: P.t1, fontSize: 14, fontWeight: '700' },
  templateItemDays:  { color: P.t3, fontSize: 12, marginTop: 2 },
});
