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
const timeLabel = value => {
  if (!value) return '';
  const date = new Date(value);
  return `${pad(date.getHours())}${pad(date.getMinutes())}`;
};
const idOf = value => String(value?._id || value?.id || value || '');
const getDateRange = preset => {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);
  if (preset === 'weekly') start.setDate(end.getDate() - ((end.getDay() + 6) % 7));
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
  const [generatedAt, setGeneratedAt] = useState(new Date());

  useEffect(() => {
    if (!allowed || !session?.accessToken) return undefined;
    const controller = new AbortController();
    Promise.all([
      request('/api/sites', session.accessToken, controller.signal),
      request('/api/users?role=guard', session.accessToken, controller.signal),
    ]).then(([siteData, guardData]) => {
      setSites(siteData.sites || []);
      setGuards(guardData.users || []);
    }).catch(reason => { if (reason.name !== 'AbortError') setError(reason.message); });
    return () => controller.abort();
  }, [allowed, session?.accessToken]);

  async function generate(next = filters) {
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
      setGeneratedAt(new Date());
    } catch (reason) { setMatrix([]); setError(reason.message || 'Could not load check call records.'); }
    finally { setLoading(false); }
  }

  function changePreset(value) {
    setPreset(value);
    if (value !== 'custom') setDraftRange(getDateRange(value));
  }

  const reportRows = useMemo(() => {
    return matrix.map(item => ({
      ...item,
      key: [item.siteId, item.officerId, item.shiftDate, item.shiftType].join(':'),
      site: item.siteName || '—', guard: item.officerName || '—', badge: item.badgeNumber || '—',
      shift: `${item.shiftType.toUpperCase()} ${item.shiftStart ? timeLabel(item.shiftStart).replace(/(\d{2})(\d{2})/, '$1:$2') : '—'}–${item.shiftEnd ? timeLabel(item.shiftEnd).replace(/(\d{2})(\d{2})/, '$1:$2') : '—'}`,
      slots: (item.hourlyChecks || []).map(slot => new Date(slot.scheduledAt)),
      entries: (item.hourlyChecks || []).map(slot => ({
        value: (slot.checks || []).map(check => `${check.time || (check.response === 'missed' ? 'MISSED' : '—')}${check.isLate ? ' LATE' : ''}`).join(', ') || '-',
        late: Boolean(slot.isLate),
      })),
    })).sort((a, b) => a.site.localeCompare(b.site) || a.guard.localeCompare(b.guard));
  }, [matrix]);

  if (!allowed) return <section className="unauthorized-card"><div className="empty-mark">!</div><h1>Manager access required</h1><p>This Check Call Log contains sensitive operational records. Sign in with a Manager or Admin account to continue.</p></section>;

  return <div className="checklog-page">
    <section className="checklog-heading screen-only">
      <div><p className="eyebrow">OPERATIONS / REPORTING</p><h1>Check Call Log</h1><p>Build a shift-by-shift attendance log and print a landscape record.</p></div>
      <div className="checklog-actions"><button className="secondary-button" onClick={() => generate({ ...filters, range: draftRange })} disabled={loading}>{loading ? 'Generating…' : 'Generate Report'}</button><button className="primary-button" onClick={() => window.print()} disabled={!reportRows.length}><span aria-hidden="true">⎙</span> Print / Export PDF</button></div>
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
    <section id="printable-report" className="checklog-document">
      <header className="checklog-print-header"><img src={logo} alt="Observant Security logo"/><div className="checklog-company">OBSERVANT SECURITY</div></header>
      <div className="checklog-date-banner"><span>Start Date: {dateLabel(filters.range.from)}</span><span>Finish Date: {dateLabel(filters.range.to)}</span></div>
      <h2>Check Call Log</h2>
      <div className="checklog-rules"><strong>IMPORTANT INSTRUCTIONS</strong><p>The precise time must be recorded. Late CALLS must be recorded in RED ink and a brief explanation in the Logbook.</p><p>Missed calls (Security Officer not responding to your call after 15 minutes) must be reported &amp; fully explained in the Incident Log Book.</p></div>
      {loading ? <div className="checklog-empty screen-only">Generating the report…</div> : reportRows.length ? (filters.shift === 'all' ? ['Day','Night'] : [filters.shift]).map(type => {
        const group = reportRows.filter(row => row.shiftType === type);
        if (!group.length) return null;
        return <CheckCallTable key={type} rows={group} shiftType={type} />;
      }) : <div className="checklog-empty"><div className="empty-mark">◷</div><strong>No shift records for this range</strong><span>Choose another date range or adjust the site and officer filters.</span></div>}
      <footer className="checklog-footer"><span>Doc No: QBC.3</span><span>Issue Date: {dateLabel(generatedAt)}</span><span>Issue: 1</span></footer>
    </section>
  </div>;
}

function CheckCallTable({ rows, shiftType }) {
  const firstHour = shiftType === 'Day' ? 7 : 19;
  return <div className="checklog-table-wrap"><table className="checklog-table"><thead><tr><th>Site Name</th><th>Name of Security Officer on Duty</th><th>ID No</th><th>Shift Times<br/>(DAY/Night)</th>{Array.from({length:13},(_,index) => <th key={index}>{pad((firstHour + index) % 24)}00</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.key}><td>{row.site}</td><td>{row.guard}</td><td>{row.badge}</td><td>{row.shift}</td>{row.entries.map((entry,index) => <td key={index} className={entry.late ? 'text-red-600 font-bold' : ''}>{entry.value}</td>)}</tr>)}</tbody></table></div>;
}
