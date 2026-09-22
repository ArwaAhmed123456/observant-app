import React from 'react';
import { AlertTriangle, CheckCircle, Clock, Zap, ShieldAlert, Sparkles } from 'lucide-react';
import { useSecurity } from '../../context/SecurityContext';

export const AntiIdleLog = () => {
  const { antiIdleLogs, users, sites, triggerSurprisePatrolPrompt } = useSecurity();

  const getGuard = (id) => users.find(u => u.id === id);
  const getSite = (id) => sites.find(s => s.id === id);

  const totalPrompts = antiIdleLogs.length;
  const respondedCount = antiIdleLogs.filter(l => l.responded).length;
  const complianceRate = totalPrompts > 0 ? Math.round((respondedCount / totalPrompts) * 100) : 100;

  return (
    <div className="roster-card">
      <div className="roster-header-actions">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#fff' }}>
              Anti-Idle Vigilance & Sleeping Guard Detector
            </h2>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(6, 182, 212, 0.15)',
                color: 'var(--accent-cyan)',
                border: '1px solid rgba(6, 182, 212, 0.3)'
              }}
            >
              DYNAMIC PATROL GRID
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            System dispatches surprise patrol prompts after the 30-minute idle threshold to eliminate predictable guard routines.
          </p>
        </div>

        <button
          onClick={() => triggerSurprisePatrolPrompt()}
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: '#241402',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '800',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)'
          }}
        >
          <Zap size={14} />
          <span>Fire Surprise Anti-Idle Prompt</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '18px' }}>
        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>
            Surprise Prompts Issued
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#fff', marginTop: '4px' }}>
            {totalPrompts}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--accent-cyan)' }}>Automated random generation</div>
        </div>

        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>
            Guard Response Rate
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--accent-green)', marginTop: '4px' }}>
            {complianceRate}%
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{respondedCount} of {totalPrompts} acted upon promptly</div>
        </div>

        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>
            Dynamic Reschedule Rule
          </div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--accent-amber)', marginTop: '8px' }}>
            +1 Hour Dynamic Shift
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Satisfies quota; next patrol slot advanced</div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: 'var(--bg-elevated)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>Trigger Time</th>
              <th style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>Guard & Site</th>
              <th style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>Idle Gap</th>
              <th style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>Response Status</th>
              <th style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>Latency</th>
              <th style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>Grid Adjustment</th>
              <th style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>Analysis Notes</th>
            </tr>
          </thead>
          <tbody>
            {antiIdleLogs.map((log) => {
              const guard = getGuard(log.guardId);
              const site = getSite(log.siteId);

              return (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }} className="mono">
                    {new Date(log.triggerTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: '700', color: '#fff' }}>{guard?.name || 'Guard'}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{site?.name.split('-')[0]}</div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{log.gapIntervalMinutes} mins idle</span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {log.responded ? (
                      <span
                        style={{
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: 'var(--accent-green)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: '700',
                          fontSize: '11px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <CheckCircle size={12} />
                        Responded (Patrol Started)
                      </span>
                    ) : (
                      <span
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: 'var(--accent-red)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: '700',
                          fontSize: '11px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <AlertTriangle size={12} />
                        Ignored (Potential Idle)
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px' }} className="mono">
                    {log.responseLatencySeconds !== null ? `${log.responseLatencySeconds}s` : '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {log.dynamicSlotShifted ? (
                      <span style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: '600' }}>
                        ⚡ Slot shifted +1hr
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Hourly grid retained
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {log.notes}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '14px', background: 'rgba(255, 255, 255, 0.02)', padding: '10px', borderRadius: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
        🛡️ <strong>SIA Anti-Gaming Compliance:</strong> Guards who repeatedly ignore random 30-minute prompts are flagged for manager welfare checks or operational review.
      </div>
    </div>
  );
};
