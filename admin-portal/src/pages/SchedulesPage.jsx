import React, { useEffect, useMemo, useState } from 'react';

const API = (import.meta.env.VITE_API_URL || 'https://observant-api-zl49.onrender.com').replace(/\/$/, '');

function Icon({ name, size = 16 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const shapes = {
    calendar: <><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    chevronLeft: <path d="m15 18-6-6 6-6"/>,
    chevronRight: <path d="m9 18 6-6-6-6"/>,
    clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    building: <><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="22.01"/></>,
    trash: <><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    close: <><path d="m18 6-12 12M6 6l12 12"/></>,
    check: <polyline points="20 6 9 17 4 12"/>,
  };
  return <svg {...common}>{shapes[name] || shapes.calendar}</svg>;
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const dayNum = String(monday.getDate()).padStart(2, '0');
  return `${year}-${month}-${dayNum}`;
}

export default function SchedulesPage({ session }) {
  const [weekStartDate, setWeekStartDate] = useState(() => getMonday(new Date()));
  const [rosters, setRosters] = useState([]);
  const [guards, setGuards] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [selectedSite, setSelectedSite] = useState('');
  const [selectedGuard, setSelectedGuard] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRoster, setEditingRoster] = useState(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');

  // Shift assignment form state
  const [formData, setFormData] = useState({
    guardId: '',
    siteId: '',
    days: {
      mon: true,
      tue: true,
      wed: true,
      thu: true,
      fri: true,
      sat: false,
      sun: false,
    },
    start: '07:00',
    end: '19:00',
  });

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [rostersRes, guardsRes, sitesRes] = await Promise.all([
        fetch(`${API}/api/rosters?weekStartDate=${weekStartDate}`, {
          headers: { Authorization: `Bearer ${session.accessToken}`, Accept: 'application/json' },
        }),
        fetch(`${API}/api/users?role=guard`, {
          headers: { Authorization: `Bearer ${session.accessToken}`, Accept: 'application/json' },
        }),
        fetch(`${API}/api/sites`, {
          headers: { Authorization: `Bearer ${session.accessToken}`, Accept: 'application/json' },
        }),
      ]);

      const [rostersData, guardsData, sitesData] = await Promise.all([
        rostersRes.ok ? rostersRes.json() : { rosters: [] },
        guardsRes.ok ? guardsRes.json() : { users: [] },
        sitesRes.ok ? sitesRes.json() : { sites: [] },
      ]);

      setRosters(rostersData.rosters || []);
      setGuards(guardsData.users || []);
      setSites(sitesData.sites || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.accessToken) fetchData();
  }, [session?.accessToken, weekStartDate]);

  const changeWeek = (offset) => {
    const current = new Date(weekStartDate);
    current.setDate(current.getDate() + offset * 7);
    setWeekStartDate(getMonday(current));
  };

  const openCreateModal = () => {
    setEditingRoster(null);
    setFormData({
      guardId: guards[0]?._id || guards[0]?.id || '',
      siteId: sites[0]?._id || sites[0]?.id || '',
      days: {
        mon: true,
        tue: true,
        wed: true,
        thu: true,
        fri: true,
        sat: false,
        sun: false,
      },
      start: '07:00',
      end: '19:00',
    });
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (roster) => {
    setEditingRoster(roster);
    const gId = roster.guardId?._id || roster.guardId?.id || roster.guardId || '';
    const sId = roster.siteId?._id || roster.siteId?.id || roster.siteId || '';

    // days values are either null OR {start, end} objects — not booleans
    const daysActive = {
      mon: Boolean(roster.days?.mon?.start),
      tue: Boolean(roster.days?.tue?.start),
      wed: Boolean(roster.days?.wed?.start),
      thu: Boolean(roster.days?.thu?.start),
      fri: Boolean(roster.days?.fri?.start),
      sat: Boolean(roster.days?.sat?.start),
      sun: Boolean(roster.days?.sun?.start),
    };
    // Extract start/end times from first active day
    const firstShiftObj = Object.values(roster.days || {}).find(d => d && d.start);

    setFormData({
      guardId: gId,
      siteId: sId,
      days: daysActive,
      start: firstShiftObj?.start || '07:00',
      end: firstShiftObj?.end || '19:00',
    });
    setFormError('');
    setShowModal(true);
  };


  const handleSaveRoster = async (e) => {
    e.preventDefault();
    setFormBusy(true);
    setFormError('');

    try {
      const daysPayload = {};
      DAYS.forEach(d => {
        if (formData.days[d]) {
          daysPayload[d] = {
            start: formData.start,
            end: formData.end,
          };
        }
      });

      if (Object.keys(daysPayload).length === 0) {
        throw new Error('Please select at least one day for the scheduled shift.');
      }

      const payload = {
        guardId: formData.guardId,
        siteId: formData.siteId,
        weekStartDate,
        days: daysPayload,
      };

      const res = await fetch(`${API}/api/rosters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save roster');

      setSuccessMsg('Roster successfully published.');
      setShowModal(false);
      fetchData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormBusy(false);
    }
  };

  const handleDeleteRoster = async (rosterId) => {
    if (!confirm('Are you sure you want to delete this scheduled shift roster?')) return;
    try {
      const res = await fetch(`${API}/api/rosters/${rosterId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete roster');
      }
      setRosters(prev => prev.filter(r => (r._id || r.id) !== rosterId));
      setSuccessMsg('Roster removed.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const filteredRosters = useMemo(() => {
    return rosters.filter(r => {
      const gId = r.guardId?._id || r.guardId?.id || r.guardId;
      const sId = r.siteId?._id || r.siteId?.id || r.siteId;
      const matchesGuard = !selectedGuard || gId === selectedGuard;
      const matchesSite = !selectedSite || sId === selectedSite;
      return matchesGuard && matchesSite;
    });
  }, [rosters, selectedGuard, selectedSite]);

  return (
    <div className="schedules-page space-y-6">
      {/* Header */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="eyebrow">ROSTERING & SHIFTS</p>
          <h1 className="mt-1 text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">Weekly Shift Schedules</h1>
          <p className="mt-1 text-sm text-slate-500">Assign guard hours, view weekly duty rosters, and enforce site cover.</p>
        </div>
        <button className="primary-button" onClick={openCreateModal}>
          <Icon name="plus" size={16} /> Schedule Shifts
        </button>
      </section>

      {/* Messages */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
          <Icon name="check" size={16} /> {successMsg}
        </div>
      )}
      {error && (
        <div className="error-banner flex items-center justify-between">
          <span>{error}</span>
          <button className="text-xs underline" onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      {/* Week Navigator & Filters */}
      <section className="panel rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <button className="icon-button" onClick={() => changeWeek(-1)} title="Previous Week">
              <Icon name="chevronLeft" size={16} />
            </button>
            <div className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 flex items-center gap-2">
              <Icon name="calendar" size={15} />
              Week of {weekStartDate}
            </div>
            <button className="icon-button" onClick={() => changeWeek(1)} title="Next Week">
              <Icon name="chevronRight" size={16} />
            </button>
            <button
              className="text-xs font-bold text-blue-600 hover:text-blue-800 ml-2"
              onClick={() => setWeekStartDate(getMonday(new Date()))}
            >
              Current Week
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              className="form-input text-xs w-44"
              value={selectedGuard}
              onChange={e => setSelectedGuard(e.target.value)}
            >
              <option value="">All Security Guards</option>
              {guards.map(g => (
                <option key={g._id || g.id} value={g._id || g.id}>{g.name}</option>
              ))}
            </select>
            <select
              className="form-input text-xs w-44"
              value={selectedSite}
              onChange={e => setSelectedSite(e.target.value)}
            >
              <option value="">All Operational Sites</option>
              {sites.map(s => (
                <option key={s._id || s.id} value={s._id || s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 7-Day Matrix Header */}
        <div className="mt-4 hidden lg:grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
          {DAYS.map(day => (
            <div key={day} className="py-2 bg-slate-50 rounded-lg">
              {DAY_LABELS[day]}
            </div>
          ))}
        </div>
      </section>

      {/* Rosters List / Matrix */}
      <section className="space-y-4">
        {loading && (
          <div className="p-8 text-center"><span className="spinner" /> Loading shifts…</div>
        )}

        {!loading && filteredRosters.length === 0 ? (
          <div className="empty-table rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <div className="empty-mark mx-auto"><Icon name="calendar" size={24} /></div>
            <h3 className="mt-3 text-sm font-bold text-slate-800">No shifts scheduled for this week</h3>
            <p className="mt-1 text-xs text-slate-500">Create a weekly shift roster for your security officers.</p>
            <button className="primary-button mt-4" onClick={openCreateModal}>
              <Icon name="plus" size={16} /> Schedule Shifts
            </button>
          </div>
        ) : (
          filteredRosters.map(roster => {
            const guardName = roster.guardId?.name || 'Officer';
            const badge = roster.guardId?.badgeNumber || '';
            const siteName = roster.siteId?.name || 'Site';

            return (
              <div key={roster._id || roster.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 font-bold text-blue-700 text-xs border border-blue-100">
                      {guardName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                        {guardName}
                        {badge && <span className="font-mono text-xs text-slate-400 font-normal">({badge})</span>}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <Icon name="building" size={13} /> {siteName}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="text-xs font-semibold text-blue-700 hover:text-blue-800 flex items-center gap-1 px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50 transition-colors"
                      onClick={() => openEditModal(roster)}
                    >
                      <Icon name="edit" size={13} /> Edit Schedule
                    </button>
                    <button
                      className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-100 bg-red-50 transition-colors"
                      onClick={() => handleDeleteRoster(roster._id || roster.id)}
                    >
                      <Icon name="trash" size={13} /> Delete Roster
                    </button>
                  </div>
                </div>

                {/* Days Grid */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  {DAYS.map(day => {
                    const shift = roster.days?.[day];
                    return (
                      <div
                        key={day}
                        className={`rounded-xl p-3 border text-xs transition-colors ${
                          shift
                            ? 'bg-blue-50/60 border-blue-200 text-slate-900'
                            : 'bg-slate-50 border-slate-100 text-slate-400'
                        }`}
                      >
                        <div className="font-bold text-[11px] uppercase text-slate-500">{DAY_LABELS[day].slice(0, 3)}</div>
                        {shift ? (
                          <div className="mt-1.5">
                            <div className="font-extrabold text-blue-700 flex items-center gap-1">
                              <Icon name="clock" size={12} /> {shift.start} - {shift.end}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1">Confirmed Duty</div>
                          </div>
                        ) : (
                          <div className="mt-2 text-[11px] italic">Rest Day</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* SCHEDULE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{editingRoster ? 'Edit Guard Shift Roster' : 'Schedule Guard Shift Roster'}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{editingRoster ? 'Update shift duty times or working days for this officer.' : 'Assign weekly operational shifts for an active officer.'}</p>
              </div>
              <button
                type="button"
                className="icon-button h-8 w-8"
                onClick={() => setShowModal(false)}
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            {formError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveRoster} className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="field-label">Security Officer *</label>
                  <select
                    className="form-input mt-1"
                    value={formData.guardId}
                    onChange={e => setFormData({ ...formData, guardId: e.target.value })}
                    required
                  >
                    <option value="">Select Guard…</option>
                    {guards.map(g => (
                      <option key={g._id || g.id} value={g._id || g.id}>
                        {g.name} {g.badgeNumber ? `(${g.badgeNumber})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">Assigned Site *</label>
                  <select
                    className="form-input mt-1"
                    value={formData.siteId}
                    onChange={e => setFormData({ ...formData, siteId: e.target.value })}
                    required
                  >
                    <option value="">Select Site…</option>
                    {sites.map(s => (
                      <option key={s._id || s.id} value={s._id || s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="field-label">Shift Start Time *</label>
                  <input
                    type="time"
                    required
                    className="form-input mt-1"
                    value={formData.start}
                    onChange={e => setFormData({ ...formData, start: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Shift End Time *</label>
                  <input
                    type="time"
                    required
                    className="form-input mt-1"
                    value={formData.end}
                    onChange={e => setFormData({ ...formData, end: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="field-label mb-1.5">Scheduled Days of the Week</label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                  {DAYS.map(day => (
                    <label
                      key={day}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs cursor-pointer font-bold transition-all ${
                        formData.days[day]
                          ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-xs'
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={formData.days[day]}
                        onChange={e => setFormData({
                          ...formData,
                          days: { ...formData.days, [day]: e.target.checked }
                        })}
                      />
                      <span>{DAY_LABELS[day].slice(0, 3)}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowModal(false)}
                  disabled={formBusy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={formBusy}
                >
                  {formBusy ? 'Saving…' : (editingRoster ? 'Save Schedule Changes' : 'Publish Weekly Shift')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
