import React, { useEffect, useMemo, useState } from 'react';
import logo from '../../assets/logo.png';

const API = (import.meta.env.VITE_API_URL || 'https://observant-api-zl49.onrender.com').replace(/\/$/, '');
const pad = value => String(value).padStart(2, '0');
const isoDay = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const dateLabel = value => {
  if (!value) return '—';
  const date = new Date(value);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
};
const idOf = value => String(value?._id || value?.id || value || '');

const getDateRange = preset => {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);
  if (preset === 'weekly') {
    const day = end.getDay() || 7;
    start.setDate(end.getDate() - (day - 1));
    end.setDate(start.getDate() + 6);
  }
  if (preset === 'monthly') start.setDate(1);
  if (preset === 'yearly') start.setMonth(0, 1);
  return { from: isoDay(start), to: isoDay(end) };
};

async function request(path, token, signal) {
  const response = await fetch(`${API}${path}`, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, signal });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload;
}

const DAY_HOURS   = ['0700','0800','0900','1000','1100','1200','1300','1400','1500','1600','1700','1800','1900'];
const NIGHT_HOURS = ['1900','2000','2100','2200','2300','0000','0100','0200','0300','0400','0500','0600','0700'];

export default function CheckCallLogPage({ session }) {
  const role = String(session?.user?.role || '').toLowerCase();
  const allowed = role === 'manager' || role === 'admin';
  const [preset, setPreset] = useState('weekly');
  const [draftRange, setDraftRange] = useState(() => getDateRange('weekly'));
  const [filters, setFilters] = useState({ range: getDateRange('weekly'), site: '', guard: '', shift: 'all' });
  const [sites, setSites] = useState([]);
  const [guards, setGuards] = useState([]);
  const [matrix, setMatrix] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // CRUD state
  const [editingShift, setEditingShift] = useState(null);
  const [deletingShift, setDeletingShift] = useState(null);
  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [newShift, setNewShift] = useState({
    guardId: '',
    siteId: '',
    shiftDate: new Date().toISOString().slice(0, 10),
    shiftType: 'Night',
    startTime: '19:00',
    endTime: '07:00',
  });
  const [crudBusy, setCrudBusy] = useState(false);
  const [crudError, setCrudError] = useState('');

  const generate = async (next = filters) => {
    if (next.range.from > next.range.to) { setError('Start date must be on or before finish date.'); return; }
    setLoading(true); setError('');
    try {
      const reportParams = new URLSearchParams({ startDate: next.range.from, endDate: next.range.to });
      if (next.site) reportParams.set('siteId', next.site);
      if (next.guard) reportParams.set('officerId', next.guard);
      if (next.shift !== 'all') reportParams.set('shiftType', next.shift);
      const report = await request(`/api/reports/check-call-log?${reportParams}`, session.accessToken);
      setMatrix(report.rows || []);
      setFilters(next);
    } catch (reason) { setMatrix([]); setError(reason.message || 'Could not load check call records.'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!allowed || !session?.accessToken) return undefined;
    const controller = new AbortController();
    Promise.all([
      request('/api/sites', session.accessToken, controller.signal),
      request('/api/users?role=guard', session.accessToken, controller.signal),
    ]).then(([siteData, guardData]) => {
      const siteList = siteData.sites || [];
      const guardList = guardData.users || [];

      const isManager = session?.user?.role === 'manager';
      const managerSiteIds = isManager ? [
        ...(session.user?.managedSiteIds || []),
        session.user?.siteId,
      ].filter(Boolean).map(String) : null;

      let filteredSites = siteList;
      let filteredGuards = guardList;
      if (isManager && managerSiteIds?.length) {
        filteredSites = siteList.filter(s => managerSiteIds.includes(String(s._id || s.id)));
        filteredGuards = guardList.filter(g => {
          const gSite = String(g.siteId?._id || g.siteId || '');
          const gAssigned = (g.assignedSiteIds || []).map(id => String(id?._id || id || ''));
          return managerSiteIds.includes(gSite) || gAssigned.some(id => managerSiteIds.includes(id));
        });
      }

      setSites(filteredSites);
      setGuards(filteredGuards);

      const totmonslowSite = filteredSites.find(s => (s.name || '').toLowerCase().includes('totmonslow'));
      const defaultSiteId = totmonslowSite ? (totmonslowSite._id || totmonslowSite.id) : (filteredSites[0]?._id || filteredSites[0]?.id || '');
      const initialFilters = { ...filters, site: defaultSiteId };
      generate(initialFilters);
    }).catch(reason => { if (reason.name !== 'AbortError') setError(reason.message); });
    return () => controller.abort();
  }, [allowed, session?.accessToken]);

  async function handleDeleteShift() {
    if (!deletingShift) return;
    setCrudBusy(true);
    setCrudError('');
    try {
      if (deletingShift.sessionId) {
        await request(`/api/shifts/${deletingShift.sessionId}`, session.accessToken, null, { method: 'DELETE' });
      }
      setMatrix(prev => prev.filter(r => r !== deletingShift && (!deletingShift.sessionId || r.sessionId !== deletingShift.sessionId)));
      setDeletingShift(null);
    } catch (err) {
      setCrudError(err.message || 'Failed to delete shift');
    } finally {
      setCrudBusy(false);
    }
  }

  async function handleCreateShift(e) {
    e.preventDefault();
    setCrudBusy(true);
    setCrudError('');
    try {
      const gId = newShift.guardId || guards[0]?._id || guards[0]?.id;
      const sId = newShift.siteId || sites[0]?._id || sites[0]?.id;
      if (!gId || !sId) throw new Error('Select an active guard and site.');
      const startIso = `${newShift.shiftDate}T${newShift.startTime}:00.000Z`;
      const isOvernight = newShift.endTime < newShift.startTime || newShift.shiftType === 'Night';
      const endDate = new Date(`${newShift.shiftDate}T00:00:00.000Z`);
      if (isOvernight) endDate.setUTCDate(endDate.getUTCDate() + 1);
      const endIso = `${endDate.toISOString().slice(0, 10)}T${newShift.endTime}:00.000Z`;

      await request('/api/shifts/admin-create', session.accessToken, null, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guardId: gId,
          siteId: sId,
          shiftType: newShift.shiftType,
          startedAt: startIso,
          scheduledStartAt: startIso,
          scheduledEndAt: endIso,
        }),
      });

      setShowAddShiftModal(false);
      generate();
    } catch (err) {
      setCrudError(err.message || 'Failed to create shift');
    } finally {
      setCrudBusy(false);
    }
  }

  function changePreset(value) {
    setPreset(value);
    if (value !== 'custom') {
      const nextRange = getDateRange(value);
      setDraftRange(nextRange);
      generate({ ...filters, range: nextRange });
    }
  }

  // Group matrix shifts by day
  const dayGroups = useMemo(() => {
    const sorted = [...matrix].sort((a, b) => {
      if (a.shiftDate !== b.shiftDate) return a.shiftDate.localeCompare(b.shiftDate);
      if (a.shiftType !== b.shiftType) return a.shiftType === 'Day' ? -1 : 1;
      const timeA = new Date(a.shiftStart || 0).getTime();
      const timeB = new Date(b.shiftStart || 0).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return (a.officerName || '').localeCompare(b.officerName || '');
    });

    const groups = [];
    let currentDayKey = null;
    let currentShifts = [];

    sorted.forEach(item => {
      if (item.shiftDate !== currentDayKey) {
        if (currentDayKey) groups.push({ dateKey: currentDayKey, shifts: currentShifts });
        currentDayKey = item.shiftDate;
        currentShifts = [];
      }
      currentShifts.push(item);
    });
    if (currentDayKey && currentShifts.length) {
      groups.push({ dateKey: currentDayKey, shifts: currentShifts });
    }
    return groups;
  }, [matrix]);

  if (!allowed) return <section className="unauthorized-card"><div className="empty-mark">!</div><h1>Manager access required</h1><p>This Check Call Log contains sensitive operational records. Sign in with a Manager or Admin account to continue.</p></section>;

  return <div className="checklog-page" style={{ maxWidth: 1250, margin: '0 auto', padding: '16px' }}>
    <section className="checklog-heading screen-only">
      <div><p className="eyebrow">OPERATIONS / REPORTING</p><h1>Check Call Log</h1><p>Build a shift-by-shift attendance log and print a landscape record.</p></div>
      <div className="checklog-actions">
        <button className="secondary-button" style={{ background: '#f59e0b', color: '#000', fontWeight: 'bold' }} onClick={() => setShowAddShiftModal(true)}>+ Add Shift Entry</button>
        <button className="secondary-button" onClick={() => generate({ ...filters, range: draftRange })} disabled={loading}>{loading ? 'Generating…' : 'Generate Report'}</button>
        <button className="primary-button" onClick={() => window.print()} disabled={!matrix.length}><span aria-hidden="true">⎙</span> Print / Export PDF</button>
      </div>
    </section>
    <section className="checklog-filters screen-only">
      <div className="preset-row">{[['weekly','Weekly'],['monthly','Monthly'],['yearly','Yearly'],['custom','Custom']].map(([value,label]) => <button key={value} className={`period-pill ${preset === value ? 'period-pill-active' : ''}`} onClick={() => changePreset(value)}>{label}</button>)}</div>
      <div className="checklog-filter-grid">
        <label className="field-label">Start date<input className="form-input mt-2" type="date" value={draftRange.from} onChange={event => {setPreset('custom');setDraftRange(value => ({...value,from:event.target.value}));}} /></label>
        <label className="field-label">Finish date<input className="form-input mt-2" type="date" value={draftRange.to} onChange={event => {setPreset('custom');setDraftRange(value => ({...value,to:event.target.value}));}} /></label>
        <label className="field-label">Site name<select className="form-input mt-2" value={filters.site} onChange={event => setFilters(value => ({...value,site:event.target.value}))}><option value="">All accessible sites</option>{sites.map(site => <option key={idOf(site)} value={idOf(site)}>{site.name}</option>)}</select></label>
        <label className="field-label">Security officer<select className="form-input mt-2" value={filters.guard} onChange={event => setFilters(value => ({...value,guard:event.target.value}))}><option value="">All officers</option>{guards.map(guard => <option key={idOf(guard)} value={idOf(guard)}>{guard.name}{guard.badgeNumber ? ` · ${guard.badgeNumber}` : ''}</option>)}</select></label>
        <label className="field-label">Shift type<select className="form-input mt-2" value={filters.shift} onChange={event => setFilters(value => ({...value,shift:event.target.value}))}><option value="all">Day &amp; Night</option><option value="Day">Day</option><option value="Night">Night</option></select></label>
      </div>
      {error && <p className="error-banner mt-4" role="alert">{error}</p>}
    </section>

    <section id="printable-report" className="checklog-sheet">
      {/* ── Logo ── */}
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <img src={logo} alt="Observant Security" style={{ width: 85, height: 85, objectFit: 'contain', display: 'inline-block' }} />
      </div>

      {/* ── Header Line: Start/Finish on Left, Title Centered ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8, padding: '0 4px' }}>
        <div style={{ fontSize: 13, fontWeight: 'bold', textDecoration: 'underline', minWidth: 260 }}>
          Start Date:{dateLabel(filters.range.from)} Finish Date:{dateLabel(filters.range.to)}
        </div>
        <div style={{ fontSize: 22, fontWeight: 'bold', textAlign: 'center', flex: 1, fontFamily: 'Arial, sans-serif' }}>
          Check Call Log
        </div>
        <div style={{ minWidth: 260 }}></div>
      </div>

      {/* ── Instructions Notice ── */}
      <div style={{ textAlign: 'center', fontSize: 11, color: '#111', lineHeight: 1.5, marginBottom: 14 }}>
        The precise time must be recorded. Late CALLS must be recorded in <span style={{ fontWeight: 'bold' }}>RED</span> ink and a brief explanation in the Logbook.<br/>
        Missed calls (Security Officer not responding to your call after 15 minutes) must be reported &amp; fully explained in the Incident Log Book
      </div>

      {/* ── Main Matrix Table matching reference sample exactly ── */}
      {loading ? (
        <div className="checklog-empty screen-only">Generating the report…</div>
      ) : matrix.length ? (
        <div className="checklog-table-container" style={{ width: '100%', overflowX: 'auto', marginTop: 12 }}>
          <table
            className="checklog-formal-table"
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
              border: '1.5px solid #000',
              background: '#fff',
              color: '#000',
              fontFamily: 'Arial, Helvetica, sans-serif'
            }}
          >
            <colgroup>
              <col style={{ width: '10%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '8%' }} />
              {DAY_HOURS.map(h => (
                <col key={h} style={{ width: '5.23%' }} />
              ))}
              <col className="screen-only" style={{ width: '90px' }} />
            </colgroup>
            <thead>
              <tr>
                <th
                  rowSpan={3}
                  style={{
                    width: '10%',
                    border: '1px solid #000',
                    background: '#fff',
                    color: '#000',
                    fontSize: 10.5,
                    fontWeight: 'bold',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    padding: '4px 2px',
                    lineHeight: 1.2
                  }}
                >
                  Site<br/>Name
                </th>
                <th
                  rowSpan={3}
                  style={{
                    width: '14%',
                    border: '1px solid #000',
                    background: '#fff',
                    color: '#000',
                    fontSize: 10.5,
                    fontWeight: 'bold',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    padding: '4px 2px',
                    lineHeight: 1.2
                  }}
                >
                  Name of<br/>Security Officer<br/>on Duty
                </th>
                <th
                  rowSpan={3}
                  style={{
                    width: '8%',
                    border: '1px solid #000',
                    background: '#fff',
                    color: '#000',
                    fontSize: 10.5,
                    fontWeight: 'bold',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    padding: '4px 2px',
                    lineHeight: 1.2
                  }}
                >
                  Shift Times<br/>(DAY/Night)
                </th>
                <th
                  colSpan={13}
                  style={{
                    border: '1px solid #000',
                    background: '#fff',
                    color: '#000',
                    fontSize: 11,
                    fontWeight: 'bold',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    padding: '5px 4px'
                  }}
                >
                  Times of check calls made by the security officers to control
                </th>
                <th
                  className="screen-only"
                  rowSpan={3}
                  style={{
                    width: '90px',
                    border: '1px solid #000',
                    background: '#f8fafc',
                    color: '#000',
                    fontSize: 10.5,
                    fontWeight: 'bold',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    padding: '4px'
                  }}
                >
                  Actions
                </th>
              </tr>
              {/* Row 2: 13 Day hour columns */}
              <tr>
                {DAY_HOURS.map(h => (
                  <th
                    key={h}
                    style={{
                      width: '5.23%',
                      border: '1px solid #000',
                      background: '#fff',
                      color: '#000',
                      fontSize: 9.5,
                      fontWeight: 'bold',
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      padding: '3px 0',
                      lineHeight: 1.2
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
              {/* Row 3: 13 Night hour columns */}
              <tr>
                {NIGHT_HOURS.map(h => (
                  <th
                    key={h}
                    style={{
                      width: '5.23%',
                      border: '1px solid #000',
                      background: '#fff',
                      color: '#000',
                      fontSize: 9.5,
                      fontWeight: 'bold',
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      padding: '3px 0',
                      lineHeight: 1.2
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dayGroups.map(({ dateKey, shifts }) => {
                return (
                  <React.Fragment key={`day-group-${dateKey}`}>
                    <tr>
                      <td
                        colSpan={17}
                        style={{
                          background: '#f1f5f9',
                          border: '1.5px solid #000',
                          borderBottom: '1px solid #000',
                          padding: '6px 10px',
                          fontSize: 11,
                          fontWeight: 'bold',
                          color: '#0f172a',
                          textAlign: 'left'
                        }}
                      >
                        📅 {new Date(dateKey + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                    </tr>
                    {shifts.map((row, idx) => {
                      const isLastInDay = idx === shifts.length - 1;
                      const borderBottom = isLastInDay ? '2.5px solid #000' : '1px solid #000';

                      const cells = Array.from({ length: 13 }, (_, slotIdx) => {
                        const slotData = row.hourlyChecks?.[slotIdx];
                        const checks = slotData?.checks || [];
                        let text = '-';
                        if (checks.length > 0) {
                          text = checks.map(c => c.time).join('; ');
                        }
                        const hasIssue = checks.some(c => c.response === 'no' || c.response === 'missed');

                        return (
                          <td
                            key={slotIdx}
                            style={{
                              border: '1px solid #000',
                              borderBottom,
                              padding: '5px 2px',
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              fontSize: 10,
                              color: hasIssue ? '#dc2626' : '#000',
                              fontWeight: hasIssue ? 'bold' : 'normal',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {text}
                          </td>
                        );
                      });

                      return (
                        <tr key={`${dateKey}-${row.officerId}-${idx}`}>
                          <td
                            style={{
                              border: '1px solid #000',
                              borderBottom,
                              padding: '5px 4px',
                              fontSize: 9.5,
                              fontWeight: 'bold',
                              textAlign: 'center',
                              textTransform: 'uppercase',
                              verticalAlign: 'middle',
                              background: '#fff'
                            }}
                          >
                            {row.siteName || 'Site'}
                          </td>
                          <td
                            style={{
                              border: '1px solid #000',
                              borderBottom,
                              padding: '5px 4px',
                              fontSize: 10.5,
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              background: '#fff',
                              fontWeight: 'bold'
                            }}
                          >
                            {row.officerName}
                            {row.badgeNumber ? (
                              <span style={{ fontSize: 9, color: '#64748b', display: 'block', fontWeight: 'normal' }}>
                                {row.badgeNumber}
                              </span>
                            ) : null}
                          </td>
                          <td
                            style={{
                              border: '1px solid #000',
                              borderBottom,
                              padding: '5px 4px',
                              fontSize: 9.5,
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              background: '#fff'
                            }}
                          >
                            <span style={{ fontWeight: 'bold' }}>{row.shiftType}</span>
                            <span style={{ fontSize: 8.5, color: '#64748b', display: 'block' }}>
                              {row.shiftTimes || (row.shiftType === 'Day' ? '07:00–19:00' : '19:00–07:00')}
                            </span>
                          </td>
                          {cells}
                          <td
                            className="screen-only"
                            style={{
                              border: '1px solid #000',
                              borderBottom,
                              padding: '4px 6px',
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              background: '#fff',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button
                                onClick={() => setEditingShift(row)}
                                style={{
                                  background: '#fef3c7',
                                  color: '#92400e',
                                  border: '1px solid #fde68a',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  cursor: 'pointer'
                                }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setDeletingShift(row)}
                                style={{
                                  background: '#fee2e2',
                                  color: '#b91c1c',
                                  border: '1px solid #fecaca',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  cursor: 'pointer'
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          <div style={{ marginTop: 14, fontSize: 11, color: '#000', textAlign: 'left', fontFamily: 'Arial, sans-serif' }}>
            Doc No: QBC.3, Issue Date:01/09/2024, Issue:1
          </div>
        </div>
      ) : (
        <div className="checklog-empty">
          <div className="empty-mark">◷</div>
          <strong>No shift records for this range</strong>
          <span>Choose another date range or adjust the site and officer filters.</span>
        </div>
      )}
    </section>

    {/* Delete Shift Modal */}
    {deletingShift && (
      <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setDeletingShift(null)}>
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-3 text-red-600">
            <span className="text-2xl">⚠️</span>
            <h3 className="text-base font-bold text-slate-900">Delete Shift Record</h3>
          </div>
          <p className="mt-3 text-xs text-slate-600 leading-relaxed">
            Are you sure you want to delete the <strong>{deletingShift.shiftType}</strong> shift on <strong>{deletingShift.shiftDate}</strong> for <strong>{deletingShift.officerName}</strong> at <strong>{deletingShift.siteName}</strong>? All associated hourly check calls for this shift will also be removed.
          </p>
          {crudError && <div className="mt-3 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">{crudError}</div>}
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              onClick={() => setDeletingShift(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={crudBusy}
              className="rounded-xl bg-red-600 px-5 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
              onClick={handleDeleteShift}
            >
              {crudBusy ? 'Deleting…' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Edit Shift Modal */}
    {editingShift && (
      <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditingShift(null)}>
        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">Edit Shift Information</h3>
            <button className="text-slate-400 hover:text-slate-600" onClick={() => setEditingShift(null)}>✕</button>
          </div>
          {crudError && <div className="mt-3 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">{crudError}</div>}
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700">Security Officer</label>
              <div className="mt-1 text-sm font-semibold text-slate-800">{editingShift.officerName} {editingShift.badgeNumber ? `(${editingShift.badgeNumber})` : ''}</div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Site Location</label>
              <div className="mt-1 text-sm text-slate-600">{editingShift.siteName}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Shift Date</label>
                <div className="mt-1 text-sm font-mono text-slate-800">{editingShift.shiftDate}</div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Shift Type</label>
                <div className="mt-1 text-sm font-semibold text-slate-800">{editingShift.shiftType}</div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 mt-3">
              <div className="text-xs font-bold text-slate-800 mb-2">Hourly Check Calls Status</div>
              <div className="text-xs text-slate-500">
                To edit individual check call timestamps or change verification statuses, switch to the <strong>Shift &amp; Patrol Reports</strong> tab where all hourly logs can be modified individually with complete audit tracking.
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800"
              onClick={() => setEditingShift(null)}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Add Shift Modal */}
    {showAddShiftModal && (
      <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowAddShiftModal(false)}>
        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">+ Add Shift &amp; Attendance Entry</h3>
            <button className="text-slate-400 hover:text-slate-600" onClick={() => setShowAddShiftModal(false)}>✕</button>
          </div>
          {crudError && <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-700">{crudError}</div>}
          <form className="mt-4 space-y-3" onSubmit={handleCreateShift}>
            <div>
              <label className="text-xs font-bold text-slate-700">Security Officer *</label>
              <select
                className="form-input mt-1.5 w-full"
                required
                value={newShift.guardId}
                onChange={e => setNewShift({ ...newShift, guardId: e.target.value })}
              >
                <option value="">Select an active officer...</option>
                {guards.map(g => (
                  <option key={idOf(g)} value={idOf(g)}>
                    {g.name} {g.badgeNumber ? `(${g.badgeNumber})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">Site Location *</label>
              <select
                className="form-input mt-1.5 w-full"
                required
                value={newShift.siteId}
                onChange={e => setNewShift({ ...newShift, siteId: e.target.value })}
              >
                <option value="">Select an assigned site...</option>
                {sites.map(s => (
                  <option key={idOf(s)} value={idOf(s)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Shift Date *</label>
                <input
                  type="date"
                  className="form-input mt-1.5 w-full"
                  required
                  value={newShift.shiftDate}
                  onChange={e => setNewShift({ ...newShift, shiftDate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Shift Type *</label>
                <select
                  className="form-input mt-1.5 w-full"
                  value={newShift.shiftType}
                  onChange={e => {
                    const st = e.target.value;
                    setNewShift({
                      ...newShift,
                      shiftType: st,
                      startTime: st === 'Day' ? '07:00' : '19:00',
                      endTime: st === 'Day' ? '19:00' : '07:00',
                    });
                  }}
                >
                  <option value="Night">Night (19:00–07:00)</option>
                  <option value="Day">Day (07:00–19:00)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Start Time</label>
                <input
                  type="time"
                  className="form-input mt-1.5 w-full"
                  value={newShift.startTime}
                  onChange={e => setNewShift({ ...newShift, startTime: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">End Time</label>
                <input
                  type="time"
                  className="form-input mt-1.5 w-full"
                  value={newShift.endTime}
                  onChange={e => setNewShift({ ...newShift, endTime: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                onClick={() => setShowAddShiftModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={crudBusy}
                className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-extrabold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
              >
                {crudBusy ? 'Creating…' : 'Create Shift'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
  </div>;
}
