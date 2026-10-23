import React, { useEffect, useMemo, useState } from 'react';
import logo from '../../assets/logo.png';
import CheckCallLogPage from './CheckCallLogPage.jsx';
import OverviewPage from './pages/OverviewPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import SitesPage from './pages/SitesPage.jsx';
import SchedulesPage from './pages/SchedulesPage.jsx';

const API = (import.meta.env.VITE_API_URL || 'https://observant-api-zl49.onrender.com').replace(/\/$/, '');
const STORAGE_KEY = 'observant_admin_session';
let refreshInFlight = null;
const COLUMN_DEFS = [
  ['event', 'Event'], ['timestamp', 'Timestamp'], ['guard', 'Guard'],
  ['guardId', 'Guard ID'], ['site', 'Site'], ['gps', 'Location GPS'],
  ['status', 'Checkpoint / Call Status'], ['notes', 'Guard Notes'], ['images', 'Site Images'],
];
const DEFAULT_COLUMNS = { event: true, timestamp: true, guard: true, guardId: true, site: true, gps: false, status: true, notes: true, images: false };

function Icon({ name, size = 18 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  const shapes = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    report: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/></>,
    print: <><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    calendar: <><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    close: <><path d="m18 6-12 12M6 6l12 12"/></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    building: <><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="22.01"/><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/></>,
    menu: <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>,
    eyeOff: <><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></>,
  };
  return <svg {...common}>{shapes[name] || shapes.grid}</svg>;
}

function dayString(date) {
  const d = new Date(date);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
function dateWindow(period, customFrom, customTo) {
  const today = new Date();
  let start = new Date(today); let end = new Date(today);
  if (period === 'week') {
    const mondayOffset = (today.getDay() + 6) % 7;
    start.setDate(today.getDate() - mondayOffset);
  } else if (period === 'month') start = new Date(today.getFullYear(), today.getMonth(), 1);
  else if (period === 'custom') {
    return { from: customFrom || dayString(today), to: customTo || dayString(today) };
  }
  return { from: dayString(start), to: dayString(end) };
}
function prettyDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

async function apiRequest(path, token, options = {}) {
  const send = accessToken => fetch(`${API}${path}`, {
    ...options,
    headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...options.headers },
  });
  let response = await send(token);
  if (response.status === 401 && token && !path.includes('/api/auth/')) {
    if (!refreshInFlight) refreshInFlight = (async () => {
      let saved;
      try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { saved = null; }
      if (!saved?.refreshToken) return null;
      const refreshResponse = await fetch(`${API}/api/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: saved.refreshToken }) });
      if (!refreshResponse.ok) return null;
      const next = { ...saved, ...(await refreshResponse.json()) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('observant:session-refreshed', { detail: next }));
      return next.accessToken;
    })().finally(() => { refreshInFlight = null; });
    const nextToken = await refreshInFlight;
    if (nextToken) response = await send(nextToken);
    else window.dispatchEvent(new Event('observant:session-expired'));
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
  return body;
}

function useProtectedImages(rows, includeImages, token) {
  const [urls, setUrls] = useState({});
  useEffect(() => {
    let alive = true;
    const objectUrls = [];
    if (!includeImages || !token) { setUrls({}); return undefined; }
    const sources = [...new Set(rows.flatMap(row => (row.images || []).map(image => image.url).filter(Boolean)))];
    Promise.all(sources.map(async source => {
      try {
        const path = source.startsWith('http') ? source : `${API}${source}`;
        const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) return [source, null];
        const url = URL.createObjectURL(await response.blob());
        objectUrls.push(url);
        return [source, url];
      } catch { return [source, null]; }
    })).then(entries => { if (alive) setUrls(Object.fromEntries(entries)); });
    return () => { alive = false; objectUrls.forEach(URL.revokeObjectURL); };
  }, [rows, includeImages, token]);
  return urls;
}

export default function App() {
  const [activePage, setActivePage] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [period, setPeriod] = useState('week');
  const [customFrom, setCustomFrom] = useState(dayString(new Date()));
  const [customTo, setCustomTo] = useState(dayString(new Date()));
  const [guardId, setGuardId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [eventType, setEventType] = useState('combined');
  const [query, setQuery] = useState('');
  const [includeImages, setIncludeImages] = useState(false);
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [rows, setRows] = useState([]);
  const [guards, setGuards] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState('');
  const [imagePreview, setImagePreview] = useState(null);

  const range = useMemo(() => dateWindow(period, customFrom, customTo), [period, customFrom, customTo]);
  const protectedImages = useProtectedImages(rows, includeImages, session?.accessToken);
  const imageSourceCount = useMemo(() => new Set(rows.flatMap(row => (row.images || []).map(image => image.url).filter(Boolean))).size, [rows]);
  const imagesLoading = includeImages && Object.keys(protectedImages).length < imageSourceCount;

  useEffect(() => {
    const refreshed = event => setSession(event.detail);
    const expired = () => { localStorage.removeItem(STORAGE_KEY); setSession(null); };
    window.addEventListener('observant:session-refreshed', refreshed);
    window.addEventListener('observant:session-expired', expired);
    return () => {
      window.removeEventListener('observant:session-refreshed', refreshed);
      window.removeEventListener('observant:session-expired', expired);
    };
  }, []);

  useEffect(() => {
    if (!session?.accessToken || activePage !== 'reports') return undefined;
    const controller = new AbortController();
    const load = async () => {
      if (range.from > range.to) { setRows([]); setPageError('Choose a start date on or before the end date.'); setLoading(false); return; }
      setLoading(true); setPageError('');
      try {
        const params = new URLSearchParams({ from: `${range.from}T00:00:00.000Z`, to: `${range.to}T23:59:59.999Z`, type: eventType, includeImages: String(includeImages) });
        if (guardId) params.set('guardId', guardId);
        if (siteId) params.set('siteId', siteId);
        const [report, userData, siteData] = await Promise.all([
          apiRequest(`/api/reports/shift-calls?${params}`, session.accessToken, { signal: controller.signal }),
          apiRequest('/api/users?role=guard', session.accessToken, { signal: controller.signal }),
          apiRequest('/api/sites', session.accessToken, { signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        setRows(report.rows || []);
        setGuards(userData.users || []);
        setSites(siteData.sites || []);
      } catch (error) {
        if (!controller.signal.aborted) setPageError(error.message || 'Could not load report data.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    };
    load();
    return () => controller.abort();
  }, [session?.accessToken, activePage, range.from, range.to, guardId, siteId, eventType, includeImages]);

  const visibleRows = useMemo(() => {
    const value = query.trim().toLowerCase();
    return rows.filter(row => !value || [row.guardName, row.badgeNumber, row.site, row.response, row.status, row.note, row.category].some(field => String(field || '').toLowerCase().includes(value)));
  }, [rows, query]);
  const metrics = useMemo(() => ({
    total: visibleRows.length,
    checks: visibleRows.filter(row => row.type === 'check_call').length,
    patrols: visibleRows.filter(row => row.type === 'patrol').length,
    exceptions: visibleRows.filter(row => ['missed', 'no', 'incomplete'].includes(row.response || row.status)).length,
  }), [visibleRows]);

  async function handleLogin(event) {
    event.preventDefault(); setLoginBusy(true); setLoginError('');
    try {
      const payload = await apiRequest('/api/auth/login', null, { method: 'POST', body: JSON.stringify({ email: email.trim().toLowerCase(), password }) });
      if (!['admin', 'manager'].includes(payload.user?.role)) throw new Error('This portal is for manager and administrator accounts.');
      const next = { accessToken: payload.accessToken, refreshToken: payload.refreshToken, user: payload.user };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setSession(next); setPassword('');
    } catch (error) { setLoginError(error.message || 'Sign in failed.'); }
    finally { setLoginBusy(false); }
  }

  function signOut() { localStorage.removeItem(STORAGE_KEY); setSession(null); setRows([]); }
  function toggleColumn(key) { setColumns(previous => ({ ...previous, [key]: !previous[key] })); }
  function printReport() { window.print(); }

  const navItems = [
    { section: 'Operations' },
    { id: 'overview', label: 'Live Overview', icon: 'grid' },
    { id: 'reports', label: 'Shift & Patrol Reports', icon: 'report' },
    { id: 'checklog', label: 'Check Call Log', icon: 'calendar' },
    { id: 'schedules', label: 'Schedules & Rosters', icon: 'clock' },
    { section: 'Administration' },
    { id: 'users', label: 'Team & Members', icon: 'users' },
    { id: 'sites', label: 'Sites & Locations', icon: 'building' },
  ];

  const getPageTitle = () => {
    switch (activePage) {
      case 'overview': return { section: 'Operations', title: 'Live Command Center' };
      case 'users': return { section: 'Administration', title: 'Team & Members' };
      case 'sites': return { section: 'Administration', title: 'Sites & Geofences' };
      case 'schedules': return { section: 'Operations', title: 'Schedules & Rosters' };
      case 'checklog': return { section: 'Operations / Reporting', title: 'Check Call Log' };
      default: return { section: 'Operations / Reporting', title: 'Shift & Patrol Reports' };
    }
  };

  if (!session?.accessToken) return (
    <main className="login-page min-h-screen flex items-center justify-center p-5">
      <section className="login-card w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
        <div className="flex justify-center"><img src={logo} alt="Observant Security" className="h-24 w-24 object-contain" /></div>
        <p className="eyebrow mt-5 text-center">OBSERVANT SECURITY</p>
        <h1 className="mt-2 text-center text-3xl font-bold tracking-tight text-slate-900">Operations Portal</h1>
        <p className="mt-2 text-center text-sm text-slate-500">Sign in with your manager or administrator account.</p>
        <form className="mt-8 space-y-4" onSubmit={handleLogin}>
          <label className="field-label">Work email<input className="form-input mt-2" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} placeholder="name@company.com" /></label>
          <div>
            <label className="field-label" htmlFor="portal-password">Password</label>
            <div className="relative mt-2">
              <input
                id="portal-password"
                className="form-input pr-11"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="Enter your password"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700 transition-colors focus:outline-none"
                onClick={() => setShowPassword(prev => !prev)}
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
              </button>
            </div>
          </div>
          {loginError && <p className="error-banner" role="alert">{loginError}</p>}
          <button className="primary-button w-full" type="submit" disabled={loginBusy}>{loginBusy ? 'Signing in…' : 'Sign in securely'}</button>
        </form>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400"><Icon name="shield" size={14} /> Secure access to operational records</div>
      </section>
    </main>
  );

  const pageInfo = getPageTitle();

  return (
    <div className={`portal-shell min-h-screen md:flex ${activePage === 'checklog' ? 'checklog-active' : ''}`}>
      {/* DESKTOP SIDEBAR */}
      <aside className="sidebar hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-5 md:flex">
        <div className="flex items-center gap-3">
          <img src={logo} alt="" className="h-11 w-11 rounded-xl object-contain" />
          <div>
            <div className="text-sm font-extrabold tracking-wide text-slate-900">OBSERVANT</div>
            <div className="text-[10px] font-semibold tracking-[.16em] text-amber-700">SECURITY OPERATIONS</div>
          </div>
        </div>

        <nav className="mt-8 space-y-1">
          {navItems.map((item, idx) => {
            if (item.section) {
              return (
                <div key={idx} className="pt-4 pb-1 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">
                  {item.section}
                </div>
              );
            }
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${activePage === item.id ? 'nav-item-active' : ''}`}
                onClick={() => setActivePage(item.id)}
              >
                <Icon name={item.icon} size={17} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <span className="live-dot" /> LIVE OPERATIONS
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Connected to Observant Cloud API. Scoped to {session.user?.organisationId || 'Organisation'}.
          </p>
        </div>
      </aside>

      {/* MAIN VIEW */}
      <main className="min-w-0 flex-1 flex flex-col">
        {/* TOPBAR */}
        <header className="topbar flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <button
              className="icon-button md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <Icon name="menu" size={20} />
            </button>
            <div className="flex items-center gap-2 md:hidden">
              <img src={logo} alt="" className="h-8 w-8 object-contain" />
              <span className="text-sm font-extrabold tracking-wide">OBSERVANT</span>
            </div>
            <div className="hidden md:block">
              <div className="text-xs font-semibold uppercase tracking-[.14em] text-slate-400">
                {pageInfo.section}
              </div>
              <div className="mt-0.5 text-sm font-bold text-slate-800">
                {pageInfo.title}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-bold text-slate-800">{session.user?.name || 'Operations Lead'}</div>
              <div className="text-xs capitalize text-slate-500">{session.user?.role || 'administrator'}</div>
            </div>
            <button className="icon-button" onClick={signOut} title="Sign out" aria-label="Sign out">
              <Icon name="logout" />
            </button>
          </div>
        </header>

        {/* MOBILE MENU ACCORDION */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-slate-200 bg-white p-4 space-y-1 shadow-lg">
            {navItems.map((item, idx) => {
              if (item.section) {
                return (
                  <div key={idx} className="pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {item.section}
                  </div>
                );
              }
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`nav-item w-full ${activePage === item.id ? 'nav-item-active' : ''}`}
                  onClick={() => {
                    setActivePage(item.id);
                    setMobileMenuOpen(false);
                  }}
                >
                  <Icon name={item.icon} size={16} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ACTIVE PAGE CONTENT */}
        <div className="page-content flex-1 mx-auto max-w-[1600px] w-full px-4 py-6 md:px-8 md:py-8">
          {activePage === 'overview' && (
            <OverviewPage session={session} onNavigate={setActivePage} />
          )}

          {activePage === 'users' && (
            <UsersPage session={session} onNavigate={setActivePage} />
          )}

          {activePage === 'sites' && (
            <SitesPage session={session} onNavigate={setActivePage} />
          )}

          {activePage === 'schedules' && (
            <SchedulesPage session={session} />
          )}

          {activePage === 'checklog' && (
            <CheckCallLogPage session={session} />
          )}

          {activePage === 'reports' && (
            <div>
              <section className="page-heading flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="eyebrow">SECURITY OPERATIONS</p>
                  <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Shift call & patrol reports</h1>
                  <p className="mt-2 max-w-2xl text-sm text-slate-500">Review activity, tailor the report columns, and print an executive-ready site record.</p>
                </div>
                <button className="primary-button print-trigger" onClick={printReport} disabled={!visibleRows.length || imagesLoading}>
                  <Icon name="print" size={17} /> {imagesLoading ? 'Preparing images…' : 'Print report'}
                </button>
              </section>

              <section className="metric-grid mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Metric label="Records in view" value={metrics.total} icon="report" tone="navy" />
                <Metric label="Check calls" value={metrics.checks} icon="shield" tone="blue" />
                <Metric label="Patrols" value={metrics.patrols} icon="pin" tone="gold" />
                <Metric label="Exceptions" value={metrics.exceptions} icon="grid" tone={metrics.exceptions ? 'red' : 'green'} />
              </section>

              <section className="panel mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Find report records</h2>
                    <p className="mt-1 text-xs text-slate-500">Filter by reporting period, officer, site, and activity.</p>
                  </div>
                  <button className="text-button" onClick={() => { setPeriod('week'); setGuardId(''); setSiteId(''); setEventType('combined'); setQuery(''); setIncludeImages(false); setColumns(DEFAULT_COLUMNS); }}>
                    Reset filters
                  </button>
                </div>
                <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Date range preset">
                  {['today', 'week', 'month', 'custom'].map(item => (
                    <button key={item} className={`period-pill ${period === item ? 'period-pill-active' : ''}`} onClick={() => setPeriod(item)}>
                      {item === 'week' ? 'This week' : item === 'month' ? 'This month' : item[0].toUpperCase() + item.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="filter-grid mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {period === 'custom' && (
                    <>
                      <label className="field-label">From<input className="form-input mt-2" type="date" value={customFrom} onChange={event => setCustomFrom(event.target.value)} /></label>
                      <label className="field-label">To<input className="form-input mt-2" type="date" value={customTo} onChange={event => setCustomTo(event.target.value)} /></label>
                    </>
                  )}
                  <label className="field-label">Guard
                    <select className="form-input mt-2" value={guardId} onChange={event => setGuardId(event.target.value)}>
                      <option value="">All guards</option>
                      {guards.map(guard => <option key={guard.id || guard._id} value={guard.id || guard._id}>{guard.name}{guard.badgeNumber ? ` · ${guard.badgeNumber}` : ''}</option>)}
                    </select>
                  </label>
                  <label className="field-label">Site location
                    <select className="form-input mt-2" value={siteId} onChange={event => setSiteId(event.target.value)}>
                      <option value="">All assigned sites</option>
                      {sites.map(site => <option key={site.id || site._id} value={site.id || site._id}>{site.name}</option>)}
                    </select>
                  </label>
                  <label className="field-label">Event type
                    <select className="form-input mt-2" value={eventType} onChange={event => setEventType(event.target.value)}>
                      <option value="combined">Check calls & patrols</option>
                      <option value="check_calls">Check calls</option>
                      <option value="patrols">Patrols</option>
                    </select>
                  </label>
                  <label className="field-label">Search records
                    <div className="search-wrap mt-2">
                      <Icon name="search" size={16} />
                      <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, badge, site, note…" />
                    </div>
                  </label>
                </div>
                {period === 'custom' && customFrom > customTo && <p className="mt-3 text-xs font-semibold text-red-600">The start date must be on or before the end date.</p>}
              </section>

              <section className="panel mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Print layout</h2>
                    <p className="mt-1 text-xs text-slate-500">Choose which fields appear in your A4 export.</p>
                  </div>
                  <label className="image-switch">
                    <input type="checkbox" checked={includeImages} onChange={event => { const checked = event.target.checked; setIncludeImages(checked); if (checked) setColumns(previous => ({ ...previous, images: true })); }} />
                    <span className="switch-track" />
                    <span><b>Include site patrol images in export</b><small>{includeImages ? 'Images will be loaded securely for the report.' : 'Images are excluded to keep the report compact.'}</small></span>
                  </label>
                </div>
                <div className="column-toggles mt-5 flex flex-wrap gap-2">
                  {COLUMN_DEFS.map(([key, label]) => <label key={key} className={`column-toggle ${columns[key] ? 'column-toggle-on' : ''}`}><input type="checkbox" checked={columns[key]} onChange={() => toggleColumn(key)} />{label}</label>)}
                </div>
              </section>

              {pageError && <div className="error-banner mt-5" role="alert">{pageError}</div>}
              <section className="report-section mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="table-heading flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-4 md:px-6">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Report preview</h2>
                    <p className="mt-1 text-xs text-slate-500">{range.from} to {range.to} · {visibleRows.length} records</p>
                  </div>
                  {loading && <span className="loading-label"><span className="spinner" /> Updating</span>}
                </div>
                <PrintHeader range={range} logo={logo} filters={`${eventType === 'combined' ? 'Check calls & patrols' : eventType === 'patrols' ? 'Patrols' : 'Check calls'}${guardId ? ` · ${guards.find(guard => (guard.id || guard._id) === guardId)?.name || ''}` : ''}${siteId ? ` · ${sites.find(site => (site.id || site._id) === siteId)?.name || ''}` : ''}`} />
                {visibleRows.length === 0 && !loading ? (
                  <div className="empty-table"><div className="empty-mark"><Icon name="report" size={25} /></div><h3>No records in this view</h3><p>Try a wider date range or remove one of the filters.</p></div>
                ) : (
                  <div className="table-scroll">
                    <table className="report-table w-full border-collapse text-left">
                      <thead><tr>{COLUMN_DEFS.filter(([key]) => columns[key] && (key !== 'images' || includeImages)).map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead>
                      <tbody>{visibleRows.map(row => <ReportRow key={`${row.type}-${row.id}`} row={row} columns={columns} includeImages={includeImages} imageUrls={protectedImages} onOpenImage={setImagePreview} />)}</tbody>
                    </table>
                  </div>
                )}
              </section>
              <footer className="screen-footer mt-5 flex flex-wrap justify-between gap-2 text-[11px] text-slate-400"><span>Observant Security · Confidential operational report</span><span>Generated {prettyDate(new Date())}</span></footer>
            </div>
          )}
        </div>
      </main>

      {imagePreview && <div className="image-modal" role="dialog" aria-modal="true" onClick={() => setImagePreview(null)}><button className="modal-close" aria-label="Close image"><Icon name="close" /></button><img src={imagePreview.src} alt={imagePreview.name} onClick={event => event.stopPropagation()} /><p>{imagePreview.name}</p></div>}
    </div>
  );
}

function Metric({ label, value, icon, tone }) {
  return <article className="metric-card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className={`metric-icon tone-${tone}`}><Icon name={icon} size={16} /></div><div className="mt-4 text-2xl font-bold tabular-nums text-slate-900">{value}</div><div className="mt-1 text-xs font-medium text-slate-500">{label}</div></article>;
}

function PrintHeader({ range, logo, filters }) {
  return <div className="print-header"><img src={logo} alt="Observant Security logo" /><div><div className="print-brand-name">OBSERVANT SECURITY</div><div className="print-report-name">Shift Call & Patrol Report</div></div><div className="print-meta"><b>Reporting period</b><span>{range.from} — {range.to}</span><span>{filters}</span></div></div>;
}

function ReportRow({ row, columns, includeImages, imageUrls, onOpenImage }) {
  const isPatrol = row.type === 'patrol';
  const status = isPatrol ? row.status || 'In progress' : row.response || 'Pending';
  const statusTone = ['yes', 'complete'].includes(status) ? 'status-good' : ['no', 'missed', 'incomplete'].includes(status) ? 'status-alert' : 'status-pending';
  const images = includeImages ? row.images || [] : [];
  const selected = COLUMN_DEFS.filter(([key]) => columns[key] && (key !== 'images' || includeImages));
  return <tr>
    {selected.map(([key]) => {
      if (key === 'event') return <td key={key}><span className={`event-badge ${isPatrol ? 'event-patrol' : 'event-check'}`}>{isPatrol ? 'Patrol' : 'Check call'}</span></td>;
      if (key === 'timestamp') return <td key={key} className="whitespace-nowrap">{prettyDate(row.date)}</td>;
      if (key === 'guard') return <td key={key}><div className="font-semibold text-slate-800">{row.guardName || 'Unknown guard'}</div>{row.type === 'check_call' && row.isRandom && <span className="random-tag">Random check</span>}</td>;
      if (key === 'guardId') return <td key={key} className="font-mono text-xs">{row.badgeNumber || '—'}</td>;
      if (key === 'site') return <td key={key}>{row.site || '—'}</td>;
      if (key === 'gps') return <td key={key} className="gps-cell">{row.gps || '—'}</td>;
      if (key === 'status') return <td key={key}><span className={`status-pill ${statusTone}`}>{isPatrol ? `${row.checkpointStatus || status} · ` : ''}{status}</span></td>;
      if (key === 'notes') return <td key={key} className="notes-cell">{row.note || row.category || '—'}</td>;
      if (key === 'images') return <td key={key}><div className="image-strip">{images.length ? images.map((image, index) => {
        const src = imageUrls[image.url];
        return src ? <button className="thumb-button" key={image.id || image.url || index} onClick={() => onOpenImage({ src, name: image.checkpointName || 'Site image' })}><img src={src} alt={image.checkpointName || 'Checkpoint'} /><span>{image.checkpointName || 'Photo'}</span></button> : <span className="image-missing" key={image.id || index}>Unavailable</span>;
      }) : <span className="muted-cell">No photos</span>}</div></td>;
      return null;
    })}
  </tr>;
}
