import React, { useState, useEffect } from 'react';
import {
  Shield,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Square,
  Compass,
  ArrowRight,
  BellRing
} from 'lucide-react';
import { useSecurity } from '../../context/SecurityContext';
import { getCurrentWeekDates } from '../../data/mockData';

export const GuardDashboard = ({ setActiveTab }) => {
  const {
    currentUser,
    sites,
    rosters,
    activeShiftSession,
    activePatrolSession,
    bookOn,
    bookOff,
    pendingCheckCall,
    pendingSurprisePatrol,
    expectedPatrolSlots,
    checkCalls
  } = useSecurity();

  const assignedSite = sites.find(s => s.id === currentUser.assignedSiteId) || sites[0];

  // Today's scheduled shift from roster
  const today = getCurrentWeekDates().find(d => d.isToday)?.dayName || 'Mon';
  const currentRoster = rosters[0];
  const todayShift = currentRoster?.shifts?.find(
    s => s.guardId === currentUser.id && s.dayName === today
  );

  // Live session elapsed timer
  const [elapsedString, setElapsedString] = useState('0h 00m');

  useEffect(() => {
    if (!activeShiftSession) return;
    const startMs = new Date(activeShiftSession.bookedOnAt).getTime();

    const updateTimer = () => {
      const diffMs = Math.max(0, Date.now() - startMs);
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      setElapsedString(`${hours}h ${String(minutes).padStart(2, '0')}m`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 30000); // every 30s
    return () => clearInterval(interval);
  }, [activeShiftSession]);

  // Last check call
  const lastCheckCall = checkCalls.find(
    c => c.guardId === currentUser.id
  );

  const nextPatrolExpected = expectedPatrolSlots[assignedSite?.id]
    ? new Date(expectedPatrolSlots[assignedSite?.id]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Top of Hour';

  return (
    <div>
      {/* Guard Header Card */}
      <div className="guard-header-card">
        <div className="guard-profile-info">
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            className="guard-avatar-lg"
          />
          <div>
            <div className="guard-name">{currentUser.name}</div>
            <div className="guard-site-badge">
              <MapPin size={11} color="var(--accent-green)" />
              <span>{assignedSite?.name}</span>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>BADGE ID</div>
          <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>
            {currentUser.badgeNumber}
          </div>
        </div>
      </div>

      {/* Surprise Patrol Banner if active */}
      {pendingSurprisePatrol && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(20, 26, 40, 0.95) 100%)',
            border: '1px solid var(--accent-amber)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '800', color: '#fff' }}>
              <BellRing size={14} color="var(--accent-amber)" />
              <span>Anti-Idle Surprise Patrol Alert!</span>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--accent-amber)', marginTop: '2px' }}>
              Early patrol triggered. Complete now to shift next patrol 1 hr forward.
            </div>
          </div>
          <button
            onClick={() => setActiveTab('patrol')}
            style={{
              background: 'var(--accent-amber)',
              color: '#241402',
              fontWeight: '700',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '11px'
            }}
          >
            Start Now
          </button>
        </div>
      )}

      {/* Check Call Mini Prompt if active */}
      {pendingCheckCall && (
        <div className="checkcall-mini-banner">
          <div className="checkcall-mini-info">
            <Clock size={18} color="var(--accent-amber)" />
            <div>
              <div className="checkcall-mini-title">Check Call Awaiting Response</div>
              <div className="checkcall-mini-sub">10-min countdown running</div>
            </div>
          </div>
          <button
            className="btn-answer-now"
            onClick={() => {
              // modal will be opened by CheckCallModal
            }}
          >
            Respond Now
          </button>
        </div>
      )}

      {/* Shift Session Card */}
      <div className={`shift-status-card ${activeShiftSession ? 'booked-on' : 'off-duty'}`}>
        <div className="status-header-row">
          {activeShiftSession ? (
            <div className="live-pulse-badge">
              <span className="pulse-dot"></span>
              <span>Active Shift Session</span>
            </div>
          ) : (
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Off Duty
            </span>
          )}

          {activeShiftSession && (
            <span className={`punctuality-pill ${activeShiftSession.punctualityStatus.toLowerCase().replace(' ', '-')}`}>
              {activeShiftSession.punctualityStatus}
              {activeShiftSession.punctualityMinutes > 0 && ` (${activeShiftSession.punctualityMinutes}m)`}
            </span>
          )}
        </div>

        <div className="shift-time-block">
          <div className="shift-time-label">
            {activeShiftSession ? 'SESSION DURATION' : "TODAY'S SCHEDULED SHIFT"}
          </div>
          <div className="shift-time-val mono">
            {activeShiftSession
              ? elapsedString
              : todayShift && todayShift.status !== 'off'
              ? `${todayShift.startTime} – ${todayShift.endTime}`
              : 'No Shift Scheduled Today'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {activeShiftSession
              ? `Started at ${new Date(activeShiftSession.bookedOnAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • GPS Locked`
              : todayShift?.isOverridden
              ? `Override: ${todayShift.overrideReason}`
              : 'Advance weekly roster assigned'}
          </div>
        </div>

        {/* Big Action Button */}
        {!activeShiftSession ? (
          <button
            className="action-btn-primary btn-book-on"
            onClick={() => bookOn()}
          >
            <Play size={18} />
            <span>BOOK ON (START SHIFT)</span>
          </button>
        ) : (
          <button
            className="action-btn-primary btn-book-off"
            onClick={() => {
              if (window.confirm('Are you sure you want to Book Off and end your active shift session?')) {
                bookOff();
              }
            }}
          >
            <Square size={18} />
            <span>BOOK OFF (END SHIFT)</span>
          </button>
        )}
      </div>

      {/* Quick Patrol & Check Call Status Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
        {/* Patrol Quick Card */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            cursor: 'pointer'
          }}
          onClick={() => setActiveTab('patrol')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <Compass size={18} color="var(--accent-cyan)" />
            <ArrowRight size={14} color="var(--text-muted)" />
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PATROL SYSTEM</div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>
            {activePatrolSession ? 'Patrol Active...' : 'Next Patrol'}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--accent-cyan)', marginTop: '2px' }}>
            {activePatrolSession ? `${activePatrolSession.checkpointsCompleted}/${activePatrolSession.checkpointsTotal} photos` : `Due: ~${nextPatrolExpected}`}
          </div>
        </div>

        {/* Check Call Quick Card */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '12px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <Shield size={18} color="var(--accent-green)" />
            <span style={{ fontSize: '9px', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-green)', padding: '2px 5px', borderRadius: '4px', fontWeight: '700' }}>
              HOURLY
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>LAST CHECK CALL</div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>
            {lastCheckCall ? (lastCheckCall.response === 'yes' ? 'Verified OK' : lastCheckCall.response === 'no' ? 'Issue Flagged' : 'Missed') : 'None'}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {lastCheckCall ? new Date(lastCheckCall.promptTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ready'}
          </div>
        </div>
      </div>

      {/* Site Checkpoint Summary Preview */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '12px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            REQUIRED PATROL CHECKPOINTS ({assignedSite?.requiredCheckpoints?.length || 0})
          </span>
          <button
            onClick={() => setActiveTab('patrol')}
            style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: '600' }}
          >
            View Checklist &rarr;
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {assignedSite?.requiredCheckpoints?.slice(0, 3).map((cp, idx) => (
            <div
              key={cp.id}
              style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent-cyan)' }}></div>
              <span>{cp.name}</span>
            </div>
          ))}
          {(assignedSite?.requiredCheckpoints?.length || 0) > 3 && (
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', paddingLeft: '10px' }}>
              + {(assignedSite?.requiredCheckpoints?.length || 0) - 3} more checkpoints...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
