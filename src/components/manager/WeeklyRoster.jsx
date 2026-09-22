import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Check,
  Send,
  Copy,
  Plus,
  Edit2,
  Bookmark,
  AlertTriangle,
  X
} from 'lucide-react';
import { useSecurity } from '../../context/SecurityContext';
import { getCurrentWeekDates } from '../../data/mockData';

export const WeeklyRoster = () => {
  const {
    users,
    sites,
    rosters,
    templates,
    publishRoster,
    overrideShiftDay,
    saveRosterTemplate,
    applyRosterTemplate
  } = useSecurity();

  const currentRoster = rosters[0];
  const weekDays = getCurrentWeekDates();
  const guards = users.filter(u => u.role === 'guard');

  // Override modal state
  const [editingShift, setEditingShift] = useState(null);
  const [overrideStartTime, setOverrideStartTime] = useState('18:00');
  const [overrideEndTime, setOverrideEndTime] = useState('06:00');
  const [overrideSiteId, setOverrideSiteId] = useState('site-1');
  const [overrideReason, setOverrideReason] = useState('');

  // Template modal state
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [targetGuardId, setTargetGuardId] = useState(guards[0]?.id || '');
  const [newTemplateName, setNewTemplateName] = useState('');

  const handleOpenOverride = (shift, guard, day) => {
    setEditingShift({ shift, guard, day });
    setOverrideStartTime(shift ? shift.startTime : '18:00');
    setOverrideEndTime(shift ? shift.endTime : '06:00');
    setOverrideSiteId(shift ? shift.siteId : guard.assignedSiteId || 'site-1');
    setOverrideReason(shift?.overrideReason || 'Emergency shift swap / cover');
  };

  const handleSaveOverride = () => {
    if (!editingShift) return;
    if (editingShift.shift) {
      overrideShiftDay(editingShift.shift.id, {
        startTime: overrideStartTime,
        endTime: overrideEndTime,
        siteId: overrideSiteId,
        reason: overrideReason
      });
    }
    setEditingShift(null);
  };

  const handleApplyTemplate = () => {
    if (!selectedTemplateId || !targetGuardId) return;
    applyRosterTemplate(selectedTemplateId, targetGuardId);
    setTemplateModalOpen(false);
  };

  return (
    <div className="roster-card">
      <div className="roster-header-actions">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#fff' }}>
              Weekly Shift Roster Management
            </h2>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '4px',
                background: currentRoster?.published ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: currentRoster?.published ? 'var(--accent-green)' : 'var(--accent-amber)',
                border: `1px solid ${currentRoster?.published ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
              }}
            >
              {currentRoster?.published ? 'PUBLISHED' : 'DRAFT'}
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Week {currentRoster?.weekNumber} &bull; Advance Weekly Notice Model (Mon {weekDays[0]?.displayDate} – Sun {weekDays[6]?.displayDate})
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setTemplateModalOpen(true)}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--accent-cyan)',
              padding: '8px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Bookmark size={14} />
            <span>Templates</span>
          </button>

          <button
            onClick={() => publishRoster(currentRoster.id)}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#032612',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
            }}
          >
            <Send size={14} />
            <span>Publish & Notify Guards</span>
          </button>
        </div>
      </div>

      {/* Roster Matrix Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="roster-matrix-table">
          <thead>
            <tr>
              <th className="guard-col-header">Guard & Assigned Site</th>
              {weekDays.map(d => (
                <th key={d.dayName} style={{ background: d.isToday ? 'rgba(16, 185, 129, 0.15)' : '' }}>
                  <div>{d.dayName}</div>
                  <div style={{ fontSize: '9px', fontWeight: '500', color: d.isToday ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                    {d.displayDate}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {guards.map(guard => {
              const guardShifts = currentRoster?.shifts?.filter(s => s.guardId === guard.id) || [];
              const assignedSite = sites.find(s => s.id === guard.assignedSiteId);

              return (
                <tr key={guard.id}>
                  {/* Guard Profile Row Head */}
                  <td
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      padding: '10px 12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img
                        src={guard.avatar}
                        alt={guard.name}
                        style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>
                          {guard.name}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {assignedSite?.name.split('-')[0]} &bull; {guard.badgeNumber}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* 7 Days Shift Cells */}
                  {weekDays.map(day => {
                    const shift = guardShifts.find(s => s.dayName === day.dayName);
                    const isWorking = shift && shift.status !== 'off';
                    const shiftSite = sites.find(s => s.id === (shift?.siteId || guard.assignedSiteId));

                    return (
                      <td
                        key={day.dayName}
                        className={`roster-shift-cell ${isWorking ? 'active-shift' : 'off'} ${shift?.isOverridden ? 'overridden' : ''}`}
                        onClick={() => handleOpenOverride(shift, guard, day)}
                        title="Click to edit or override single-day shift"
                      >
                        {isWorking ? (
                          <>
                            <div className="cell-time mono">
                              {shift.startTime}–{shift.endTime}
                            </div>
                            <div className="cell-site" title={shiftSite?.name}>
                              {shiftSite?.name.split('-')[0]}
                            </div>
                            {shift.isOverridden && (
                              <span className="override-badge">OVERRIDE</span>
                            )}
                          </>
                        ) : (
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', paddingTop: '10px' }}>
                            OFF
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
        <div>
          💡 <em>Tip: Click on any shift cell to edit hours, switch sites, or record a sickness/swap override without altering the weekly template.</em>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', background: 'var(--accent-green)', borderRadius: '2px' }}></span>
            Active Shift
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', background: 'var(--accent-amber)', borderRadius: '2px' }}></span>
            Override
          </span>
        </div>
      </div>

      {/* SINGLE DAY OVERRIDE MODAL */}
      {editingShift && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--accent-amber)', fontWeight: '700', textTransform: 'uppercase' }}>
                  Single-Day Schedule Adjustment
                </span>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#fff' }}>
                  {editingShift.guard.name} &bull; {editingShift.day.dayName} ({editingShift.day.displayDate})
                </h3>
              </div>
              <button onClick={() => setEditingShift(null)} style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Start Time
                </label>
                <input
                  type="time"
                  className="filter-input"
                  value={overrideStartTime}
                  onChange={(e) => setOverrideStartTime(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  End Time
                </label>
                <input
                  type="time"
                  className="filter-input"
                  value={overrideEndTime}
                  onChange={(e) => setOverrideEndTime(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Assigned Site
              </label>
              <select
                className="filter-input"
                value={overrideSiteId}
                onChange={(e) => setOverrideSiteId(e.target.value)}
              >
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Override Reason (Dispatched to Guard)
              </label>
              <input
                type="text"
                className="filter-input"
                placeholder="e.g. Shift swap with M. Vance, sickness cover, extra event patrol"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  padding: '10px',
                  borderRadius: '6px',
                  fontWeight: '600'
                }}
                onClick={() => setEditingShift(null)}
              >
                Cancel
              </button>
              <button
                className="btn-book-on"
                onClick={handleSaveOverride}
                style={{ padding: '10px', borderRadius: '6px' }}
              >
                Save & Notify Guard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEMPLATES MODAL */}
      {templateModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#fff' }}>
                Roster Template Library
              </h3>
              <button onClick={() => setTemplateModalOpen(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Apply pre-configured weekly roster patterns (e.g. "Ahmad's usual week") without manually re-entering repeating schedules.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {templates.map(tpl => (
                <div
                  key={tpl.id}
                  onClick={() => setSelectedTemplateId(tpl.id)}
                  style={{
                    background: selectedTemplateId === tpl.id ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-main)',
                    border: selectedTemplateId === tpl.id ? '1px solid var(--accent-green)' : '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '12px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>
                    {tpl.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {tpl.description}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Apply to Target Guard
              </label>
              <select
                className="filter-input"
                value={targetGuardId}
                onChange={(e) => setTargetGuardId(e.target.value)}
              >
                {guards.map(g => (
                  <option key={g.id} value={g.id}>{g.name} ({g.badgeNumber})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  padding: '10px',
                  borderRadius: '6px',
                  fontWeight: '600'
                }}
                onClick={() => setTemplateModalOpen(false)}
              >
                Close
              </button>
              <button
                className="btn-book-on"
                onClick={handleApplyTemplate}
                disabled={!selectedTemplateId}
                style={{ padding: '10px', borderRadius: '6px' }}
              >
                Apply to Roster
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
