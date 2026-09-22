import React, { useState } from 'react';
import { SecurityProvider } from './context/SecurityContext';
import { Header } from './components/common/Header';
import { NotificationToast } from './components/common/NotificationToast';
import { GuardPhoneFrame } from './components/guard/GuardPhoneFrame';
import { ManagerDashboard } from './components/manager/ManagerDashboard';

function AppContent() {
  const [viewMode, setViewMode] = useState('split'); // 'guard', 'manager', 'split'

  return (
    <div className="app-root">
      <Header viewMode={viewMode} setViewMode={setViewMode} />
      
      <main className="main-viewport">
        <NotificationToast />

        {viewMode === 'guard' && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
            <GuardPhoneFrame />
          </div>
        )}

        {viewMode === 'manager' && (
          <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
            <ManagerDashboard />
          </div>
        )}

        {viewMode === 'split' && (
          <div className="split-screen-layout">
            <div>
              <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--accent-green)', letterSpacing: '0.5px' }}>
                  📱 Guard Mobile Simulator
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  (Interactive Touch Viewport)
                </span>
              </div>
              <GuardPhoneFrame />
            </div>

            <div>
              <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--accent-cyan)', letterSpacing: '0.5px' }}>
                  🖥️ Manager Command Center
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  (Live Multi-Site Supervisory Console)
                </span>
              </div>
              <ManagerDashboard />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <SecurityProvider>
      <AppContent />
    </SecurityProvider>
  );
}
