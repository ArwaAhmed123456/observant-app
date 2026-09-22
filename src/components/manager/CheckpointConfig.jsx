import React, { useState } from 'react';
import { Camera, Plus, Trash2, CheckCircle2, MapPin, Save } from 'lucide-react';
import { useSecurity } from '../../context/SecurityContext';

export const CheckpointConfig = () => {
  const { sites, updateSiteCheckpoints } = useSecurity();
  const [selectedSiteId, setSelectedSiteId] = useState(sites[0]?.id || 'site-1');
  const selectedSite = sites.find(s => s.id === selectedSiteId) || sites[0];

  const [checkpoints, setCheckpoints] = useState(selectedSite.requiredCheckpoints || []);
  const [newCpName, setNewCpName] = useState('');
  const [newCpDesc, setNewCpDesc] = useState('');

  // Sync when selected site changes
  const handleSiteChange = (id) => {
    setSelectedSiteId(id);
    const siteObj = sites.find(s => s.id === id);
    if (siteObj) setCheckpoints(siteObj.requiredCheckpoints || []);
  };

  const handleAddCheckpoint = (e) => {
    e.preventDefault();
    if (!newCpName.trim()) return;

    const newCp = {
      id: `cp-${selectedSiteId}-${Date.now()}`,
      name: newCpName.trim(),
      description: newCpDesc.trim() || 'Physical inspection and security photo verification',
      requiredPhoto: true
    };

    const updated = [...checkpoints, newCp];
    setCheckpoints(updated);
    updateSiteCheckpoints(selectedSiteId, updated);
    setNewCpName('');
    setNewCpDesc('');
  };

  const handleRemoveCheckpoint = (id) => {
    const updated = checkpoints.filter(c => c.id !== id);
    setCheckpoints(updated);
    updateSiteCheckpoints(selectedSiteId, updated);
  };

  return (
    <div className="roster-card">
      <div className="roster-header-actions">
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#fff' }}>
            Site Patrol Checkpoint & Photo Configuration
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Configure mandatory photo checkpoints per site. Guards must photograph these checkpoints during patrols.
          </p>
        </div>

        {/* Site Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MapPin size={16} color="var(--accent-cyan)" />
          <select
            className="filter-input"
            value={selectedSiteId}
            onChange={(e) => handleSiteChange(e.target.value)}
            style={{ width: '240px' }}
          >
            {sites.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Checkpoints List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
        {checkpoints.map((cp, idx) => (
          <div
            key={cp.id}
            style={{
              background: 'var(--bg-main)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                #{idx + 1}
              </span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{cp.name}</span>
                  <span style={{ fontSize: '10px', background: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-cyan)', padding: '2px 6px', borderRadius: '4px' }}>
                    Photo Mandatory
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {cp.description}
                </div>
              </div>
            </div>

            <button
              onClick={() => handleRemoveCheckpoint(cp.id)}
              style={{ color: 'var(--accent-red)', padding: '6px' }}
              title="Remove Checkpoint"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Add New Checkpoint Form */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px dashed var(--border-subtle)',
          borderRadius: '8px',
          padding: '16px'
        }}
      >
        <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#fff', marginBottom: '10px' }}>
          Add New Checkpoint for {selectedSite.name}
        </h4>
        <form onSubmit={handleAddCheckpoint} style={{ display: 'grid', gridTemplateColumns: '2fr 3fr auto', gap: '10px' }}>
          <input
            type="text"
            className="filter-input"
            placeholder="Checkpoint Name (e.g. East Perimeter Gate)"
            value={newCpName}
            onChange={(e) => setNewCpName(e.target.value)}
          />
          <input
            type="text"
            className="filter-input"
            placeholder="Instructions / What to inspect (e.g. Check lock seals and barrier arm)"
            value={newCpDesc}
            onChange={(e) => setNewCpDesc(e.target.value)}
          />
          <button
            type="submit"
            className="btn-book-on"
            style={{ padding: '8px 16px', borderRadius: '6px', whiteSpace: 'nowrap' }}
          >
            <Plus size={14} />
            <span>Add Point</span>
          </button>
        </form>
      </div>
    </div>
  );
};
