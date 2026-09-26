import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Switch, Alert, Share, Platform
} from 'react-native';
import { useApp, formatTime, formatDate } from '../../context/AppContext';
import { FileText, Download, Filter, X, ChevronDown } from 'lucide-react-native';
import { AppHeader } from '../components/AppHeader';
import { T } from '../../theme';

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

  const guards = users.filter(u => u.role === 'guard' && currentUser.siteIds?.includes(u.siteId));

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

  // Build report rows
  const rows = useMemo(() => {
    const result = [];

    if (reportType === 'combined' || reportType === 'check_calls') {
      checkCalls
        .filter(cc => {
          const guard = users.find(u => u.id === cc.guardId);
          if (!guard) return false;
          if (!currentUser.siteIds?.includes(cc.siteId)) return false;
          if (guardFilter !== 'all' && cc.guardId !== guardFilter) return false;
          if (siteFilter !== 'all' && cc.siteId !== siteFilter) return false;
          return isInRange(cc.firedAt, dateRange, customStart, customEnd);
        })
        .forEach(cc => {
          const guard = users.find(u => u.id === cc.guardId);
          const site  = sites.find(s => s.id === cc.siteId);
          const session = shiftSessions.find(s => s.id === cc.sessionId);
          result.push({
            type: 'check_call',
            id: cc.id,
            guardName: guard?.name || '—',
            badgeNumber: guard?.badgeNumber || '—',
            site: site?.name || '—',
            shiftTime: session ? `${formatTime(session.bookedOnAt)}${session.bookedOffAt ? ' – ' + formatTime(session.bookedOffAt) : ''}` : '—',
            checkCallTime: formatTime(cc.firedAt),
            checkCallResult: cc.response === 'yes' ? '✓ Yes' : cc.response === 'missed' ? '✗ Missed' : cc.response === 'no' ? '⚠ Issue' : '—',
            note: cc.note || '',
            date: formatDate(cc.firedAt),
            manuallyLogged: !!cc.manuallyLogged,
            loggedBy: cc.loggedBy,
          });
        });
    }

    if (reportType === 'combined' || reportType === 'patrols') {
      patrolSessions
        .filter(ps => {
          if (!currentUser.siteIds?.includes(ps.siteId)) return false;
          if (guardFilter !== 'all' && ps.guardId !== guardFilter) return false;
          if (siteFilter !== 'all' && ps.siteId !== siteFilter) return false;
          return isInRange(ps.startedAt, dateRange, customStart, customEnd);
        })
        .forEach(ps => {
          const guard = users.find(u => u.id === ps.guardId);
          const site  = sites.find(s => s.id === ps.siteId);
          const session = shiftSessions.find(s => s.id === ps.sessionId);
          const captures = patrolCaptures.filter(c => c.patrolId === ps.id);
          const siteCP = checkpoints.filter(cp => cp.siteId === ps.siteId);
          result.push({
            type: 'patrol',
            id: ps.id,
            guardName: guard?.name || '—',
            badgeNumber: guard?.badgeNumber || '—',
            site: site?.name || '—',
            shiftTime: session ? `${formatTime(session.bookedOnAt)}${session.bookedOffAt ? ' – '+formatTime(session.bookedOffAt) : ''}` : '—',
            patrolTime: `${formatTime(ps.startedAt)}${ps.finishedAt ? ' – '+formatTime(ps.finishedAt) : ' (ongoing)'}`,
            patrolStatus: ps.status || 'in_progress',
            checkpointsCapt: `${captures.length}/${siteCP.length}`,
            missingCheckpoints: (ps.missingCheckpoints || []).map(id => checkpoints.find(cp => cp.id === id)?.name || id).join(', '),
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

  const generateCSV = () => {
    const headers = ['Date','Type','Guard','Badge','Site','Shift','Check Call Time','Check Call Result','Patrol Time','Checkpoints','Note'];
    const lines = [headers.join(',')];
    rows.forEach(r => {
      lines.push([
        r.date, r.type === 'check_call' ? 'Check Call' : 'Patrol',
        r.guardName, r.badgeNumber, r.site, r.shiftTime || '',
        r.checkCallTime || '', r.checkCallResult || '',
        r.patrolTime || '', r.checkpointsCapt || '',
        `"${(r.note || r.missingCheckpoints || '').replace(/"/g,'""')}"`,
      ].join(','));
    });
    const csv = lines.join('\n');
    Share.share({
      title: 'Observant Shift Report',
      message: csv,
    });
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
            <FileText color="#94a3b8" size={20} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setFilterModal(true)}>
            <Filter color="#94a3b8" size={20} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportBtn} onPress={generateCSV}>
            <Download color="#fff" size={16} />
            <Text style={styles.exportBtnTxt}>Export CSV</Text>
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
          <View style={styles.emptyState}>
            <FileText color="#334155" size={40} />
            <Text style={styles.emptyTxt}>No records for selected filters</Text>
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
                    color: row.checkCallResult.startsWith('✓') ? '#10b981' :
                           row.checkCallResult.startsWith('✗') ? '#ef4444' : '#f59e0b'
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
              <TouchableOpacity onPress={() => setFilterModal(false)}><X color="#64748b" size={20} /></TouchableOpacity>
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
              <TouchableOpacity onPress={() => setColModal(false)}><X color="#64748b" size={20} /></TouchableOpacity>
            </View>
            {Object.entries(cols).map(([key, val]) => (
              <View key={key} style={styles.colRow}>
                <Text style={styles.colLabel}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</Text>
                <Switch
                  value={val}
                  onValueChange={v => setCols(prev => ({ ...prev, [key]: v }))}
                  trackColor={{ true: '#10b981', false: '#334155' }}
                  thumbColor="#fff"
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
  root:         { flex: 1, backgroundColor: T.bgRoot },
  content:      { flex: 1, padding: 20 },
  topRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 20 },
  screenTitle:  { color: T.textPrimary, fontSize: 22, fontWeight: '800' },
  topBtns:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn:      { padding: 8 },
  exportBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#10b981', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  exportBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  filterSummary:{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8, paddingHorizontal: 20 },
  filterTag:    { backgroundColor: T.bgInput, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  rowCount:     { color: '#64748b', fontSize: 12, marginBottom: 12 },
  row:          { backgroundColor: '#0f172a', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#1e293b' },
  rowPatrol:    { borderColor: '#1e3a5f' },
  rowHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  typeBadge:    { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeCC:  { backgroundColor: 'rgba(59,130,246,0.2)' },
  typeBadgeP:   { backgroundColor: 'rgba(16,185,129,0.15)' },
  typeBadgeTxt: { color: '#94a3b8', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  rowDate:      { color: '#475569', fontSize: 11 },
  rowGuard:     { color: '#fff', fontSize: 14, fontWeight: '700' },
  rowBadge:     { color: '#64748b', fontWeight: '400' },
  rowSite:      { color: '#64748b', fontSize: 12, marginTop: 2, marginBottom: 4 },
  rowDetail:    { color: '#94a3b8', fontSize: 12, marginTop: 3 },
  rowResult:    { fontSize: 13, fontWeight: '700', marginTop: 4 },
  rowNote:      { color: '#64748b', fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  manualLogBadge: { backgroundColor: 'rgba(56,189,248,0.12)', borderWidth: 1, borderColor: '#38bdf8', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginVertical: 4 },
  manualLogBadgeTxt: { color: '#38bdf8', fontSize: 11, fontWeight: '700' },
  emptyState:   { alignItems: 'center', marginTop: 60, gap: 14 },
  emptyTxt:     { color: '#475569', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard:    { backgroundColor: '#0f172a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, borderWidth: 1, borderColor: '#1e293b', maxHeight: '90%' },
  modalHead:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle:   { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 16 },
  fieldLabel:   { color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 12, textTransform: 'uppercase' },
  pillRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  pill:         { backgroundColor: '#1e293b', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  pillActive:   { backgroundColor: '#10b981' },
  pillTxt:      { color: '#64748b', fontSize: 13 },
  pillTxtActive:{ color: '#fff', fontWeight: '700' },
  input:        { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', borderRadius: 10, padding: 12, color: '#fff', fontSize: 14, marginBottom: 4 },
  pickerBtn:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 10, padding: 12 },
  pickerBtnTxt: { color: '#fff', fontSize: 14 },
  applyBtn:     { backgroundColor: '#10b981', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  applyBtnTxt:  { color: '#fff', fontSize: 15, fontWeight: '800' },
  pickerItem:   { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  pickerItemTxt:{ color: '#fff', fontSize: 15 },
  cancelBtn:    { backgroundColor: '#1e293b', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  cancelTxt:    { color: '#94a3b8', fontSize: 14 },
  colRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  colLabel:     { color: '#fff', fontSize: 14 },
});
