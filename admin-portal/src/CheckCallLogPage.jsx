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
    } catch (reason) { setMatrix([]); setError(reason.message || 'Could not load check call records.'); }
    finally { setLoading(false); }
  }

  function changePreset(value) {
    setPreset(value);
    if (value !== 'custom') setDraftRange(getDateRange(value));
  }

  // Group matrix shifts by day
  const dayGroups = useMemo(() => {
    const sorted = [...matrix].sort((a, b) => {
      if (a.shiftDate !== b.shiftDate) return a.shiftDate.localeCompare(b.shiftDate);
      if (a.shiftType !== b.shiftType) return a.shiftType === 'Day' ? -1 : 1;
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
      <div className="checklog-actions"><button className="secondary-button" onClick={() => generate({ ...filters, range: draftRange })} disabled={loading}>{loading ? 'Generating…' : 'Generate Report'}</button><button className="primary-button" onClick={() => window.print()} disabled={!matrix.length}><span aria-hidden="true">⎙</span> Print / Export PDF</button></div>
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
        The precise time must be recorded. Late CALLS must be recorded in <span style={{ color: 'red', fontWeight: 'bold' }}>RED</span> ink and a brief explanation in the Logbook.<br/>
        Missed calls (Security Officer not responding to your call after 15 minutes) must be reported &amp; fully explained in the Incident Log Book
      </div>

      {/* ── Main Matrix Table matching reference sample exactly ── */}
      {loading ? (
        <div className="checklog-empty screen-only">Generating the report…</div>
      ) : matrix.length ? (
        <div className="checklog-table-container">
          <table className="checklog-formal-table">
            <colgroup>
              <col style={{ width: '10%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '8%' }} />
              {DAY_HOURS.map(h => (
                <col key={h} style={{ width: '5.23%' }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th rowSpan={3} className="formal-th">
                  Site<br/>Name
                </th>
                <th rowSpan={3} className="formal-th">
                  Name of<br/>Security Officer<br/>on Duty
                </th>
                <th rowSpan={3} className="formal-th">
                  Shift Times<br/>(DAY/Night)
                </th>
                <th colSpan={13} className="formal-th" style={{ padding: '5px 4px', fontSize: 11 }}>
                  Times of check calls made by the security officers to control
                </th>
              </tr>
              {/* Row 2: 13 Day hour columns */}
              <tr>
                {DAY_HOURS.map(h => (
                  <th key={h} className="formal-th formal-hour-th">
                    {h}
                  </th>
                ))}
              </tr>
              {/* Row 3: 13 Night hour columns */}
              <tr>
                {NIGHT_HOURS.map(h => (
                  <th key={h} className="formal-th formal-hour-th">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dayGroups.map(({ dateKey, shifts }) => {
                return shifts.map((row, idx) => {
                  const isLastInDay = idx === shifts.length - 1;
                  const dayClass = isLastInDay ? 'day-end-row' : '';

                  const cells = Array.from({ length: 13 }, (_, slotIdx) => {
                    const slotData = row.hourlyChecks?.[slotIdx];
                    const activeCheck = slotData?.checks?.[0];
                    let text = '-';
                    let isLate = false;
                    if (activeCheck && activeCheck.time) {
                      text = activeCheck.time;
                      isLate = activeCheck.isLate || activeCheck.response === 'missed';
                    }
                    return (
                      <td
                        key={slotIdx}
                        className={`formal-td formal-time-td ${isLate ? 'late-call' : ''}`}
                      >
                        {text}
                      </td>
                    );
                  });

                  return (
                    <tr key={`${dateKey}-${row.officerId}-${idx}`} className={dayClass}>
                      {idx === 0 && (
                        <td
                          rowSpan={shifts.length}
                          className="formal-td formal-site-td"
                        >
                          {(row.siteName || 'TOTMONSLOW SOLAR FARM')
                            .toUpperCase()
                            .split(' ')
                            .map((word, wi) => (
                              <React.Fragment key={wi}>
                                {word}
                                <br />
                              </React.Fragment>
                            ))}
                        </td>
                      )}
                      <td className="formal-td formal-officer-td">
                        {row.officerName}
                      </td>
                      <td className="formal-td formal-shift-td">
                        {row.shiftType}
                      </td>
                      {cells}
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="checklog-empty">
          <div className="empty-mark">◷</div>
          <strong>No shift records for this range</strong>
          <span>Choose another date range or adjust the site and officer filters.</span>
        </div>
      )}
    </section>
  </div>;
}
