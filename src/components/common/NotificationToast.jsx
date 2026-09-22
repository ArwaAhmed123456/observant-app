import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, X, ShieldAlert } from 'lucide-react';
import { useSecurity } from '../../context/SecurityContext';

export const NotificationToast = () => {
  const { guardToast, setGuardToast, managerAlert, setManagerAlert } = useSecurity();

  // Auto dismiss guard toast after 5s
  useEffect(() => {
    if (guardToast) {
      const timer = setTimeout(() => {
        setGuardToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [guardToast, setGuardToast]);

  return (
    <>
      {/* High Priority Manager Emergency Banner */}
      {managerAlert && (
        <div className="emergency-banner">
          <div className="banner-content">
            <div style={{ color: 'var(--accent-red)' }}>
              <ShieldAlert size={28} />
            </div>
            <div>
              <div className="banner-title">{managerAlert.title}</div>
              <div className="banner-msg">{managerAlert.message}</div>
              <div style={{ fontSize: '10px', color: '#cbd5e1', marginTop: '3px' }}>
                Site: <strong>{managerAlert.siteName}</strong> &bull; Guard: <strong>{managerAlert.guardName}</strong> &bull; {new Date(managerAlert.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
          <button
            onClick={() => setManagerAlert(null)}
            style={{
              background: 'rgba(0,0,0,0.3)',
              color: '#fff',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '700',
              border: '1px solid rgba(255,255,255,0.2)'
            }}
          >
            Acknowledge
          </button>
        </div>
      )}

      {/* Floating Guard Toast */}
      {guardToast && (
        <div className="floating-toast">
          {guardToast.type === 'success' && <CheckCircle2 size={20} color="var(--accent-green)" />}
          {guardToast.type === 'warning' && <AlertCircle size={20} color="var(--accent-amber)" />}
          {guardToast.type === 'info' && <Info size={20} color="var(--accent-cyan)" />}
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#fff' }}>
              {guardToast.title}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {guardToast.message}
            </div>
          </div>
          <button
            onClick={() => setGuardToast(null)}
            style={{ color: 'var(--text-muted)', marginLeft: '8px' }}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
};
