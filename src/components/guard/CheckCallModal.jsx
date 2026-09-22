import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, Clock, ShieldCheck, X } from 'lucide-react';
import { useSecurity } from '../../context/SecurityContext';

export const CheckCallModal = () => {
  const {
    pendingCheckCall,
    respondCheckCall,
    expireCheckCall
  } = useSecurity();

  const [timeLeftSec, setTimeLeftSec] = useState(600); // 10 minutes default
  const [showIssueNote, setShowIssueNote] = useState(false);
  const [issueNote, setIssueNote] = useState('');

  useEffect(() => {
    if (!pendingCheckCall) return;

    // Calculate remaining seconds from expiresAt
    const expiryMs = new Date(pendingCheckCall.expiresAt).getTime();
    const updateCountdown = () => {
      const diffSec = Math.max(0, Math.floor((expiryMs - Date.now()) / 1000));
      setTimeLeftSec(diffSec);

      if (diffSec <= 0) {
        expireCheckCall();
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [pendingCheckCall, expireCheckCall]);

  if (!pendingCheckCall) return null;

  const minutes = Math.floor(timeLeftSec / 60);
  const seconds = timeLeftSec % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const handleYes = () => {
    respondCheckCall('yes', 'All okay on site.');
    setShowIssueNote(false);
    setIssueNote('');
  };

  const handleReportIssue = () => {
    respondCheckCall('no', issueNote || 'Incident/issue reported on site');
    setShowIssueNote(false);
    setIssueNote('');
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog">
        <div className="checkcall-timer-ring">
          <span className="timer-digits">{formattedTime}</span>
          <span className="timer-caption">Remaining</span>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: '700',
              textTransform: 'uppercase',
              color: pendingCheckCall.callType === 'random' ? 'var(--accent-amber)' : 'var(--accent-green)',
              background: 'rgba(255,255,255,0.05)',
              padding: '3px 8px',
              borderRadius: '12px'
            }}
          >
            {pendingCheckCall.callType === 'random' ? '⚡ Surprise Unpredictable Check' : '⏰ Standard Hourly Check'}
          </span>
        </div>

        <h2 className="checkcall-question">Is everything okay on site?</h2>
        <p className="checkcall-subtext">
          Site: <strong>{pendingCheckCall.siteName}</strong> &bull; Guard: <strong>{pendingCheckCall.guardName}</strong>
          <br />
          Please verify your safety status. Failure to respond within 10 minutes escalates an alert to Operations.
        </p>

        {!showIssueNote ? (
          <div className="checkcall-btn-grid">
            <button className="btn-resp-yes" onClick={handleYes}>
              <CheckCircle size={28} />
              <span>YES, ALL OKAY</span>
            </button>

            <button className="btn-resp-no" onClick={() => setShowIssueNote(true)}>
              <AlertTriangle size={28} />
              <span>NO, ISSUE</span>
            </button>
          </div>
        ) : (
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: '700',
                color: 'var(--accent-red)',
                marginBottom: '6px',
                textTransform: 'uppercase'
              }}
            >
              ⚠️ Describe the Incident / Issue (Optional)
            </label>
            <textarea
              className="issue-note-input"
              placeholder="e.g. Broken security gate lock, unauthorized person near perimeter, water leak..."
              value={issueNote}
              onChange={(e) => setIssueNote(e.target.value)}
              autoFocus
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  padding: '12px',
                  borderRadius: '8px',
                  fontWeight: '600'
                }}
                onClick={() => setShowIssueNote(false)}
              >
                Back
              </button>

              <button
                className="btn-book-off"
                onClick={handleReportIssue}
                style={{ borderRadius: '8px', padding: '12px' }}
              >
                Transmit Alert
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '10px', color: 'var(--text-muted)' }}>
          Observant Guard Safety Protocol &bull; Automatic SLA escalation enabled
        </div>
      </div>
    </div>
  );
};
