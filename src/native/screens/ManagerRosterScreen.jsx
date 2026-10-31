import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, Switch, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useApp, formatDate } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, ChevronDown, Save, Bookmark, Trash2, Send, Clock, UserRound, Plus } from 'lucide-react-native';
import { AppHeader } from '../components/AppHeader';
import { EmptyState } from '../components/EmptyState';
import { P, SP, BR, FONT, SH_TOKENS, card, input, btnPrimary, btnGold } from '../../ds';
import { getUKMondayDate } from '../../utils/scheduleDates';
import { useFocusEffect } from '@react-navigation/native';

const DAY_KEYS   = ['mon','tue','wed','thu','fri','sat','sun'];
const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toWeekKey(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftMinutes(value) {
  if (!/^\d{2}:\d{2}$/.test(String(value || ''))) return null;
  const [hours, minutes] = String(value).split(':').map(Number);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

function getShiftInterval(day, shift) {
  const dayIndex = DAY_KEYS.indexOf(day);
  const start = shiftMinutes(shift?.start);
  const rawEnd = shiftMinutes(shift?.end);
  if (dayIndex < 0 || start == null || rawEnd == null) return null;
  const absoluteStart = dayIndex * 1440 + start;
  return { start: absoluteStart, end: dayIndex * 1440 + rawEnd + (rawEnd <= start ? 1440 : 0), day };
}

function findWeeklyShiftConflict(firstDays, secondDays) {
  const weekMinutes = 7 * 1440;
  for (const firstDay of DAY_KEYS) {
    const first = getShiftInterval(firstDay, firstDays?.[firstDay]);
    if (!first) continue;
    for (const secondDay of DAY_KEYS) {
      const second = getShiftInterval(secondDay, secondDays?.[secondDay]);
      if (!second) continue;
      for (const offset of [-weekMinutes, 0, weekMinutes]) {
        if (Math.max(first.start, second.start + offset) < Math.min(first.end, second.end + offset)) {
          return { firstDay, secondDay };
        }
      }
    }
  }
  return null;
}

const DEFAULT_DAYS = { mon:null,tue:null,wed:null,thu:null,fri:null,sat:null,sun:null };

export function ManagerRosterScreen() {
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, Platform.OS === 'android' ? 36 : 16);
  const {
    currentUser, users, sites, checkpoints, publishRoster,
    getWeekRosters, refreshUsers, refreshSites, refreshRosters,
    rosterTemplates, saveRosterTemplate, deleteRosterTemplate,
  } = useApp();

  const [weekStart, setWeekStart]         = useState(getUKMondayDate(new Date()));
  const [selectedGuard, setSelectedGuard] = useState(null);
  const [selectedRosterSiteId, setSelectedRosterSiteId] = useState('');
  const [editDays, setEditDays]           = useState({ ...DEFAULT_DAYS });
  const [editCheckpointIds, setEditCheckpointIds] = useState([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [timeModal, setTimeModal]         = useState(null);
  const [startTime, setStartTime]         = useState('07:00');
  const [endTime, setEndTime]             = useState('19:00');
  const [templateName, setTemplateName]   = useState('');
  const [saveTemplateModal, setSaveTemplateModal] = useState(false);
  const [templateModal, setTemplateModal] = useState(false);
  const [publishing, setPublishing]       = useState(false);
  const [guardPickerVisible, setGuardPickerVisible] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(null);
  const [checkCallInterval, setCheckCallInterval] = useState(60);
  const [recurringWeekly, setRecurringWeekly] = useState(true);
  const [shiftInstructions, setShiftInstructions] = useState('');
  const [siteDrafts, setSiteDrafts] = useState({});
  const [scheduleDataError, setScheduleDataError] = useState('');
  const [refreshingScheduleData, setRefreshingScheduleData] = useState(false);

  const reloadScheduleData = useCallback(async () => {
    setRefreshingScheduleData(true);
    setScheduleDataError('');
    const results = await Promise.allSettled([refreshUsers(), refreshSites(), refreshRosters()]);
    const failed = results.find(result => result.status === 'rejected');
    if (failed) setScheduleDataError(failed.reason?.message || 'Schedule data could not be refreshed.');
    setRefreshingScheduleData(false);
  }, [refreshUsers, refreshSites, refreshRosters]);

  useFocusEffect(useCallback(() => {
    reloadScheduleData();
  }, [reloadScheduleData]));

  const guardSiteIds = (guard) => [...new Set([guard.siteId, ...(guard.assignedSiteIds || [])].map(value => String(value?._id || value?.id || value || '')).filter(Boolean))];
  const guardSiteId = (guard) => guardSiteIds(guard)[0] || '';
  const currentUserId = String(currentUser?.id || currentUser?._id || '');
  const managerSiteIds = new Set([
    ...(currentUser?.siteIds || []),
    ...(currentUser?.managedSiteIds || []),
    ...(currentUser?.siteId ? [currentUser.siteId] : []),
    ...(sites || []).filter(site => String(site.managerId || '') === currentUserId).map(site => site.id || site._id),
  ].filter(Boolean).map(String));
  const isAllAdmin = currentUser.role === 'superadmin' || currentUser.role === 'admin';
  const guards = users.filter(u =>
    u.role === 'guard' &&
    (isAllAdmin || managerSiteIds.size === 0 || guardSiteIds(u).some(id => managerSiteIds.has(id)))
  );
  const weekKey = toWeekKey(weekStart);

  const prevWeek = () => setWeekStart(prev => addDays(prev, -7));
  const nextWeek = () => setWeekStart(prev => addDays(prev, 7));

  const openEditForGuard = (guard) => {
    setSelectedGuard(guard);
    const gId = guard.id || guard._id;
    const existingRosters = getWeekRosters(weekKey).filter(roster => String(roster.guardId?._id || roster.guardId?.id || roster.guardId || '') === String(gId));
    const initialDrafts = Object.fromEntries(existingRosters.map(roster => {
      const siteId = String(roster.siteId?._id || roster.siteId?.id || roster.siteId || '');
      return [siteId, {
        days: { ...DEFAULT_DAYS, ...(roster.days || {}) },
        checkpointIds: roster.checkpointIds || [],
        checkCallInterval: roster.checkCallInterval || 60,
        recurringWeekly: roster.recurringWeekly ?? true,
        shiftInstructions: roster.shiftInstructions || '',
      }];
    }));
    const assignedIds = guardSiteIds(guard);
    const activeSiteId = assignedIds.find(id => initialDrafts[id]) || assignedIds[0] || '';
    const activeDraft = initialDrafts[activeSiteId] || {
      days: { ...DEFAULT_DAYS }, checkpointIds: [], checkCallInterval: 60,
      recurringWeekly: true, shiftInstructions: '',
    };
    setSiteDrafts(initialDrafts);
    setSelectedRosterSiteId(activeSiteId);
    setEditDays(activeDraft.days);
    setEditCheckpointIds(activeDraft.checkpointIds);
    setCheckCallInterval(activeDraft.checkCallInterval);
    setRecurringWeekly(activeDraft.recurringWeekly);
    setShiftInstructions(activeDraft.shiftInstructions);
    setGuardPickerVisible(false);
    setEditModalVisible(true);
  };

  const applyPreset = (start, end) => {
    setEditDays({
      mon: { start, end },
      tue: { start, end },
      wed: { start, end },
      thu: { start, end },
      fri: { start, end },
      sat: null,
      sun: null,
    });
  };

  const toggleDay = (key) => setEditDays(previous => ({
    ...previous,
    [key]: previous[key] ? null : { start: '07:00', end: '19:00' },
  }));

  const confirmTime = () => {
    if (!timeModal) return;
    const validTime = value => {
      if (!/^\d{2}:\d{2}$/.test(value)) return false;
      const [hours, minutes] = value.split(':').map(Number);
      return hours < 24 && minutes < 60;
    };
    if (!validTime(startTime) || !validTime(endTime) || startTime === endTime) {
      Alert.alert('Invalid time', 'Use HH:MM format (for example, 07:00).');
      return;
    }
    setEditDays(prev => ({ ...prev, [timeModal.dayKey]: { start: startTime, end: endTime } }));
    setTimeModal(null);
    setTimePickerOpen(null);
  };

  const handleSaveRoster = async () => {
    if (!selectedGuard) return;
    const drafts = {
      ...siteDrafts,
      [selectedRosterSiteId]: {
        days: editDays, checkpointIds: editCheckpointIds, checkCallInterval,
        recurringWeekly, shiftInstructions,
      },
    };
    const assignedIds = guardSiteIds(selectedGuard);
    const existingSiteIds = new Set(getWeekRosters(weekKey)
      .filter(roster => String(roster.guardId?._id || roster.guardId?.id || roster.guardId || '') === String(selectedGuard.id || selectedGuard._id))
      .map(roster => String(roster.siteId?._id || roster.siteId?.id || roster.siteId || '')));
    const scheduledSites = assignedIds.map(siteId => ({ siteId, ...(drafts[siteId] || {}) }))
      .filter(draft => draft.siteId && draft.days && (
        DAY_KEYS.some(key => draft.days[key]) || draft.siteId === selectedRosterSiteId || existingSiteIds.has(draft.siteId)
      ));
    if (!scheduledSites.length) return Alert.alert('Add a shift first', 'Choose at least one working day for an assigned site.');
    const plannedBySite = new Map(getWeekRosters(weekKey)
      .filter(roster => String(roster.guardId?._id || roster.guardId?.id || roster.guardId || '') === String(selectedGuard.id || selectedGuard._id))
      .map(roster => [String(roster.siteId?._id || roster.siteId?.id || roster.siteId || ''), roster.days || {}]));
    scheduledSites.forEach(draft => plannedBySite.set(draft.siteId, draft.days));
    const planned = [...plannedBySite.entries()];
    for (let i = 0; i < planned.length; i += 1) {
      for (let j = i + 1; j < planned.length; j += 1) {
        const conflict = findWeeklyShiftConflict(planned[i][1], planned[j][1]);
        if (conflict) {
          const siteName = id => sites.find(item => String(item.id || item._id) === id)?.name || 'another site';
          const day = DAY_LABELS[DAY_KEYS.indexOf(conflict.firstDay)];
          return Alert.alert('Schedule conflict', `${selectedGuard.name} has overlapping shifts at ${siteName(planned[i][0])} and ${siteName(planned[j][0])} (${day} or an overnight crossover). Adjust one site’s shift before saving.`);
        }
      }
    }
    setPublishing(true);
    try {
      const guardId = selectedGuard.id || selectedGuard._id;
      const savedRosters = [];
      for (const draft of scheduledSites) {
        savedRosters.push(await publishRoster({
          guardId, siteId: draft.siteId, weekStartDate: weekKey,
          days: draft.days, checkpointIds: draft.checkpointIds || [],
          checkCallInterval: draft.checkCallInterval || 60,
          recurringWeekly: draft.recurringWeekly ?? true,
          shiftInstructions: String(draft.shiftInstructions || '').trim(),
          publishedBy: currentUser.id || currentUser._id,
          publishedAt: new Date().toISOString(),
        }));
      }
      setEditModalVisible(false);
      const siteNames = scheduledSites.map(({ siteId, days }) => {
        const siteName = sites.find(site => String(site.id || site._id) === siteId)?.name || 'Assigned site';
        const times = DAY_KEYS.filter(key => days[key]).map(key => `${DAY_LABELS[DAY_KEYS.indexOf(key)]} ${days[key].start}–${days[key].end}`).join(', ');
        return `${siteName}: ${times}`;
      }).join('\n');
      const notified = savedRosters.some(saved => saved?.notifiedAt);
      const demo = savedRosters.every(saved => saved?.id?.startsWith('ro_'));
      const notification = demo
        ? `Demo schedule saved for ${selectedGuard.name}.`
        : notified
          ? `${selectedGuard.name} was notified about the assigned shifts.`
          : `Schedules saved, but no push was sent because the guard has no registered device.`;
      Alert.alert('Rota published', `${notification}\n\n${siteNames}`);
    } catch (error) {
      Alert.alert('Could not publish rota', error.message || 'Check your connection and try again.');
    } finally {
      setPublishing(false);
    }
  };

  const handleLoadTemplate = (template) => {
    setEditDays({ ...DEFAULT_DAYS, ...template.days });
    const siteCheckpointIds = new Set((checkpoints || []).filter(checkpoint => String(checkpoint.siteId) === String(selectedRosterSiteId)).map(checkpoint => checkpoint.id));
    setEditCheckpointIds((template.checkpointIds || []).filter(id => siteCheckpointIds.has(id)));
    setTemplateModal(false);
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) { Alert.alert('Name required'); return; }
    try {
      await saveRosterTemplate({ name: templateName.trim(), guardId: selectedGuard?.id, days: editDays, checkpointIds: editCheckpointIds });
      setTemplateName('');
      setSaveTemplateModal(false);
      Alert.alert('Template saved', `${templateName.trim()} is ready to use.`);
    } catch (error) {
      Alert.alert('Could not save template', error.message || 'Check your connection and try again.');
    }
  };

  const handleDeleteTemplate = (template) => {
    Alert.alert('Delete template?', `Remove “${template.name}” from saved schedule templates?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await deleteRosterTemplate(template.id || template._id);
        } catch (error) {
          Alert.alert('Could not delete template', error.message || 'Check your connection and try again.');
        }
      } },
    ]);
  };

  return (
    <View style={styles.root}>
      <AppHeader />
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.screenTitle}>Shift Scheduler</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Add schedule"
            style={styles.addScheduleBtn}
            onPress={() => setGuardPickerVisible(true)}
          >
            <Plus size={15} color={P.white} />
            <Text style={styles.addScheduleTxt}>Add schedule</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.screenIntro}>Assign weekly coverage and publish shift details directly to each guard.</Text>
        {!!scheduleDataError && (
          <View style={styles.loadErrorBox}>
            <Text style={styles.loadErrorText}>{scheduleDataError}</Text>
            <TouchableOpacity accessibilityRole="button" onPress={reloadScheduleData} disabled={refreshingScheduleData}>
              <Text style={styles.retryText}>{refreshingScheduleData ? 'Refreshing…' : 'Retry'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.fieldLabel}>GUARD SELECTION</Text>
        <TouchableOpacity style={styles.guardDropdown} onPress={() => setGuardPickerVisible(true)} activeOpacity={0.78}>
          <View style={styles.guardDropdownIcon}><UserRound size={17} color={P.blue} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.guardDropdownName}>{selectedGuard?.name || 'Choose a security officer'}</Text>
            <Text style={styles.guardDropdownMeta}>{selectedGuard ? (sites.find(site => String(site.id || site._id) === guardSiteId(selectedGuard))?.name || 'Assigned site') : `${guards.length} guard${guards.length === 1 ? '' : 's'} available`}</Text>
          </View>
          <ChevronDown size={19} color={P.t3} />
        </TouchableOpacity>

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
              const gId       = guard.id || guard._id;
              const gSiteId   = guardSiteId(guard);
              const site      = sites.find(s => s.id === gSiteId || s._id === gSiteId || String(s.id || s._id) === String(gSiteId));
              const guardRosters = getWeekRosters(weekKey).filter(roster =>
                String(roster.guardId?._id || roster.guardId?.id || roster.guardId || '') === String(gId)
              );
              const roster = guardRosters.find(item => String(item.siteId?._id || item.siteId?.id || item.siteId || '') === gSiteId) || guardRosters[0] || null;

              return (
                <TouchableOpacity
                  key={gId}
                  style={styles.guardRow}
                  onPress={() => openEditForGuard(guard)}
                >
                  {/* Status accent */}
                  <View style={[styles.guardAccent, { backgroundColor: roster ? P.ok : P.b3 }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.guardName}>{guard.name}</Text>
                    <Text style={styles.guardSite}>{guardSiteIds(guard).map(siteId => sites.find(item => String(item.id || item._id) === siteId)?.name).filter(Boolean).join(' · ') || site?.name || 'Assigned site'}</Text>
                    {guardRosters.length ? (
                      <View>
                        {guardRosters.map(item => {
                          const itemSiteId = String(item.siteId?._id || item.siteId?.id || item.siteId || '');
                          const itemSite = sites.find(entry => String(entry.id || entry._id) === itemSiteId);
                          return <View key={item.id || item._id || itemSiteId} style={{ marginTop: 4 }}>
                            <Text style={styles.rotaSummary} numberOfLines={1}>{itemSite?.name || 'Assigned site'}</Text>
                            <View style={styles.dayPills}>
                              {DAY_KEYS.map((k, i) => (
                                <View key={`${itemSiteId}-${k}`} style={[styles.dayPill, item.days?.[k] && styles.dayPillActive]}>
                                  <Text style={[styles.dayPillTxt, item.days?.[k] && styles.dayPillTxtActive]}>{DAY_LABELS[i].charAt(0)}</Text>
                                </View>
                              ))}
                            </View>
                            <Text style={styles.rotaSummary} numberOfLines={2}>
                              {DAY_KEYS.filter(key => item.days?.[key]).map(key => `${DAY_LABELS[DAY_KEYS.indexOf(key)]} ${item.days[key].start}–${item.days[key].end}`).join('  ·  ') || 'No shifts assigned'}
                            </Text>
                          </View>;
                        })}
                        {!!roster?.checkpointIds?.length && <Text style={styles.rotaSummary}>{roster.checkpointIds.length} patrol checkpoint{roster.checkpointIds.length === 1 ? '' : 's'} on {site?.name || 'the selected site'}</Text>}
                      </View>
                    ) : (
                      <Text style={styles.noRoster}>No schedule published</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`${roster ? 'Edit' : 'Add'} schedule for ${guard.name}`}
                    style={[styles.editBtn, { backgroundColor: roster ? P.blueSubtle : P.bg3, borderColor: roster ? P.blueBorder : P.b2 }]}
                    onPress={event => { event.stopPropagation?.(); openEditForGuard(guard); }}
                  >
                    <Text style={[styles.editBtnTxt, { color: roster ? P.info : P.t3 }]}>
                      {roster ? 'Edit' : '+ Add'}
                    </Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        {/* Edit Roster Modal */}
        <Modal visible={editModalVisible} animationType="slide" transparent onRequestClose={() => setEditModalVisible(false)}>
          <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[styles.modalCard, { paddingBottom: safeBottom + 16 }]}>
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

              <Text style={styles.fieldLabel}>WORK SITES · SAVE SHIFTS FOR EACH SELECTED SITE</Text>
              <View style={styles.daySelector}>
                {(selectedGuard ? guardSiteIds(selectedGuard) : []).map(siteId => {
                  const site = sites.find(item => String(item.id || item._id) === siteId);
                  const active = selectedRosterSiteId === siteId;
                  return <TouchableOpacity key={siteId} style={[styles.daySelectorPill, active && styles.daySelectorPillActive]} onPress={() => {
                    const nextDrafts = {
                      ...siteDrafts,
                      [selectedRosterSiteId]: { days: editDays, checkpointIds: editCheckpointIds, checkCallInterval, recurringWeekly, shiftInstructions },
                    };
                    setSiteDrafts(nextDrafts);
                    setSelectedRosterSiteId(siteId);
                    const nextDraft = nextDrafts[siteId] || { days: { ...DEFAULT_DAYS }, checkpointIds: [], checkCallInterval: 60, recurringWeekly: true, shiftInstructions: '' };
                    setEditDays(nextDraft.days);
                    setEditCheckpointIds(nextDraft.checkpointIds);
                    setCheckCallInterval(nextDraft.checkCallInterval);
                    setRecurringWeekly(nextDraft.recurringWeekly);
                    setShiftInstructions(nextDraft.shiftInstructions);
                  }}><Text style={[styles.daySelectorText, active && styles.daySelectorTextActive]}>{site?.name || 'Assigned site'}</Text></TouchableOpacity>;
                })}
              </View>
              {guardSiteIds(selectedGuard || {}).length > 1 && (
                <Text style={[styles.emptyHint, { marginTop: -6, marginBottom: 10 }]}>
                  Set different shifts for each site. Saving publishes every assigned site that has working days.
                </Text>
              )}

              <Text style={styles.fieldLabel}>SELECT WORKING DAYS</Text>
              <View style={styles.daySelector}>
                {DAY_KEYS.map((key, index) => (
                  <TouchableOpacity key={key} style={[styles.daySelectorPill, editDays[key] && styles.daySelectorPillActive]} onPress={() => toggleDay(key)}>
                    <Text style={[styles.daySelectorText, editDays[key] && styles.daySelectorTextActive]}>{DAY_LABELS[index]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <ScrollView style={{ maxHeight: 360, flexShrink: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
                {DAY_KEYS.map((key, i) => {
                  const shift = editDays[key];
                  return (
                    <View key={key} style={styles.dayRow}>
                      <Text style={styles.dayLabel}>{DAY_LABELS[i]}</Text>
                      {shift ? (
                        <View style={styles.shiftSet}>
                          <Clock size={12} color={P.ok} />
                          <Text style={styles.shiftTime}>{shift.start} – {shift.end}</Text>
                          <TouchableOpacity onPress={() => { setStartTime(shift.start); setEndTime(shift.end); setTimePickerOpen(null); setTimeModal({ dayKey: key, editing: true }); }}>
                            <Text style={styles.editTimeBtn}>Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setEditDays(prev => ({ ...prev, [key]: null }))}>
                            <Trash2 color={P.danger} size={15} />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.addDayBtn}
                          onPress={() => { setStartTime('07:00'); setEndTime('19:00'); setTimePickerOpen(null); setTimeModal({ dayKey: key }); }}
                        >
                          <Text style={styles.addDayTxt}>+ Add Shift</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
                {/* Quick Presets */}
                <View style={{ marginTop: 10, marginBottom: 8 }}>
                  <Text style={[styles.fieldLabel, { marginBottom: 6 }]}>QUICK SHIFT PRESETS</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity style={[styles.daySelectorPill, { flex: 1, paddingVertical: 6 }]} onPress={() => applyPreset('07:00', '19:00')}>
                      <Text style={[styles.daySelectorText, { fontSize: 10 }]}>Day 12h (07-19)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.daySelectorPill, { flex: 1, paddingVertical: 6 }]} onPress={() => applyPreset('19:00', '07:00')}>
                      <Text style={[styles.daySelectorText, { fontSize: 10 }]}>Night 12h (19-07)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.daySelectorPill, { flex: 1, paddingVertical: 6 }]} onPress={() => applyPreset('08:00', '16:00')}>
                      <Text style={[styles.daySelectorText, { fontSize: 10 }]}>Standard 8h</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Check-Call SLA Interval */}
                <View style={{ marginVertical: 8 }}>
                  <Text style={[styles.fieldLabel, { marginBottom: 6 }]}>CHECK-CALL SLA INTERVAL</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {[30, 60, 90, 120].map(mins => (
                      <TouchableOpacity
                        key={mins}
                        style={[styles.daySelectorPill, checkCallInterval === mins && styles.daySelectorPillActive, { flex: 1, paddingVertical: 6 }]}
                        onPress={() => setCheckCallInterval(mins)}
                      >
                        <Text style={[styles.daySelectorText, checkCallInterval === mins && styles.daySelectorTextActive, { fontSize: 11 }]}>
                          {mins} mins
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Recurring weekly toggle */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8, paddingVertical: 4 }}>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: P.t1 }}>Recurring Schedule</Text>
                    <Text style={{ fontSize: 11, color: P.t3 }}>Auto-repeat this rota every week</Text>
                  </View>
                  <Switch value={recurringWeekly} onValueChange={setRecurringWeekly} />
                </View>

                {/* Shift Instructions / Post orders */}
                <View style={{ marginVertical: 8 }}>
                  <Text style={[styles.fieldLabel, { marginBottom: 4 }]}>SHIFT INSTRUCTIONS / POST ORDERS</Text>
                  <TextInput
                    style={[input, { color: P.t1, fontSize: 12, paddingVertical: 6, minHeight: 38 }]}
                    placeholder="e.g. Inspect all emergency exits on hourly patrols"
                    placeholderTextColor={P.t3}
                    value={shiftInstructions}
                    onChangeText={setShiftInstructions}
                  />
                </View>

                <View style={styles.checkpointSection}>
                  <View style={styles.checkpointHeading}>
                    <Text style={styles.modalSub}>SITE CHECKPOINTS</Text>
                    <Text style={styles.checkpointCount}>{editCheckpointIds.length} selected</Text>
                  </View>
                  {(checkpoints || []).filter(checkpoint => String(checkpoint.siteId) === String(selectedRosterSiteId) && checkpoint.active !== false).length === 0 ? (
                    <Text style={styles.emptyHint}>No active checkpoints are configured for this guard’s site.</Text>
                  ) : (checkpoints || []).filter(checkpoint => String(checkpoint.siteId) === String(selectedRosterSiteId) && checkpoint.active !== false).map((checkpoint, index) => {
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
                <Text style={styles.publishBtnTxt}>{publishing ? 'Saving…' : 'Save & Assign Shift'}</Text>
              </TouchableOpacity>
              {timeModal && (
                <View style={styles.timeEditorOverlay}>
                  <View style={styles.modalHeader}>
                    <View>
                      <Text style={styles.modalTitle}>{timeModal.editing ? 'Edit shift times' : 'Add shift'}</Text>
                      <Text style={styles.modalSub}>{DAY_LABELS[DAY_KEYS.indexOf(timeModal.dayKey)]} · choose start and end</Text>
                    </View>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Close shift time editor"
                      onPress={() => { setTimeModal(null); setTimePickerOpen(null); }}
                      style={styles.closeBtn}
                    >
                      <Text style={styles.closeBtnTxt}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>START TIME</Text>
                    <View style={styles.timeInputRow}>
                      <TextInput
                        accessibilityLabel="Shift start time"
                        style={[input, styles.timeInput]}
                        value={startTime}
                        onChangeText={setStartTime}
                        placeholder="07:00"
                        placeholderTextColor={P.t3}
                        keyboardType="numbers-and-punctuation"
                        maxLength={5}
                      />
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Choose shift start time"
                        style={styles.timePickerButton}
                        onPress={() => setTimePickerOpen(timePickerOpen === 'start' ? null : 'start')}
                      >
                        <Clock size={17} color={P.blue} />
                        <Text style={styles.timePickerValue}>{startTime}</Text>
                        <Text style={styles.timePickerHint}>PICK</Text>
                      </TouchableOpacity>
                    </View>
                    {timePickerOpen === 'start' && <TimeWheel value={startTime} onChange={setStartTime} />}

                    <Text style={[styles.fieldLabel, { marginTop: SP.px16 }]}>END TIME</Text>
                    <View style={styles.timeInputRow}>
                      <TextInput
                        accessibilityLabel="Shift end time"
                        style={[input, styles.timeInput]}
                        value={endTime}
                        onChangeText={setEndTime}
                        placeholder="19:00"
                        placeholderTextColor={P.t3}
                        keyboardType="numbers-and-punctuation"
                        maxLength={5}
                      />
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Choose shift end time"
                        style={styles.timePickerButton}
                        onPress={() => setTimePickerOpen(timePickerOpen === 'end' ? null : 'end')}
                      >
                        <Clock size={17} color={P.blue} />
                        <Text style={styles.timePickerValue}>{endTime}</Text>
                        <Text style={styles.timePickerHint}>PICK</Text>
                      </TouchableOpacity>
                    </View>
                    {timePickerOpen === 'end' && <TimeWheel value={endTime} onChange={setEndTime} />}
                  </ScrollView>
                  <TouchableOpacity style={[btnPrimary, { marginTop: SP.px12 }]} onPress={confirmTime}>
                    <Text style={{ color: P.white, fontSize: 15, fontWeight: '800' }}>Confirm Shift Time</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => { setTimeModal(null); setTimePickerOpen(null); }}>
                    <Text style={styles.cancelBtnTxt}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal visible={guardPickerVisible} transparent animationType="fade" onRequestClose={() => setGuardPickerVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.guardPickerCard, { paddingBottom: safeBottom + 20 }]}>
              <Text style={styles.modalTitle}>Choose a guard</Text>
              <Text style={styles.modalSub}>Select an officer to assign this week’s shifts.</Text>
              <ScrollView style={{ maxHeight: 420 }}>
                {guards.length ? guards.map(guard => (
                  <TouchableOpacity key={guard.id} style={styles.guardOption} onPress={() => openEditForGuard(guard)}>
                    <View style={styles.guardDropdownIcon}><UserRound size={17} color={P.blue} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.guardDropdownName}>{guard.name}</Text>
                      <Text style={styles.guardDropdownMeta}>{guardSiteIds(guard).map(siteId => sites.find(site => String(site.id || site._id) === siteId)?.name).filter(Boolean).join(' · ') || 'Assigned site'} · SIA: {guard.badgeNumber || '—'}</Text>
                    </View>
                    <ChevronRight size={17} color={P.t3} />
                  </TouchableOpacity>
                )) : <Text style={styles.emptyHint}>No active guards are assigned to your sites.</Text>}
              </ScrollView>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setGuardPickerVisible(false)}><Text style={styles.cancelBtnTxt}>Close</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Save Template Modal */}
        <Modal visible={saveTemplateModal} transparent animationType="fade" onRequestClose={() => setSaveTemplateModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { paddingBottom: safeBottom + 20 }]}>
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
        <Modal visible={templateModal} transparent animationType="slide" onRequestClose={() => setTemplateModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { paddingBottom: safeBottom + 20 }]}>
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
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Delete ${t.name}`} onPress={() => handleDeleteTemplate(t)}>
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

function TimeWheel({ value, onChange }) {
  const [hourText, minuteText] = (value || '07:00').split(':');
  const select = (hour, minute) => onChange(`${String(hour).padStart(2, '0')}:${minute}`);
  return (
    <View style={styles.timeWheel}>
      <Text style={styles.timeWheelLabel}>HOUR</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeWheelRow}>
        {Array.from({ length: 24 }, (_, hour) => {
          const selected = Number(hourText) === hour;
          return <TouchableOpacity key={hour} style={[styles.timeWheelItem, selected && styles.timeWheelItemSelected]} onPress={() => select(hour, minuteText || '00')}><Text style={[styles.timeWheelText, selected && styles.timeWheelTextSelected]}>{String(hour).padStart(2, '0')}</Text></TouchableOpacity>;
        })}
      </ScrollView>
      <Text style={styles.timeWheelLabel}>MINUTES</Text>
      <View style={styles.timeWheelRow}>
        {['00','15','30','45'].map(minute => {
          const selected = (minuteText || '00') === minute;
          return <TouchableOpacity key={minute} style={[styles.minuteWheelItem, selected && styles.timeWheelItemSelected]} onPress={() => select(hourText || '07', minute)}><Text style={[styles.timeWheelText, selected && styles.timeWheelTextSelected]}>{minute}</Text></TouchableOpacity>;
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: P.bg0 },
  content:       { flex: 1, padding: SP.px20 },
  screenTitle:   { ...FONT.h2, marginBottom: 0 },
  titleRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SP.px8 },
  addScheduleBtn:{ minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: SP.px10, borderRadius: BR.sm, backgroundColor: P.blue },
  addScheduleTxt:{ color: P.white, fontSize: 11, fontWeight: '800' },
  loadErrorBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: SP.px10, marginBottom: SP.px12, borderRadius: BR.sm, backgroundColor: P.dangerSubtle, borderWidth: 1, borderColor: P.dangerBorder },
  loadErrorText: { flex: 1, color: P.danger, fontSize: 11 },
  retryText: { color: P.info, fontSize: 12, fontWeight: '800', padding: 4 },
  screenIntro:   { color: P.t3, fontSize: 13, lineHeight: 18, marginTop: SP.px4, marginBottom: SP.px16 },

  guardDropdown: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: SP.px12, paddingHorizontal: SP.px12, marginBottom: SP.px16, borderRadius: BR.md, backgroundColor: P.bg1, borderWidth: 1, borderColor: P.b2 },
  guardDropdownIcon:{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: BR.sm, backgroundColor: P.blueSubtle },
  guardDropdownName:{ color: P.t1, fontSize: 14, fontWeight: '700' },
  guardDropdownMeta:{ color: P.t3, fontSize: 11, marginTop: 2 },
  guardPickerCard:{ backgroundColor: P.bg1, borderTopLeftRadius: BR.xl, borderTopRightRadius: BR.xl, padding: SP.px24, borderWidth: 1, borderColor: P.b2 },
  guardOption:    { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: SP.px12, borderBottomWidth: 1, borderBottomColor: P.b1 },

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
  modalCard:     { position: 'relative', maxHeight: '92%', flexShrink: 1, backgroundColor: P.bg2, borderTopLeftRadius: BR.xl, borderTopRightRadius: BR.xl, padding: SP.px24, borderWidth: 1, borderColor: P.b2, ...SH_TOKENS.lg },
  timeEditorOverlay: { position: 'absolute', zIndex: 20, elevation: 20, top: 0, left: 0, right: 0, bottom: 0, padding: SP.px24, paddingBottom: SP.px16, backgroundColor: P.bg2, borderTopLeftRadius: BR.xl, borderTopRightRadius: BR.xl },
  timeInputRow: { flexDirection: 'row', alignItems: 'center', gap: SP.px8 },
  timeInput: { flex: 0.8, color: P.t1, fontSize: 16, fontWeight: '800', fontFamily: undefined },
  modalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SP.px16 },
  modalTitle:    { ...FONT.h3 },
  modalSub:      { color: P.t3, fontSize: 12, marginTop: 3 },
  closeBtn:      { width: 30, height: 30, backgroundColor: P.bg3, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: P.b2 },
  closeBtnTxt:   { color: P.t2, fontSize: 16 },

  templateRow:   { flexDirection: 'row', gap: SP.px8, marginBottom: SP.px16 },
  templateBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: P.bg3, borderRadius: BR.sm, paddingHorizontal: SP.px12, paddingVertical: 9, justifyContent: 'center', borderWidth: 1, borderColor: P.b2 },
  templateBtnTxt:{ color: P.t2, fontSize: 12, fontWeight: '600' },
  daySelector:  { flexDirection: 'row', gap: SP.px4, marginTop: SP.px8, marginBottom: SP.px8 },
  daySelectorPill:{ flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: BR.full, backgroundColor: P.bg3, borderWidth: 1, borderColor: P.b2 },
  daySelectorPillActive:{ backgroundColor: P.blueSubtle, borderColor: P.blueBorder },
  daySelectorText:{ color: P.t3, fontSize: 9, fontWeight: '800' },
  daySelectorTextActive:{ color: P.blueDark },

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
  timePickerButton:{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: SP.px12, paddingHorizontal: SP.px12, borderRadius: BR.sm, backgroundColor: P.bg3, borderWidth: 1, borderColor: P.b2 },
  timePickerValue:{ flex: 1, color: P.t1, fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  timePickerHint:{ color: P.blue, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  timeWheel:     { marginTop: SP.px8, padding: SP.px8, borderRadius: BR.sm, backgroundColor: P.bg3 },
  timeWheelLabel:{ color: P.t3, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginTop: SP.px4, marginBottom: SP.px4 },
  timeWheelRow:  { flexDirection: 'row', alignItems: 'center', gap: SP.px4 },
  timeWheelItem: { minWidth: 36, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: BR.xs, backgroundColor: P.bg1, borderWidth: 1, borderColor: P.b1 },
  minuteWheelItem:{ flex: 1, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: BR.xs, backgroundColor: P.bg1, borderWidth: 1, borderColor: P.b1 },
  timeWheelItemSelected:{ backgroundColor: P.blue, borderColor: P.blue },
  timeWheelText:{ color: P.t2, fontSize: 11, fontWeight: '700' },
  timeWheelTextSelected:{ color: P.white },

  templateItem:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: P.b1, gap: 10 },
  templateItemName:  { color: P.t1, fontSize: 14, fontWeight: '700' },
  templateItemDays:  { color: P.t3, fontSize: 12, marginTop: 2 },
});
