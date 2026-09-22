import React from 'react';
import { Bell, CheckCircle2, AlertTriangle, Calendar, Clock, Info } from 'lucide-react';
import { useSecurity } from '../../context/SecurityContext';

export const NotificationInbox = ({ setActiveTab }) => {
  const { currentUser, notifications } = useSecurity();

  const myNotifications = notifications.filter(
    n => n.userId === currentUser.id
  );

  const getIcon = (type) => {
    switch (type) {
      case 'check_call_ok':
        return <CheckCircle2 size={16} color="var(--accent-green)" />;
      case 'check_call_prompt':
      case 'surprise_patrol':
        return <AlertTriangle size={16} color="var(--accent-amber)" />;
      case 'roster':
      case 'override':
        return <Calendar size={16} color="var(--accent-cyan)" />;
      case 'reminder':
        return <Clock size={16} color="var(--accent-blue)" />;
      default:
        return <Info size={16} color="var(--text-secondary)" />;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#fff' }}>Push Notifications</h2>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Inbox for {currentUser.name}
          </div>
        </div>
        <span
          style={{
            fontSize: '11px',
            background: 'var(--bg-elevated)',
            padding: '2px 8px',
            borderRadius: '10px',
            color: 'var(--accent-green)',
            fontWeight: '700'
          }}
        >
          {myNotifications.length} Alerts
        </span>
      </div>

      {myNotifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <Bell size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
          <div>No notifications yet.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {myNotifications.map((n) => (
            <div
              key={n.id}
              onClick={() => {
                if (n.actionTab) setActiveTab(n.actionTab);
              }}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                display: 'flex',
                gap: '10px',
                cursor: n.actionTab ? 'pointer' : 'default',
                transition: 'border-color 0.2s'
              }}
            >
              <div style={{ marginTop: '2px' }}>{getIcon(n.type)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#fff' }}>
                    {n.title}
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: '1.4' }}>
                  {n.message}
                </div>
                {n.actionTab && (
                  <div style={{ fontSize: '10px', color: 'var(--accent-cyan)', marginTop: '4px', fontWeight: '600' }}>
                    Tap to open &rarr;
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
