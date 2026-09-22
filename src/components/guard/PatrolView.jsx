import React, { useState } from 'react';
import {
  Compass,
  Camera,
  CheckCircle,
  AlertTriangle,
  Play,
  Check,
  X,
  MapPin,
  RefreshCw,
  BellRing
} from 'lucide-react';
import { useSecurity } from '../../context/SecurityContext';

// High-fidelity checkpoint inspection mock photos
const CHECKPOINT_SAMPLE_PHOTOS = [
  'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1508873696983-2df5703bc20d?w=600&auto=format&fit=crop&q=80'
];

export const PatrolView = () => {
  const {
    currentUser,
    sites,
    activeShiftSession,
    activePatrolSession,
    startPatrol,
    captureCheckpointPhoto,
    finishPatrol,
    pendingSurprisePatrol,
    expectedPatrolSlots
  } = useSecurity();

  const assignedSite = sites.find(s => s.id === (activeShiftSession?.siteId || currentUser.assignedSiteId)) || sites[0];
  const checkpoints = assignedSite?.requiredCheckpoints || [];

  // Active camera modal state
  const [activeCameraCp, setActiveCameraCp] = useState(null);
  const [cameraFlash, setCameraFlash] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  // Incomplete finish warning modal
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [missingCount, setMissingCount] = useState(0);

  const completedCount = activePatrolSession?.checkpointsCompleted || 0;
  const totalCount = checkpoints.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleStartPatrol = () => {
    startPatrol(assignedSite.id);
  };

  const handleOpenCamera = (cp) => {
    setActiveCameraCp(cp);
    // pick a random sample photo for variety
    setSelectedPhotoIndex(Math.floor(Math.random() * CHECKPOINT_SAMPLE_PHOTOS.length));
  };

  const handleSnapPhoto = () => {
    setCameraFlash(true);
    setTimeout(() => {
      setCameraFlash(false);
      const photoUrl = CHECKPOINT_SAMPLE_PHOTOS[selectedPhotoIndex];
      captureCheckpointPhoto(activeCameraCp.id, photoUrl);
      setActiveCameraCp(null);
    }, 200);
  };

  const handleFinishAttempt = () => {
    const result = finishPatrol(false);
    if (!result.success) {
      setMissingCount(result.missingCount);
      setWarningModalOpen(true);
    }
  };

  const handleConfirmFinishIncomplete = () => {
    finishPatrol(true);
    setWarningModalOpen(false);
  };

  const nextPatrolSlot = expectedPatrolSlots[assignedSite?.id];
  const formattedNextSlot = nextPatrolSlot
    ? new Date(nextPatrolSlot).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Top of Hour';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#fff' }}>Site Patrol Module</h2>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {assignedSite?.name}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>NEXT PATROL DUE</span>
          <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
            ~{formattedNextSlot}
          </div>
        </div>
      </div>

      {/* Surprise Anti-Idle Prompt Alert */}
      {pendingSurprisePatrol && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(20, 26, 40, 0.95) 100%)',
            border: '1px solid var(--accent-amber)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            marginBottom: '14px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <BellRing size={16} color="var(--accent-amber)" />
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#fff' }}>
              ⚡ Surprise Anti-Idle Alert Triggered!
            </span>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
            Random prompt delivered at the 30+ minute idle mark. Starting and completing this patrol satisfies this hour's quota and shifts your next patrol 1 hour forward!
          </p>
          {!activePatrolSession && (
            <button
              className="action-btn-primary btn-start-patrol"
              onClick={handleStartPatrol}
            >
              <Play size={16} />
              <span>COMMENCE SURPRISE PATROL</span>
            </button>
          )}
        </div>
      )}

      {/* If No Active Patrol */}
      {!activePatrolSession ? (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px 16px',
            textAlign: 'center',
            marginBottom: '14px'
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(6, 182, 212, 0.1)',
              color: 'var(--accent-cyan)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px'
            }}
          >
            <Compass size={28} />
          </div>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginBottom: '6px' }}>
            Ready to Begin Perimeter Patrol
          </h3>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '18px', maxWidth: '300px', margin: '0 auto 18px' }}>
            Verify site integrity. You must photograph all {checkpoints.length} required checkpoints during your patrol route.
          </p>

          <button
            className="action-btn-primary btn-start-patrol"
            onClick={handleStartPatrol}
          >
            <Play size={16} />
            <span>START PATROLLING</span>
          </button>
        </div>
      ) : (
        /* Active Patrol In Progress */
        <div>
          {/* Progress Banner */}
          <div className="patrol-progress-banner">
            <div className="progress-header">
              <span style={{ color: 'var(--accent-cyan)' }}>
                Patrol In Progress ({completedCount} of {totalCount} checkpoints photographed)
              </span>
              <span className="mono" style={{ fontWeight: '800', color: '#fff' }}>
                {progressPercent}%
              </span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
            </div>
          </div>

          {/* Checkpoint Cards List */}
          <div className="checkpoint-list">
            {checkpoints.map((cp, index) => {
              const capture = activePatrolSession.captures.find(c => c.checkpointId === cp.id);
              const isDone = !!capture;

              return (
                <div
                  key={cp.id}
                  className={`checkpoint-card ${isDone ? 'completed' : ''}`}
                >
                  <div className="cp-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        #{index + 1}
                      </span>
                      <div className="cp-name">{cp.name}</div>
                    </div>
                    <div className="cp-desc">{cp.description}</div>
                    {isDone && (
                      <div style={{ fontSize: '10px', color: 'var(--accent-green)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Check size={12} />
                        <span>Verified at {new Date(capture.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    )}
                  </div>

                  {isDone ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <img
                        src={capture.photoUrl}
                        alt={cp.name}
                        className="cp-thumb-preview"
                        onClick={() => handleOpenCamera(cp)}
                        title="Click to retake"
                      />
                      <button
                        onClick={() => handleOpenCamera(cp)}
                        style={{ color: 'var(--text-muted)', padding: '4px' }}
                        title="Retake photo"
                      >
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn-snap-photo"
                      onClick={() => handleOpenCamera(cp)}
                    >
                      <Camera size={14} />
                      <span>Take Photo</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Finish Patrol Button */}
          <button
            className="action-btn-primary btn-book-off"
            onClick={handleFinishAttempt}
            style={{ marginBottom: '14px' }}
          >
            <CheckCircle size={18} />
            <span>FINISH PATROLLING</span>
          </button>
        </div>
      )}

      {/* CAMERA VIEWFINDER MODAL */}
      {activeCameraCp && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--accent-cyan)', textTransform: 'uppercase', fontWeight: '700' }}>
                  Camera Verification
                </span>
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#fff' }}>
                  {activeCameraCp.name}
                </h3>
              </div>
              <button onClick={() => setActiveCameraCp(null)} style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            {/* Viewfinder Frame */}
            <div className="camera-viewfinder" style={{ opacity: cameraFlash ? 0.3 : 1, transition: 'opacity 0.1s' }}>
              <img
                src={CHECKPOINT_SAMPLE_PHOTOS[selectedPhotoIndex]}
                alt="Checkpoint Viewfinder"
                className="camera-preview-img"
              />
              <div className="hud-bracket hud-tl"></div>
              <div className="hud-bracket hud-tr"></div>
              <div className="hud-bracket hud-bl"></div>
              <div className="hud-bracket hud-br"></div>

              {/* Watermark Overlay */}
              <div className="hud-watermark">
                <div>SITE: {assignedSite?.name}</div>
                <div>CHECKPOINT: {activeCameraCp.name}</div>
                <div>GPS: 51.5147° N, 0.0815° W &bull; GUARD: {currentUser.badgeNumber}</div>
                <div>TIME: {new Date().toLocaleTimeString()} &bull; WATERMARK AUTHENTICATED</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '16px' }}>
              <button
                className="btn-snap-photo"
                style={{ padding: '12px 24px', fontSize: '13px', background: 'var(--accent-cyan)', color: '#011c24' }}
                onClick={handleSnapPhoto}
              >
                <Camera size={18} />
                <span>SNAP & VERIFY PHOTO</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MISSING CHECKPOINTS CONFIRMATION MODAL */}
      {warningModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ border: '1px solid var(--accent-amber)' }}>
            <div style={{ textAlign: 'center', marginBottom: '14px' }}>
              <AlertTriangle size={42} color="var(--accent-amber)" />
            </div>
            <h3 style={{ textAlign: 'center', fontSize: '16px', fontWeight: '800', color: '#fff', marginBottom: '8px' }}>
              Incomplete Patrol Warning
            </h3>
            <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '18px' }}>
              You have <strong>{missingCount} unphotographed checkpoints</strong> remaining.
              Finishing now will submit this patrol with an incomplete penalty flag to the Operations Manager.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  padding: '12px',
                  borderRadius: '8px',
                  fontWeight: '600'
                }}
                onClick={() => setWarningModalOpen(false)}
              >
                Continue Patrol
              </button>
              <button
                className="btn-book-off"
                onClick={handleConfirmFinishIncomplete}
                style={{ borderRadius: '8px', padding: '12px' }}
              >
                Finish Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
