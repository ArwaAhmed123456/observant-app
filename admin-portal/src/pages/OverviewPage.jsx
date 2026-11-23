import React, { useEffect, useState } from 'react';

const API = (import.meta.env.VITE_API_URL || 'https://observant-api-zl49.onrender.com').replace(/\/$/, '');

function Icon({ name, size = 18 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const shapes = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
    building: <><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="22.01"/><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/></>,
    report: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/></>,
    calendar: <><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
    alert: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    arrowRight: <path d="M5 12h14M12 5l7 7-7 7"/>,
    check: <polyline points="20 6 9 17 4 12"/>,
  };
  return <svg {...common}>{shapes[name] || shapes.grid}</svg>;
}

export default function OverviewPage({ session, onNavigate }) {
  const [data, setData] = useState({
    onDutyCount: 0,
    guardsCount: 0,
    todayCallsCount: 0,
    checkCallRate: '100%',
    todayPatrolsCount: 0,
    sitesCount: 0,
    recentActivity: [],
    alerts: [],
    sites: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const fetchOverview = async () => {
      setLoading(true);
      try {
        const todayIso = new Date().toISOString().slice(0, 10);
        const headers = { Authorization: `Bearer ${session.accessToken}` };

        const [summaryRes, usersRes, sitesRes, reportsRes, alertsRes] = await Promise.all([
          fetch(`${API}/api/reports/summary?from=${todayIso}T00:00:00.000Z&to=${todayIso}T23:59:59.999Z`, { headers }).catch(() => ({ ok: false })),
          fetch(`${API}/api/users?role=guard`, { headers }).catch(() => ({ ok: false })),
          fetch(`${API}/api/sites`, { headers }).catch(() => ({ ok: false })),
          fetch(`${API}/api/reports/shift-calls?from=${todayIso}T00:00:00.000Z&to=${todayIso}T23:59:59.999Z`, { headers }).catch(() => ({ ok: false })),
          fetch(`${API}/api/alerts?limit=5`, { headers }).catch(() => ({ ok: false })),
        ]);

        const [summaryData, usersData, sitesData, reportsData, alertsData] = await Promise.all([
          summaryRes.ok ? summaryRes.json() : { summary: {} },
          usersRes.ok ? usersRes.json() : { users: [] },
          sitesRes.ok ? sitesRes.json() : { sites: [] },
          reportsRes.ok ? reportsRes.json() : { rows: [] },
          alertsRes.ok ? alertsRes.json() : { alerts: [] },
        ]);

        let recent = (reportsData.rows || []).map(r => ({
          id: r.id || r._id,
          type: r.type || 'check_call',
          guardName: r.guardName || r.guard,
          site: r.site || r.siteName,
          note: r.note || (r.type === 'patrol' ? 'Patrol round' : 'Hourly check verification'),
          response: r.response || (r.status === 'in_progress' ? 'In Progress' : r.status === 'complete' ? 'Completed' : r.status || 'Verified'),
          status: r.status,
          date: r.date || r.timestamp,
        }));
        if (recent.length === 0) {
          const fallbackRes = await fetch(`${API}/api/check-calls?limit=10`, { headers }).catch(() => ({ ok: false }));
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            recent = (fallbackData.checkCalls || []).map(cc => ({
              id: cc._id,
              type: 'check_call',
              guardName: cc.guardId?.name,
              site: cc.siteId?.name,
              note: cc.note || 'Hourly check verification',
              response: cc.response || 'Verified',
              date: cc.respondedAt || cc.firedAt,
            }));
          }
        }

        const prioritySites = ['totmonslow', 'testing site'];
        const sortedSites = [...(sitesData.sites || [])].sort((a, b) => {
          const aName = (a.name || '').toLowerCase();
          const bName = (b.name || '').toLowerCase();
          const aIdx = prioritySites.findIndex(p => aName.includes(p));
          const bIdx = prioritySites.findIndex(p => bName.includes(p));
          if (aIdx !== -1 && bIdx === -1) return -1;
          if (aIdx === -1 && bIdx !== -1) return 1;
          if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
          return aName.localeCompare(bName);
        });

        if (alive) {
          const sum = summaryData?.summary || {};
          setData({
            onDutyCount: sum.activeSessions ?? (reportsData.rows?.filter(r => !r.shiftEnd)?.length || 0),
            guardsCount: (usersData.users || []).length,
            todayCallsCount: sum.checkCalls?.total ?? (reportsData.rows?.filter(r => r.type === 'check_call')?.length || 0),
            checkCallRate: sum.checkCalls?.rate || '100%',
            todayPatrolsCount: sum.patrols?.total ?? (reportsData.rows?.filter(r => r.type === 'patrol')?.length || 0),
            sitesCount: (sitesData.sites || []).length,
            recentActivity: recent.slice(0, 8),
            alerts: alertsData.alerts || [],
            sites: sortedSites,
          });
        }
      } catch (err) {
        console.error('Overview error:', err);
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchOverview();
    return () => { alive = false; };
  }, [session?.accessToken]);

  return (
    <div className="overview-page space-y-6">
      {/* Welcome Banner */}
      <section className="rounded-3xl border border-slate-200 bg-linear-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold tracking-wider text-amber-300 uppercase backdrop-blur-md">
            <span className="live-dot" /> Live Command Center
          </div>
          <h1 className="mt-3 text-2xl md:text-4xl font-extrabold tracking-tight">
            Welcome back, {session?.user?.name || 'Operations Lead'}
          </h1>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Observant security operations are online. Monitor active shifts, check call frequencies, site patrols, and staff deployments across all client locations.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => onNavigate('users')}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-amber-400 transition-colors shadow-lg"
            >
              <Icon name="plus" size={15} /> Add Guard / Manager
            </button>
            <button
              onClick={() => onNavigate('checklog')}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/20 transition-colors backdrop-blur-md"
            >
              <Icon name="calendar" size={15} /> Open Check Call Log
            </button>
            <button
              onClick={() => onNavigate('reports')}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/20 transition-colors backdrop-blur-md"
            >
              <Icon name="report" size={15} /> View Shift Reports
            </button>
          </div>
        </div>
      </section>

      {/* KPI Cards */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Card 1: Guards On Duty */}
        <div
          onClick={() => onNavigate('users')}
          className="metric-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-emerald-400 hover:shadow-md cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="metric-icon tone-green"><Icon name="shield" size={18} /></div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
            </span>
          </div>
          <div className="mt-4 text-3xl font-extrabold text-slate-900">{data.onDutyCount}</div>
          <div className="mt-1 text-xs font-bold text-slate-800">Guards On Duty</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{data.guardsCount} registered staff</div>
        </div>

        {/* Card 2: Today's Check Calls */}
        <div
          onClick={() => onNavigate('reports')}
          className="metric-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-400 hover:shadow-md cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="metric-icon tone-blue"><Icon name="report" size={18} /></div>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
              {data.checkCallRate} SLA
            </span>
          </div>
          <div className="mt-4 text-3xl font-extrabold text-slate-900">{data.todayCallsCount}</div>
          <div className="mt-1 text-xs font-bold text-slate-800">Today's Check Calls</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Hourly checks logged today</div>
        </div>

        {/* Card 3: Completed Patrols */}
        <div
          onClick={() => onNavigate('reports')}
          className="metric-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-amber-400 hover:shadow-md cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="metric-icon tone-gold"><Icon name="check" size={18} /></div>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
              Completed
            </span>
          </div>
          <div className="mt-4 text-3xl font-extrabold text-slate-900">{data.todayPatrolsCount}</div>
          <div className="mt-1 text-xs font-bold text-slate-800">Site Patrols Completed</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Physical rounds verified</div>
        </div>

        {/* Card 4: Client Sites & Geofences */}
        <div
          onClick={() => onNavigate('sites')}
          className="metric-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-indigo-400 hover:shadow-md cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="metric-icon tone-navy"><Icon name="building" size={18} /></div>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
              Perimeters
            </span>
          </div>
          <div className="mt-4 text-3xl font-extrabold text-slate-900">{data.sitesCount}</div>
          <div className="mt-1 text-xs font-bold text-slate-800">Client Sites & Geofences</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Totmonslow & active zones</div>
        </div>
      </section>

      {/* Main Split Grid: Live Activity Feed + Quick Management */}
      <section className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Recent Activity */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Shift Activity & Check Calls</h2>
              <p className="text-xs text-slate-500 mt-0.5">Live events logged by on-site guards</p>
            </div>
            <button
              onClick={() => onNavigate('reports')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              All Reports <Icon name="arrowRight" size={13} />
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {data.recentActivity.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No recent activity logged for today yet. Active shifts will populate here.
              </div>
            ) : (
              data.recentActivity.map((item, idx) => (
                <div key={item.id || idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100/70 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                      item.type === 'patrol' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {item.type === 'patrol' ? 'PT' : 'CC'}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        {item.guardName || 'Officer'}
                        <span className="text-[10px] text-slate-500 font-normal">· {item.site || 'Site'}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {item.note || item.category || 'Hourly check verification'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      (item.status === 'in_progress' || item.response === 'In Progress')
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {item.response || item.status || 'Verified'}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {item.date ? new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Sites Quick Overview & Team Access */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">Operational Sites</h2>
              <button onClick={() => onNavigate('sites')} className="text-xs font-bold text-blue-600">
                View all ({data.sites.length})
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {data.sites.slice(0, 4).map(site => (
                <div key={site._id || site.id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 text-xs">
                  <div>
                    <div className="font-bold text-slate-800">{site.name}</div>
                    <div className="text-[10px] text-slate-400">
                      {site.address || 'Operational Location'}
                      {site.what3words ? ` · ${site.what3words}` : ''}
                    </div>
                  </div>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold whitespace-nowrap">
                    {site.geofenceRadiusMetres ? `${site.geofenceRadiusMetres}m` : '250m'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-linear-to-b from-slate-50 to-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">Quick Actions</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => onNavigate('users')}
                className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold gap-1 text-center"
              >
                <Icon name="users" size={18} />
                <span>Manage Users</span>
              </button>
              <button
                onClick={() => onNavigate('sites')}
                className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold gap-1 text-center"
              >
                <Icon name="building" size={18} />
                <span>Manage Sites</span>
              </button>
              <button
                onClick={() => onNavigate('schedules')}
                className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold gap-1 text-center"
              >
                <Icon name="calendar" size={18} />
                <span>Rosters</span>
              </button>
              <button
                onClick={() => onNavigate('reports')}
                className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold gap-1 text-center"
              >
                <Icon name="report" size={18} />
                <span>Reports</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
