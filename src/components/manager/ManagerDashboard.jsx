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
  BellRing
} from 'lucide-react';
import { WeeklyRoster } from './WeeklyRoster';
import { CheckpointConfig } from './CheckpointConfig';
import { AntiIdleLog } from './AntiIdleLog';
import { ShiftReport } from './ShiftReport';
import { useSecurity } from '../../context/SecurityContext';

export const ManagerDashboard = () => {
  const [activeTab, setActiveTab] = useState('monitor'); // 'monitor', 'roster', 'checkpoints', 'anti_idle', 'report'
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
