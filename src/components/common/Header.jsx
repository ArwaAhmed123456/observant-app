import React from 'react';
import {
  Shield,
  Smartphone,
  LayoutDashboard,
  Columns2,
  Clock,
  Zap,
  Volume2,
  VolumeX,
  FastForward,
  Bell,
  AlertTriangle
} from 'lucide-react';
import { useSecurity } from '../../context/SecurityContext';

export const Header = ({ viewMode, setViewMode }) => {
  const {
    currentUser,
    setCurrentUser,
    users,
    soundEnabled,
    setSoundEnabled,
    triggerCheckCall,
    triggerSurprisePatrolPrompt,
    triggerShiftEndReminder,
    expireCheckCall,
    pendingCheckCall,
    activeShiftSession
  } = useSecurity();

  return (
    <header className="top-bar">
      <div className="brand-section">
        <div className="brand-badge">
          <Shield size={22} />
        </div>
        <div className="brand-text">
          <h1>
            OBSERVANT <span className="brand-tag">OPS v2.4</span>
          </h1>
          <p>Security Guard Shift & Patrol Intelligence</p>
        </div>
      </div>

      {/* View Mode Switcher */}
      <div className="view-mode-tabs">
        <button
          className={`view-mode-btn ${viewMode === 'guard' ? 'active' : ''}`}
          onClick={() => {
            setViewMode('guard');
            // If current user is manager, auto switch to Ahmad Khan for guard view
            if (currentUser.role === 'manager') {
              const guard = users.find(u => u.role === 'guard');
              if (guard) setCurrentUser(guard);
            }
          }}
          title="Guard Mobile Smartphone View"
        >
          <Smartphone size={15} />
          <span>Guard Mobile</span>
        </button>

        <button
          className={`view-mode-btn ${viewMode === 'manager' ? 'active' : ''}`}
          onClick={() => {
            setViewMode('manager');
            // Auto switch to manager Elena
            const mgr = users.find(u => u.role === 'manager');
            if (mgr) setCurrentUser(mgr);
          }}
          title="Manager Operations Portal"
        >
          <LayoutDashboard size={15} />
          <span>Manager Portal</span>
        </button>

        <button
          className={`view-mode-btn ${viewMode === 'split' ? 'active' : ''}`}
          onClick={() => setViewMode('split')}
          title="Simultaneous Side-by-Side Live Demo"
        >
          <Columns2 size={15} />
          <span>Split Screen</span>
        </button>
      </div>

      {/* Live Simulation Controls */}
      <div className="sim-toolbar">
        <span className="sim-label">
          <Clock size={12} /> Test Sim:
        </span>
        <button
          className="sim-btn"
          onClick={() => triggerCheckCall(false)}
          title="Trigger regular hourly check call prompt"
        >
          <Clock size={13} />
          <span>Hourly Call</span>
        </button>

        <button
          className="sim-btn warning"
          onClick={() => triggerCheckCall(true)}
          title="Trigger unpredictable random check call"
        >
          <Zap size={13} />
          <span>Random Call</span>
        </button>

        <button
          className="sim-btn danger"
          onClick={() => {
            if (pendingCheckCall) {
              expireCheckCall();
            } else {
              // Trigger call and immediately simulate 10m expiry
              triggerCheckCall(false);
              setTimeout(() => expireCheckCall(), 600);
            }
          }}
          title="Fast-forward 10 minutes to simulate missed check call alert to Manager"
        >
          <FastForward size={13} />
          <span>Expire 10m</span>
        </button>

        <button
          className="sim-btn"
          onClick={() => triggerSurprisePatrolPrompt()}
          title="Trigger anti-idle surprise patrol prompt between scheduled patrol gap"
        >
          <AlertTriangle size={13} />
          <span>Surprise Patrol</span>
        </button>

        <button
          className="sim-btn"
          onClick={() => triggerShiftEndReminder()}
          title="Simulate 10m shift-end reminder push notification"
        >
          <Bell size={13} />
          <span>End Reminder</span>
        </button>
      </div>

      {/* Right User & Sound Switchers */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          style={{
            color: soundEnabled ? 'var(--accent-green)' : 'var(--text-muted)',
            padding: '6px',
            borderRadius: '6px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)'
          }}
          title={soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
        >
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>

        <div className="user-switch-pill">
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            className="user-switch-avatar"
          />
          <select
            className="user-select"
            value={currentUser.id}
            onChange={(e) => {
              const selected = users.find(u => u.id === e.target.value);
              if (selected) setCurrentUser(selected);
            }}
          >
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role === 'manager' ? 'Manager' : 'Guard'})
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
};
