import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Switch, Share, Alert,
} from 'react-native';
import { useApp, formatTime, formatDate } from '../../context/AppContext';
import { FileText, Download, Filter, X, ChevronDown } from 'lucide-react-native';
import { AppHeader } from '../components/AppHeader';
import { EmptyState } from '../components/EmptyState';
import { P, SP, BR, FONT, SH_TOKENS, card, input as inputStyle, btnPrimary } from '../../ds';
import { API_ENABLED, apiGet } from '../../services/api';

const REPORT_TYPES = ['combined', 'check_calls', 'patrols'];
const DATE_RANGES  = ['today', 'this_week', 'this_month', 'custom'];

function getDateRangeLabel(r) {
  const map = { today: 'Today', this_week: 'This Week', this_month: 'This Month', custom: 'Custom' };
  return map[r] || r;
}

function isInRange(dateStr, range, customStart, customEnd) {
  const d = new Date(dateStr);
  const today = new Date();
  if (range === 'today') {
    return d.toDateString() === today.toDateString();
  }
  if (range === 'this_week') {
    const mon = new Date(today);
    const day = mon.getDay() || 7;
    mon.setDate(mon.getDate() - (day - 1));
    mon.setHours(0,0,0,0);
    return d >= mon && d <= today;
  }
  if (range === 'this_month') {
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  }
  if (range === 'custom' && customStart && customEnd) {
    const s = new Date(customStart); s.setHours(0,0,0,0);
    const e = new Date(customEnd);   e.setHours(23,59,59,999);
    return d >= s && d <= e;
  }
  return true;
}

export function ManagerReportsScreen() {
  const { currentUser, users, sites, shiftSessions, checkCalls, patrolSessions, patrolCaptures, checkpoints } = useApp();

  const managerSiteIds = (currentUser?.siteIds || [currentUser?.siteId]).filter(Boolean).map(String);
  const canSeeSite = siteId => currentUser?.role === 'admin' || currentUser?.role === 'superadmin' || managerSiteIds.includes(String(siteId || ''));

  const guards = (users || []).filter(u => u.role === 'guard' && (canSeeSite(u.siteId) || !u.siteId));

  // Filters
  const [dateRange, setDateRange]         = useState('today');
  const [customStart, setCustomStart]     = useState('');
  const [customEnd, setCustomEnd]         = useState('');
  const [guardFilter, setGuardFilter]     = useState('all');
  const [siteFilter, setSiteFilter]       = useState('all');
  const [reportType, setReportType]       = useState('combined');
  const [includePhotos, setIncludePhotos] = useState(false);

  // Column toggles
  const [cols, setCols] = useState({
    guardName: true, site: true, shiftTime: true,
    checkCallTime: true, checkCallResult: true,
    patrolTime: true, patrolCheckpoints: true, notes: true,
  });

  const [filterModal, setFilterModal]     = useState(false);
  const [colModal, setColModal]           = useState(false);
  const [guardPickerModal, setGuardPickerModal] = useState(false);
  const [sitePickerModal, setSitePickerModal]   = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  // Build report rows
  const rows = useMemo(() => {
    const result = [];

    if (reportType === 'combined' || reportType === 'check_calls') {
      (checkCalls || [])
        .filter(cc => {
          const guard = (users || []).find(u => u.id === cc.guardId || u._id === cc.guardId);
          if (!guard && !cc.guardName) return false;
          if (!canSeeSite(cc.siteId)) return false;
          if (guardFilter !== 'all' && cc.guardId !== guardFilter) return false;
          if (siteFilter !== 'all' && cc.siteId !== siteFilter) return false;
          return isInRange(cc.firedAt || cc.respondedAt || cc.scheduledFor, dateRange, customStart, customEnd);
        })
        .forEach(cc => {
          const guard = (users || []).find(u => u.id === cc.guardId || u._id === cc.guardId);
          const site  = (sites || []).find(s => s.id === cc.siteId || s._id === cc.siteId);
          const session = (shiftSessions || []).find(s => s.id === cc.sessionId);
          const timeVal = cc.firedAt || cc.respondedAt || cc.scheduledFor || new Date().toISOString();
          result.push({
            type: 'check_call',
            id: cc.id || cc._id,
            guardName: guard?.name || cc.guardName || 'Officer',
            badgeNumber: guard?.badgeNumber || cc.badgeNumber || '—',
            site: site?.name || cc.siteName || '—',
            shiftTime: session ? `${formatTime(session.bookedOnAt)}${session.bookedOffAt ? ' – ' + formatTime(session.bookedOffAt) : ''}` : '—',
            checkCallTime: formatTime(timeVal),
            checkCallResult: cc.response === 'yes' ? '✓ Yes (Safe)' : cc.response === 'missed' ? '✗ Missed SLA' : cc.response === 'no' ? '⚠ Issue Reported' : '— Pending',
            note: cc.note || (cc.category ? `Category: ${cc.category}` : ''),
            date: formatDate(timeVal),
            manuallyLogged: !!cc.manuallyLogged || !!cc.isManualLog,
            loggedBy: cc.loggedBy || (cc.isManualLog ? 'Officer Direct' : undefined),
          });
        });
    }

    if (reportType === 'combined' || reportType === 'patrols') {
      (patrolSessions || [])
        .filter(ps => {
          if (!canSeeSite(ps.siteId)) return false;
          if (guardFilter !== 'all' && ps.guardId !== guardFilter) return false;
          if (siteFilter !== 'all' && ps.siteId !== siteFilter) return false;
          return isInRange(ps.startedAt, dateRange, customStart, customEnd);
        })
        .forEach(ps => {
          const guard = (users || []).find(u => u.id === ps.guardId || u._id === ps.guardId);
          const site  = (sites || []).find(s => s.id === ps.siteId || s._id === ps.siteId);
          const session = (shiftSessions || []).find(s => s.id === ps.sessionId);
          const captures = (patrolCaptures || []).filter(c => c.patrolId === ps.id || c.patrolId === ps._id);
          const siteCP = (checkpoints || []).filter(cp => cp.siteId === ps.siteId);
          result.push({
            type: 'patrol',
            id: ps.id || ps._id,
            guardName: guard?.name || 'Officer',
            badgeNumber: guard?.badgeNumber || '—',
            site: site?.name || '—',
            shiftTime: session ? `${formatTime(session.bookedOnAt)}${session.bookedOffAt ? ' – '+formatTime(session.bookedOffAt) : ''}` : '—',
            patrolTime: `${formatTime(ps.startedAt)}${ps.finishedAt ? ' – '+formatTime(ps.finishedAt) : ' (ongoing)'}`,
            patrolStatus: ps.status || 'in_progress',
            checkpointsCapt: `${captures.length}/${siteCP.length || 0}`,
            missingCheckpoints: (ps.missingCheckpoints || []).map(id => (checkpoints || []).find(cp => cp.id === id)?.name || id).join(', '),
            photos: captures,
            date: formatDate(ps.startedAt),
            manuallyLogged: !!ps.manuallyLogged,
            loggedBy: ps.loggedBy,
          });
        });
    }

    return result.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [reportType, guardFilter, siteFilter, dateRange, customStart, customEnd,
      checkCalls, patrolSessions, patrolCaptures, users, sites, shiftSessions, checkpoints, currentUser]);

  const generateCSV = async () => {
    if (exportBusy) return;
    setExportBusy(true);
    try {
      if (!rows || rows.length === 0) {
        Alert.alert('No Records', 'No security check-calls or patrols match the selected filters.');
        return;
      }
      const headers = ['Date', 'Site Name', 'Security Officer', 'Badge ID', 'Shift Time', 'Record Type', 'Event Time / Result', 'Incident Log / Notes'];
      const lines = [headers.join(',')];

      rows.forEach(r => {
        const escape = val => `"${String(val ?? '').replace(/"/g, '""')}"`;
        const eventDetail = r.type === 'check_call' ? `${r.checkCallTime} · ${r.checkCallResult}` : `${r.patrolTime} (Checkpoints: ${r.checkpointsCapt})`;
        const line = [
          escape(r.date),
          escape(r.site),
          escape(r.guardName),
          escape(r.badgeNumber),
          escape(r.shiftTime),
          escape(r.type === 'check_call' ? 'Check Call' : 'Patrol Tour'),
          escape(eventDetail),
          escape(r.note || (r.missingCheckpoints ? `Missing: ${r.missingCheckpoints}` : '')),
        ].join(',');
        lines.push(line);
      });

      const csvContent = lines.join('\n');

      // Web direct file download
      if (typeof window !== 'undefined' && window.document && window.Blob) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `observant_shift_report_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        Alert.alert('Report Exported', 'CSV report downloaded successfully.');
        return;
      }

      // Native mobile share
      await Share.share({
        title: 'Observant Shift Security Report',
        message: csvContent,
      });
    } catch (error) {
      Alert.alert('Report export failed', error.message || 'Could not generate this report.');
    } finally {
      setExportBusy(false);
    }
  };

  const guardName = guardFilter !== 'all' ? users.find(u => u.id === guardFilter)?.name : 'All Guards';
  const siteName  = siteFilter !== 'all' ? sites.find(s => s.id === siteFilter)?.name : 'All Sites';

  return (
    <View style={styles.root}>
      <AppHeader />
      <View style={styles.topRow}>
        <Text style={styles.screenTitle}>Reports</Text>
        <View style={styles.topBtns}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setColModal(true)}>
            <FileText color={P.t2} size={20} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setFilterModal(true)}>
            <Filter color={P.t2} size={20} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.exportBtn, exportBusy && { opacity: 0.65 }]} onPress={generateCSV} disabled={exportBusy}>
            <Download color={P.white} size={15} />
            <Text style={styles.exportBtnTxt}>{exportBusy ? 'Generating…' : 'Export CSV'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Active filters summary */}
      <View style={styles.filterSummary}>
        <Text style={styles.filterTag}>{getDateRangeLabel(dateRange)}</Text>
        <Text style={styles.filterTag}>{guardName}</Text>
        <Text style={styles.filterTag}>{siteName}</Text>
        <Text style={styles.filterTag}>{reportType.replace('_',' ')}</Text>
      </View>

      <Text style={styles.rowCount}>{rows.length} record{rows.length !== 1 ? 's' : ''}</Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        {rows.length === 0 && (
          <View style={{ marginTop: SP.px24 }}>
            <EmptyState
              variant="radar"
              title="No records found"
              message="Try adjusting your date range, guard, or site filters."
            />
          </View>
        )}

        {rows.map(row => (
          <View key={row.id} style={[styles.row, row.type === 'patrol' && styles.rowPatrol]}>
            <View style={styles.rowHeader}>
              <View style={[styles.typeBadge, row.type === 'check_call' ? styles.typeBadgeCC : styles.typeBadgeP]}>
                <Text style={styles.typeBadgeTxt}>{row.type === 'check_call' ? 'CHECK CALL' : 'PATROL'}</Text>
              </View>
              <Text style={styles.rowDate}>{row.date}</Text>
            </View>

            {row.manuallyLogged && (
              <View style={styles.manualLogBadge}>
                <Text style={styles.manualLogBadgeTxt}>📝 Manually logged by Manager</Text>
              </View>
            )}

            {cols.guardName && <Text style={styles.rowGuard}>{row.guardName} <Text style={styles.rowBadge}>· {row.badgeNumber}</Text></Text>}
            {cols.site && <Text style={styles.rowSite}>{row.site}</Text>}
            {cols.shiftTime && row.shiftTime !== '—' && (
              <Text style={styles.rowDetail}>Shift: {row.shiftTime}</Text>
            )}

            {row.type === 'check_call' && (
              <>
                {cols.checkCallTime && <Text style={styles.rowDetail}>Time: {row.checkCallTime}</Text>}
                {cols.checkCallResult && (
                  <Text style={[styles.rowResult, {
                    color: row.checkCallResult.startsWith('✓') ? P.ok :
                           row.checkCallResult.startsWith('✗') ? P.danger : P.warn
                  }]}>
                    {row.checkCallResult}
                  </Text>
                )}
                {cols.notes && row.note ? <Text style={styles.rowNote}>Note: {row.note}</Text> : null}
              </>
            )}

            {row.type === 'patrol' && (
              <>
                {cols.patrolTime && <Text style={styles.rowDetail}>Patrol: {row.patrolTime}</Text>}
                {cols.patrolCheckpoints && (
                  <Text style={styles.rowDetail}>
                    Checkpoints: {row.checkpointsCapt}
                    {row.missingCheckpoints ? ` (missing: ${row.missingCheckpoints})` : ''}
                  </Text>
                )}
              </>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Filter Modal */}
      <Modal visible={filterModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Filters</Text>
              <TouchableOpacity onPress={() => setFilterModal(false)}><X color={P.t2} size={20} /></TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Date Range</Text>
            <View style={styles.pillRow}>
              {DATE_RANGES.map(r => (
                <TouchableOpacity key={r} style={[styles.pill, dateRange === r && styles.pillActive]} onPress={() => setDateRange(r)}>
                  <Text style={[styles.pillTxt, dateRange === r && styles.pillTxtActive]}>{getDateRangeLabel(r)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {dateRange === 'custom' && (
              <>
                <Text style={styles.fieldLabel}>Start Date (YYYY-MM-DD)</Text>
                <TextInput style={styles.input} value={customStart} onChangeText={setCustomStart} placeholder="2026-01-01" placeholderTextColor="#475569" />
                <Text style={styles.fieldLabel}>End Date (YYYY-MM-DD)</Text>
                <TextInput style={styles.input} value={customEnd} onChangeText={setCustomEnd} placeholder="2026-01-31" placeholderTextColor="#475569" />
              </>
            )}

            <Text style={styles.fieldLabel}>Report Type</Text>
            <View style={styles.pillRow}>
              {REPORT_TYPES.map(r => (
                <TouchableOpacity key={r} style={[styles.pill, reportType === r && styles.pillActive]} onPress={() => setReportType(r)}>
                  <Text style={[styles.pillTxt, reportType === r && styles.pillTxtActive]}>{r.replace('_',' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Guard</Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => { setFilterModal(false); setGuardPickerModal(true); }}>
              <Text style={styles.pickerBtnTxt}>{guardName}</Text>
              <ChevronDown color="#64748b" size={16} />
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>Site</Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => { setFilterModal(false); setSitePickerModal(true); }}>
              <Text style={styles.pickerBtnTxt}>{siteName}</Text>
              <ChevronDown color="#64748b" size={16} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.applyBtn} onPress={() => setFilterModal(false)}>
              <Text style={styles.applyBtnTxt}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Guard Picker */}
      <Modal visible={guardPickerModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Guard</Text>
            <TouchableOpacity style={styles.pickerItem} onPress={() => { setGuardFilter('all'); setGuardPickerModal(false); }}>
              <Text style={styles.pickerItemTxt}>All Guards</Text>
            </TouchableOpacity>
            {guards.map(g => (
              <TouchableOpacity key={g.id} style={styles.pickerItem} onPress={() => { setGuardFilter(g.id); setGuardPickerModal(false); }}>
                <Text style={styles.pickerItemTxt}>{g.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setGuardPickerModal(false)}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Site Picker */}
      <Modal visible={sitePickerModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Site</Text>
            <TouchableOpacity style={styles.pickerItem} onPress={() => { setSiteFilter('all'); setSitePickerModal(false); }}>
              <Text style={styles.pickerItemTxt}>All Sites</Text>
            </TouchableOpacity>
            {sites.filter(s => currentUser.siteIds?.includes(s.id)).map(s => (
              <TouchableOpacity key={s.id} style={styles.pickerItem} onPress={() => { setSiteFilter(s.id); setSitePickerModal(false); }}>
                <Text style={styles.pickerItemTxt}>{s.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setSitePickerModal(false)}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Column Toggle Modal */}
      <Modal visible={colModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Columns</Text>
              <TouchableOpacity onPress={() => setColModal(false)}><X color={P.t2} size={20} /></TouchableOpacity>
            </View>
            {Object.entries(cols).map(([key, val]) => (
              <View key={key} style={styles.colRow}>
                <Text style={styles.colLabel}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</Text>
                <Switch
                  value={val}
                  onValueChange={v => setCols(prev => ({ ...prev, [key]: v }))}
                  trackColor={{ true: P.ok, false: P.b3 }}
                  thumbColor={P.white}
                />
              </View>
            ))}
            <TouchableOpacity style={styles.applyBtn} onPress={() => setColModal(false)}>
              <Text style={styles.applyBtnTxt}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: P.bg0 },
  topRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SP.px12, paddingHorizontal: SP.px20, paddingTop: SP.px8 },
  screenTitle:  { ...FONT.h2 },
  topBtns:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn:      { padding: 8, backgroundColor: P.bg2, borderRadius: BR.sm, borderWidth: 1, borderColor: P.b2 },
  exportBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: P.blue, borderRadius: BR.sm, paddingHorizontal: SP.px12, paddingVertical: 9, ...SH_TOKENS.blue },
  exportBtnTxt: { color: P.white, fontSize: 12, fontWeight: '700' },
  filterSummary:{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SP.px8, paddingHorizontal: SP.px20 },
  filterTag:    { backgroundColor: P.bg3, borderRadius: BR.xs, paddingHorizontal: SP.px8, paddingVertical: 4, borderWidth: 1, borderColor: P.b2 },
  rowCount:     { color: P.t3, fontSize: 12, marginBottom: SP.px12, paddingHorizontal: SP.px20 },
  row:          { ...card, padding: SP.px16, marginBottom: SP.px8, marginHorizontal: SP.px20 },
  rowPatrol:    { borderColor: P.blueBorder },
  rowHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SP.px8 },
  typeBadge:    { borderRadius: BR.xs, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeCC:  { backgroundColor: P.infoSubtle, borderWidth: 1, borderColor: P.infoBorder },
  typeBadgeP:   { backgroundColor: P.okSubtle, borderWidth: 1, borderColor: P.okBorder },
  typeBadgeTxt: { color: P.t2, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  rowDate:      { color: P.t3, fontSize: 11 },
  rowGuard:     { color: P.t1, fontSize: 14, fontWeight: '700' },
  rowBadge:     { color: P.t3, fontWeight: '400' },
  rowSite:      { color: P.t3, fontSize: 12, marginTop: 2, marginBottom: 4 },
  rowDetail:    { color: P.t2, fontSize: 12, marginTop: 3 },
  rowResult:    { fontSize: 13, fontWeight: '700', marginTop: 4 },
  rowNote:      { color: P.t3, fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  manualLogBadge: { backgroundColor: P.infoSubtle, borderWidth: 1, borderColor: P.infoBorder, borderRadius: BR.xs, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginVertical: 4 },
  manualLogBadgeTxt: { color: P.info, fontSize: 11, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: P.overlay, justifyContent: 'flex-end' },
  modalCard:    { backgroundColor: P.bg2, borderTopLeftRadius: BR.xl, borderTopRightRadius: BR.xl, padding: SP.px24, borderWidth: 1, borderColor: P.b2, maxHeight: '90%', ...SH_TOKENS.lg },
  modalHead:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SP.px16 },
  modalTitle:   { ...FONT.h3, marginBottom: SP.px16 },
  fieldLabel:   { color: P.t3, fontSize: 11, fontWeight: '700', marginBottom: SP.px8, marginTop: SP.px12, textTransform: 'uppercase', letterSpacing: 0.6 },
  pillRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  pill:         { backgroundColor: P.bg3, borderRadius: BR.full, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: P.b2 },
  pillActive:   { backgroundColor: P.blueSubtle, borderColor: P.blueBorder },
  pillTxt:      { color: P.t3, fontSize: 13 },
  pillTxtActive:{ color: P.info, fontWeight: '700' },
  pickerBtn:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: P.bg3, borderRadius: BR.sm, padding: SP.px12, borderWidth: 1, borderColor: P.b2 },
  pickerBtnTxt: { color: P.t1, fontSize: 14 },
  applyBtn:     { ...btnPrimary, marginTop: SP.px20 },
  applyBtnTxt:  { color: P.white, fontSize: 15, fontWeight: '800' },
  pickerItem:   { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: P.b1 },
  pickerItemTxt:{ color: P.t1, fontSize: 15 },
  cancelBtn:    { backgroundColor: P.bg3, borderRadius: BR.md, paddingVertical: 13, alignItems: 'center', marginTop: SP.px12, borderWidth: 1, borderColor: P.b2 },
  cancelTxt:    { color: P.t2, fontSize: 14 },
  colRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: P.b1 },
  colLabel:     { color: P.t1, fontSize: 14 },
});
