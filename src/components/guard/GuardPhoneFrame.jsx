import React, { useState, useEffect } from 'react';
import {
  Shield,
  Compass,
  Calendar,
  Bell,
  Wifi,
  Battery,
  Signal
} from 'lucide-react';
import { GuardDashboard } from './GuardDashboard';
import { PatrolView } from './PatrolView';
import { ScheduleCalendar } from './ScheduleCalendar';
import { NotificationInbox } from './NotificationInbox';
import { CheckCallModal } from './CheckCallModal';
import { useSecurity } from '../../context/SecurityContext';

export const GuardPhoneFrame = () => {
  const [activeTab, setActiveTab] = useState('shift');
  const [currentTime, setCurrentTime] = useState('');
  const { notifications, currentUser, pendingCheckCall } = useSecurity();

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter(
    n => n.userId === currentUser.id && !n.read
  ).length;

  return (
    <div className="phone-simulator-wrapper">
      <div className="phone-shell">
        {/* Dynamic Island Notch */}
        <div className="phone-island">
          <div className="island-camera"></div>
          <div className="island-sensor"></div>
        </div>

        {/* Status Bar */}
        <div className="phone-status-bar">
          <span className="mono" style={{ fontWeight: '700' }}>{currentTime || '18:42'}</span>
          <div className="phone-status-icons">
            <Signal size={12} />
            <Wifi size={12} />
            <Battery size={14} />
          </div>
        </div>

        {/* Main Phone Screen Content */}
        <div className="phone-screen">
          {activeTab === 'shift' && <GuardDashboard setActiveTab={setActiveTab} />}
          {activeTab === 'patrol' && <PatrolView />}
          {activeTab === 'calendar' && <ScheduleCalendar />}
          {activeTab === 'inbox' && <NotificationInbox setActiveTab={setActiveTab} />}
        </div>

        {/* Bottom App Navigation Bar */}
        <div className="phone-nav-bar">
          <button
            className={`phone-nav-item ${activeTab === 'shift' ? 'active' : ''}`}
            onClick={() => setActiveTab('shift')}
          >
            <Shield size={18} />
            <span>Shift</span>
          </button>

          <button
            className={`phone-nav-item ${activeTab === 'patrol' ? 'active' : ''}`}
            onClick={() => setActiveTab('patrol')}
          >
            <Compass size={18} />
            <span>Patrol</span>
          </button>

          <button
            className={`phone-nav-item ${activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => setActiveTab('calendar')}
          >
            <Calendar size={18} />
            <span>Roster</span>
          </button>

          <button
            className={`phone-nav-item ${activeTab === 'inbox' ? 'active' : ''}`}
            onClick={() => setActiveTab('inbox')}
            style={{ position: 'relative' }}
          >
            <Bell size={18} />
            <span>Alerts</span>
            {unreadCount > 0 && <span className="phone-badge">{unreadCount}</span>}
          </button>
        </div>

        {/* Bottom Home Indicator Bar */}
        <div className="phone-home-indicator"></div>

        {/* Embedded Check Call Modal when triggered */}
        <CheckCallModal />
      </div>
    </div>
  );
};
