import React, { useState } from 'react';
import {
  Shield,
  Users,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Calendar,
  Zap,
  Settings,
  Radio,
  BellRing,
  Activity,
  ShieldCheck
} from 'lucide-react';
import { WeeklyRoster } from './WeeklyRoster';
import { CheckpointConfig } from './CheckpointConfig';
import { AntiIdleLog } from './AntiIdleLog';
import { ShiftReport } from './ShiftReport';
import { useSecurity } from '../../context/SecurityContext';

export const ManagerDashboard = () => {
  const [activeTab, setActiveTab] = useState('monitor');
  const {
    users,
    sites,
    shiftSessions,
    checkCalls,
    patrolSessions,
    antiIdleLogs,
    triggerCheckCall,
    triggerSurprisePatrolPrompt,
    currentUser
  } = useSecurity();

  const guards = users.filter(u => u.role === 'guard');
  const activeSessions = shiftSessions.filter(s => s.isActive);
  const activeGuardsCount = activeSessions.length;

  const totalCalls = checkCalls.length;
  const okCalls = checkCalls.filter(c => c.response === 'yes').length;
  const complianceRate = totalCalls > 0 ? Math.round((okCalls / totalCalls) * 100) : 100;
  const issueAlerts = checkCalls.filter(c => c.response === 'no' || c.status === 'issue_reported').length;
  const missedCalls = checkCalls.filter(c => c.status === 'missed').length;
  const completedPatrols = patrolSessions.filter(p => p.status.includes('completed')).length;

  // Determine status class for a guard tile
  const getGuardStatusClass = (session, lastCall) => {
    if (!session) return 'status-offline';
    if (lastCall?.status === 'missed') return 'status-danger';
    if (lastCall?.response === 'no') return 'status-warn';
    return 'status-online';
  };

  const getLastCallLabel = (lastCall) => {
    if (!lastCall) return { text: 'Pending', color: 'var(--text-muted)' };
    if (lastCall.response === 'yes') return { text: '✓ OK', color: 'var(--status-ok)' };
    if (lastCall.response === 'no')  return { text: '⚠ Issue', color: 'var(--status-warn)' };
    return { text: '✗ Missed', color: 'var(--status-danger)' };
  };

  return (
    <div className="manager-workspace">
      {/* ── Metrics Banner ────────────────────────────────────────── */}
      <div className="dashboard-metrics-grid">
        <div className="metric-card metric-green">
          <div className="metric-icon-box green">
            <Radio size={22} />
          </div>
          <div className="metric-data">
            <div className="label">Active On-Site</div>
            <div className="val">{activeGuardsCount}<span style={{ fontSize: 14, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>/{guards.length}</span></div>
            <div className="sub">GPS verified</div>
          </div>
        </div>

        <div className="metric-card metric-blue">
          <div className="metric-icon-box blue">
            <Clock size={22} />
          </div>
          <div className="metric-data">
            <div className="label">Call Compliance</div>
            <div className="val">{complianceRate}<span style={{ fontSize: 14, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>%</span></div>
            <div className="sub">{okCalls} of {totalCalls} passed</div>
          </div>
        </div>

        <div className="metric-card metric-amber">
          <div className="metric-icon-box amber">
            <AlertTriangle size={22} />
          </div>
          <div className="metric-data">
            <div className="label">Incidents & Missed</div>
            <div className="val">{issueAlerts + missedCalls}</div>
            <div className="sub">{issueAlerts} issues · {missedCalls} missed SLA</div>
          </div>
        </div>

        <div className="metric-card metric-green">
          <div className="metric-icon-box gold">
            <ShieldCheck size={22} />
          </div>
          <div className="metric-data">
            <div className="label">Patrols Completed</div>
            <div className="val">{completedPatrols}</div>
            <div className="sub">Photo-verified routes</div>
          </div>
        </div>
      </div>

      {/* ── Navigation Tabs ───────────────────────────────────────── */}
      <div className="section-nav-tabs">
        <button className={`mgr-nav-btn ${activeTab === 'monitor' ? 'active' : ''}`} onClick={() => setActiveTab('monitor')}>
          <Radio size={14} /><span>Live Monitor</span>
        </button>
        <button className={`mgr-nav-btn ${activeTab === 'roster' ? 'active' : ''}`} onClick={() => setActiveTab('roster')}>
          <Calendar size={14} /><span>Weekly Roster</span>
        </button>
        <button className={`mgr-nav-btn ${activeTab === 'anti_idle' ? 'active' : ''}`} onClick={() => setActiveTab('anti_idle')}>
          <Zap size={14} /><span>Anti-Idle Log</span>
        </button>
        <button className={`mgr-nav-btn ${activeTab === 'checkpoints' ? 'active' : ''}`} onClick={() => setActiveTab('checkpoints')}>
          <Settings size={14} /><span>Checkpoint Setup</span>
        </button>
        <button className={`mgr-nav-btn ${activeTab === 'report' ? 'active' : ''}`} onClick={() => setActiveTab('report')}>
          <FileText size={14} /><span>Shift Report</span>
        </button>
      </div>

      {/* ── TAB: Live Site Monitor ────────────────────────────────── */}
      {activeTab === 'monitor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="roster-card">
            <div className="roster-header-actions">
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>
                  Guard Status Board
                </h3>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {sites.length} operational sites · London region
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="live-pulse-badge">
                  <span className="pulse-dot"></span>
                  Real-time Telemetry
                </span>
              </div>
            </div>

            {guards.length === 0 ? (
              /* Empty state */
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Users size={30} />
                </div>
                <div className="empty-state-title">No Guards Assigned</div>
                <p className="empty-state-body">Guards will appear here once added to the roster. Assign guards to sites to begin monitoring.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
                {guards.map(guard => {
                  const session = shiftSessions.find(s => s.guardId === guard.id && s.isActive);
                  const assignedSite = sites.find(s => s.id === (session?.siteId || guard.assignedSiteId));
                  const lastCall = checkCalls.find(c => c.guardId === guard.id);
                  const statusClass = getGuardStatusClass(session, lastCall);
                  const callLabel = getLastCallLabel(lastCall);

                  return (
                    <div key={guard.id} className={`guard-status-tile ${statusClass}`}>
                      {/* Guard identity row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img
                            src={guard.avatar}
                            alt={guard.name}
                            style={{
                              width: '40px', height: '40px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: `2px solid ${session ? 'var(--status-ok)' : 'var(--border-mid)'}`,
                              boxShadow: session ? '0 0 10px var(--status-ok-glow)' : 'none'
                            }}
                          />
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>
                              {guard.name}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '1px' }}>
                              {guard.badgeNumber} · {guard.experienceYears}y exp
                            </div>
                          </div>
                        </div>
                        <span className={`status-pill ${session ? 'ok' : 'info'}`} style={{ opacity: session ? 1 : 0.6 }}>
                          {session ? 'ON SITE' : 'OFF DUTY'}
                        </span>
                      </div>

                      {/* Site location */}
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '10px' }}>
                        <MapPin size={12} color="var(--status-cyan)" />
                        <span>{assignedSite?.name || 'No site assigned'}</span>
                      </div>

                      {/* Status data */}
                      {session ? (
                        <div style={{
                          background: 'var(--bg-main)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '10px',
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '6px',
                          fontSize: '11px',
                          marginBottom: '10px'
                        }}>
                          <div>
                            <div style={{ color: 'var(--text-muted)', marginBottom: '2px', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Punctuality</div>
                            <div style={{ fontWeight: '700', color: session.punctualityStatus === 'On Time' ? 'var(--status-ok)' : 'var(--status-warn)' }}>
                              {session.punctualityStatus}
                              {session.punctualityMinutes > 0 && ` (${session.punctualityMinutes}m)`}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: 'var(--text-muted)', marginBottom: '2px', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Booked On</div>
                            <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                              {new Date(session.bookedOnAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <div style={{ color: 'var(--text-muted)', marginBottom: '2px', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Last Check Call</div>
                            <div style={{ fontWeight: '700', color: callLabel.color }}>{callLabel.text}</div>
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          background: 'var(--bg-main)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '10px',
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          marginBottom: '10px',
                          fontStyle: 'italic'
                        }}>
                          Not currently on site. See weekly roster for next scheduled shift.
                        </div>
                      )}

                      {/* Quick actions */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => triggerCheckCall(false, guard)}
                          style={{
                            flex: 1,
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--status-ok-border)',
                            color: 'var(--status-ok)',
                            padding: '7px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '11px',
                            fontWeight: '700',
                            transition: 'all 0.15s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px'
                          }}
                        >
                          <Activity size={12} />
                          Check Call
                        </button>
                        <button
                          onClick={() => triggerSurprisePatrolPrompt(guard.id)}
                          style={{
                            flex: 1,
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--status-warn-border)',
                            color: 'var(--status-warn)',
                            padding: '7px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '11px',
                            fontWeight: '700',
                            transition: 'all 0.15s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px'
                          }}
                        >
                          <Zap size={12} />
                          Surprise
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'roster' && <WeeklyRoster />}
      {activeTab === 'anti_idle' && <AntiIdleLog />}
      {activeTab === 'checkpoints' && <CheckpointConfig />}
      {activeTab === 'report' && <ShiftReport />}
    </div>
  );
};


  const guards = users.filter(u => u.role === 'guard');
  const activeSessions = shiftSessions.filter(s => s.isActive);
  const activeGuardsCount = activeSessions.length;

  const totalCalls = checkCalls.length;
  const okCalls = checkCalls.filter(c => c.response === 'yes').length;
  const complianceRate = totalCalls > 0 ? Math.round((okCalls / totalCalls) * 100) : 100;
  const issueAlerts = checkCalls.filter(c => c.response === 'no' || c.status === 'issue_reported').length;
  const missedCalls = checkCalls.filter(c => c.status === 'missed').length;

  const completedPatrols = patrolSessions.filter(p => p.status.includes('completed')).length;

  return (
    <div className="manager-workspace">
      {/* Metrics Banner */}
      <div className="dashboard-metrics-grid">
        <div className="metric-card">
          <div className="metric-icon-box green">
            <Radio size={22} />
          </div>
          <div className="metric-data">
            <div className="label">Active On-Site Guards</div>
            <div className="val">{activeGuardsCount} / {guards.length}</div>
            <div className="sub">Real-time GPS verified</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box blue">
            <Clock size={22} />
          </div>
          <div className="metric-data">
            <div className="label">Check Call Compliance</div>
            <div className="val">{complianceRate}%</div>
            <div className="sub">{okCalls} of {totalCalls} passed</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box amber">
            <AlertTriangle size={22} />
          </div>
          <div className="metric-data">
            <div className="label">Incidents & Missed Calls</div>
            <div className="val">{issueAlerts + missedCalls}</div>
            <div className="sub">{issueAlerts} issues &bull; {missedCalls} missed SLA</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box green">
            <CheckCircle2 size={22} />
          </div>
          <div className="metric-data">
            <div className="label">Completed Patrols</div>
            <div className="val">{completedPatrols}</div>
            <div className="sub">Photo verified checkpoints</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="section-nav-tabs">
        <button
          className={`mgr-nav-btn ${activeTab === 'monitor' ? 'active' : ''}`}
          onClick={() => setActiveTab('monitor')}
        >
          <Radio size={15} />
          <span>Live Site Monitor</span>
        </button>

        <button
          className={`mgr-nav-btn ${activeTab === 'roster' ? 'active' : ''}`}
          onClick={() => setActiveTab('roster')}
        >
          <Calendar size={15} />
          <span>Weekly Shift Roster</span>
        </button>

        <button
          className={`mgr-nav-btn ${activeTab === 'anti_idle' ? 'active' : ''}`}
          onClick={() => setActiveTab('anti_idle')}
        >
          <Zap size={15} />
          <span>Anti-Idle & Vigilance Log</span>
        </button>

        <button
          className={`mgr-nav-btn ${activeTab === 'checkpoints' ? 'active' : ''}`}
          onClick={() => setActiveTab('checkpoints')}
        >
          <Settings size={15} />
          <span>Site Checkpoint Setup</span>
        </button>

        <button
          className={`mgr-nav-btn ${activeTab === 'report' ? 'active' : ''}`}
          onClick={() => setActiveTab('report')}
        >
          <FileText size={15} />
          <span>Shift Call Report (PDF/CSV)</span>
        </button>
      </div>

      {/* TAB CONTENT: Live Site Monitor */}
      {activeTab === 'monitor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="roster-card">
            <div className="roster-header-actions">
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#fff' }}>
                  Live Guards & Monitored Sites Status Board
                </h3>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Supervising {sites.length} operational sites across London region
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="pulse-dot"></span> Real-time Telemetry Active
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
              {guards.map(guard => {
                const session = shiftSessions.find(s => s.guardId === guard.id && s.isActive);
                const assignedSite = sites.find(s => s.id === (session?.siteId || guard.assignedSiteId));
                const lastCall = checkCalls.find(c => c.guardId === guard.id);

                return (
                  <div
                    key={guard.id}
                    style={{
                      background: 'var(--bg-main)',
                      border: session ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '16px',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img
                          src={guard.avatar}
                          alt={guard.name}
                          style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: session ? '2px solid var(--accent-green)' : '2px solid var(--border-subtle)'
                          }}
                        />
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '800', color: '#fff' }}>
                            {guard.name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {guard.badgeNumber} &bull; {guard.experienceYears}y Exp
                          </div>
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: '800',
                          textTransform: 'uppercase',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          background: session ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)',
                          color: session ? 'var(--accent-green)' : 'var(--text-muted)',
                          border: session ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-subtle)'
                        }}
                      >
                        {session ? 'Booked On' : 'Off Duty'}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <MapPin size={13} color="var(--accent-cyan)" />
                      <span>{assignedSite?.name}</span>
                    </div>

                    {session ? (
                      <div style={{ background: 'var(--bg-card)', padding: '10px', borderRadius: '6px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Punctuality:</span>
                          <span style={{ color: session.punctualityStatus === 'On Time' ? 'var(--accent-green)' : 'var(--accent-amber)', fontWeight: '700' }}>
                            {session.punctualityStatus} {session.punctualityMinutes > 0 && `(${session.punctualityMinutes}m)`}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Booked On At:</span>
                          <span className="mono" style={{ color: '#fff' }}>
                            {new Date(session.bookedOnAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Last Check Call:</span>
                          <span style={{ color: lastCall?.response === 'yes' ? 'var(--accent-green)' : lastCall?.response === 'no' ? 'var(--accent-amber)' : 'var(--accent-red)', fontWeight: '700' }}>
                            {lastCall ? (lastCall.response === 'yes' ? '✓ OK' : lastCall.response === 'no' ? '⚠️ Issue' : '🚨 Missed') : 'Pending'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: 'var(--bg-card)', padding: '10px', borderRadius: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        Guard not currently booked on site. Scheduled shift on weekly roster.
                      </div>
                    )}

                    {/* Quick Manager Actions for this guard */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <button
                        onClick={() => triggerCheckCall(false, guard)}
                        style={{
                          flex: 1,
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--accent-green)',
                          padding: '6px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700'
                        }}
                      >
                        Prompt Check Call
                      </button>

                      <button
                        onClick={() => triggerSurprisePatrolPrompt(guard.id)}
                        style={{
                          flex: 1,
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--accent-amber)',
                          padding: '6px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700'
                        }}
                      >
                        Surprise Patrol
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: Weekly Shift Roster */}
      {activeTab === 'roster' && <WeeklyRoster />}

      {/* TAB CONTENT: Anti-Idle Vigilance Log */}
      {activeTab === 'anti_idle' && <AntiIdleLog />}

      {/* TAB CONTENT: Site Checkpoint Setup */}
      {activeTab === 'checkpoints' && <CheckpointConfig />}

      {/* TAB CONTENT: Shift Call Report */}
      {activeTab === 'report' && <ShiftReport />}
    </div>
  );
};
