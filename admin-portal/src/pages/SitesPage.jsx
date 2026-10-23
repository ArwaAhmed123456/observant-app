import React, { useEffect, useMemo, useState } from 'react';

const API = (import.meta.env.VITE_API_URL || 'https://observant-api-zl49.onrender.com').replace(/\/$/, '');

function Icon({ name, size = 16 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const shapes = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    trash: <><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></>,
    building: <><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="22.01"/><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    close: <><path d="m18 6-12 12M6 6l12 12"/></>,
    check: <polyline points="20 6 9 17 4 12"/>,
    alert: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  };
  return <svg {...common}>{shapes[name] || shapes.building}</svg>;
}

export default function SitesPage({ session }) {
  const [sites, setSites] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSite, setEditingSite] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    postcode: '',
    managerId: '',
    what3words: '',
    latitude: '',
    longitude: '',
    geofenceRadiusMetres: '200',
    notes: '',
  });

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [sitesRes, usersRes] = await Promise.all([
        fetch(`${API}/api/sites`, {
          headers: { Authorization: `Bearer ${session.accessToken}`, Accept: 'application/json' },
        }),
        fetch(`${API}/api/users?role=manager`, {
          headers: { Authorization: `Bearer ${session.accessToken}`, Accept: 'application/json' },
        }),
      ]);

      const sitesData = await sitesRes.json();
      const usersData = await usersRes.json();

      if (!sitesRes.ok) throw new Error(sitesData.error || 'Failed to fetch sites');
      setSites(sitesData.sites || []);
      setManagers(usersData.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.accessToken) fetchData();
  }, [session?.accessToken]);

  const openCreateModal = () => {
    setEditingSite(null);
    setFormData({
      name: '',
      address: '',
      postcode: '',
      managerId: managers[0]?._id || managers[0]?.id || '',
      what3words: '',
      latitude: '51.5074',
      longitude: '-0.1278',
      geofenceRadiusMetres: '200',
      notes: '',
    });
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (site) => {
    setEditingSite(site);
    setFormData({
      name: site.name || '',
      address: site.address || '',
      postcode: site.postcode || '',
      managerId: site.managerId?._id || site.managerId || '',
      what3words: site.what3words || '',
      latitude: site.latitude != null ? String(site.latitude) : '',
      longitude: site.longitude != null ? String(site.longitude) : '',
      geofenceRadiusMetres: String(site.geofenceRadiusMetres || 200),
      notes: site.notes || '',
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSaveSite = async (e) => {
    e.preventDefault();
    setFormBusy(true);
    setFormError('');

    try {
      let cleanW3w = (formData.what3words || '').trim();
      if (cleanW3w && !cleanW3w.startsWith('///')) {
        cleanW3w = `///${cleanW3w.replace(/^\/+/, '')}`;
      }

      const payload = {
        name: formData.name.trim(),
        address: formData.address.trim() || undefined,
        postcode: formData.postcode.trim() || undefined,
        managerId: formData.managerId || undefined,
        what3words: cleanW3w || undefined,
        latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
        longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
        geofenceRadiusMetres: parseInt(formData.geofenceRadiusMetres, 10) || 200,
        notes: formData.notes.trim() || undefined,
      };

      if (!editingSite) {
        const res = await fetch(`${API}/api/sites`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.accessToken}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create site');
        setSuccessMsg(`Site "${payload.name}" successfully created.`);
      } else {
        const res = await fetch(`${API}/api/sites/${editingSite._id || editingSite.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.accessToken}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update site');
        setSuccessMsg(`Site "${payload.name}" successfully updated.`);
      }

      setShowModal(false);
      fetchData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormBusy(false);
    }
  };

  const handleDeleteSite = async () => {
    if (!deleteCandidate) return;
    setFormBusy(true);
    try {
      const res = await fetch(`${API}/api/sites/${deleteCandidate._id || deleteCandidate.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete site');
      }
      setSites(prev => prev.filter(s => s._id !== deleteCandidate._id && s.id !== deleteCandidate.id));
      setDeleteCandidate(null);
      setSuccessMsg('Site removed successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setFormBusy(false);
    }
  };

  const filteredSites = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sites.filter(s => !q || [s.name, s.address, s.postcode, s.notes].some(f => String(f || '').toLowerCase().includes(q)));
  }, [sites, search]);

  return (
    <div className="sites-page space-y-6">
      {/* Header */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="eyebrow">LOCATIONS & GEOFENCES</p>
          <h1 className="mt-1 text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">Sites & Geofencing</h1>
          <p className="mt-1 text-sm text-slate-500">Manage client premises, assigned managers, GPS coordinates, and geofence perimeters.</p>
        </div>
        <button className="primary-button" onClick={openCreateModal}>
          <Icon name="plus" size={16} /> Add New Site
        </button>
      </section>

      {/* Messages */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
          <Icon name="check" size={16} /> {successMsg}
        </div>
      )}
      {error && (
        <div className="error-banner flex items-center justify-between">
          <span>{error}</span>
          <button className="text-xs underline" onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      {/* Search Bar */}
      <section className="panel rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="search-wrap">
          <Icon name="search" size={16} />
          <input
            type="text"
            placeholder="Search sites by name, address, or postal code…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </section>

      {/* Sites Grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-900">Active Operational Sites ({filteredSites.length})</h2>
          {loading && <span className="loading-label"><span className="spinner" /> Loading</span>}
        </div>

        {filteredSites.length === 0 && !loading ? (
          <div className="empty-table p-10 text-center rounded-2xl border border-slate-200 bg-white">
            <div className="empty-mark mx-auto"><Icon name="building" size={24} /></div>
            <h3 className="mt-3 text-sm font-bold text-slate-800">No sites found</h3>
            <p className="mt-1 text-xs text-slate-500">Get started by setting up your first operational site.</p>
            <button className="primary-button mt-4" onClick={openCreateModal}>
              <Icon name="plus" size={16} /> Add Site
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSites.map(site => {
              const manager = managers.find(m => (m._id || m.id) === (site.managerId?._id || site.managerId));
              return (
                <div key={site._id || site.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-100">
                        <Icon name="building" size={20} />
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          className="icon-button h-8 w-8 text-slate-500 hover:text-blue-600"
                          onClick={() => openEditModal(site)}
                          title="Edit Site"
                        >
                          <Icon name="edit" size={14} />
                        </button>
                        <button
                          className="icon-button h-8 w-8 text-slate-400 hover:text-red-600"
                          onClick={() => setDeleteCandidate(site)}
                          title="Delete Site"
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </div>

                    <h3 className="mt-3 text-base font-extrabold text-slate-900">{site.name}</h3>
                    <p className="mt-1 text-xs text-slate-500 flex items-center gap-1.5">
                      <Icon name="pin" size={13} /> {site.address || 'Address not specified'}
                      {site.postcode && <span className="font-semibold text-slate-700">· {site.postcode}</span>}
                    </p>

                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span className="text-slate-400">Assigned Manager:</span>
                        <span className="font-semibold text-slate-800">{manager?.name || 'Operations Lead'}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span className="text-slate-400">Geofence Radius:</span>
                        <span className="font-semibold text-slate-800">{site.geofenceRadiusMetres || 200} metres</span>
                      </div>
                      {(site.latitude != null && site.longitude != null) && (
                        <div className="flex justify-between text-slate-600 font-mono text-[11px]">
                          <span className="text-slate-400 font-sans">GPS:</span>
                          <span className="text-blue-600 font-semibold">{Number(site.latitude).toFixed(4)}, {Number(site.longitude).toFixed(4)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {site.notes && (
                    <div className="mt-3 rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-600 italic">
                      "{site.notes}"
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* CREATE / EDIT SITE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingSite ? 'Edit Site Details' : 'Add New Operational Site'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Configure client site location, manager oversight, and geofence radius.</p>
              </div>
              <button
                type="button"
                className="icon-button h-8 w-8"
                onClick={() => setShowModal(false)}
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            {formError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveSite} className="mt-4 space-y-3.5">
              <div>
                <label className="field-label">Site Name *</label>
                <input
                  type="text"
                  required
                  className="form-input mt-1"
                  placeholder="e.g. Canary Wharf Tower C"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="field-label">Street Address</label>
                  <input
                    type="text"
                    className="form-input mt-1"
                    placeholder="25 Bank Street"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Postcode / ZIP</label>
                  <input
                    type="text"
                    className="form-input mt-1"
                    placeholder="E14 5JP"
                    value={formData.postcode}
                    onChange={e => setFormData({ ...formData, postcode: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="field-label">Assigned Operations Manager</label>
                  <select
                    className="form-input mt-1"
                    value={formData.managerId}
                    onChange={e => setFormData({ ...formData, managerId: e.target.value })}
                  >
                    <option value="">Default Manager</option>
                    {managers.map(m => (
                      <option key={m._id || m.id} value={m._id || m.id}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">Geofence Radius (metres)</label>
                  <input
                    type="number"
                    min="50"
                    max="5000"
                    className="form-input mt-1"
                    value={formData.geofenceRadiusMetres}
                    onChange={e => setFormData({ ...formData, geofenceRadiusMetres: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="field-label">What3Words Location (///word.word.word)</label>
                <input
                  type="text"
                  className="form-input mt-1 font-mono text-xs"
                  placeholder="e.g. ///filled.count.soap"
                  value={formData.what3words}
                  onChange={e => setFormData({ ...formData, what3words: e.target.value })}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="field-label">Latitude GPS</label>
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                      onClick={() => {
                        if (typeof navigator !== 'undefined' && navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(
                            pos => {
                              setFormData(prev => ({
                                ...prev,
                                latitude: pos.coords.latitude.toFixed(6),
                                longitude: pos.coords.longitude.toFixed(6),
                              }));
                            },
                            () => alert('Could not get browser GPS coordinates. Please enter manually.')
                          );
                        }
                      }}
                    >
                      📍 Use GPS
                    </button>
                  </div>
                  <input
                    type="text"
                    className="form-input mt-1 font-mono text-xs"
                    placeholder="e.g. 51.5033"
                    value={formData.latitude}
                    onChange={e => setFormData({ ...formData, latitude: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Longitude GPS</label>
                  <input
                    type="text"
                    className="form-input mt-1 font-mono text-xs"
                    placeholder="e.g. -0.1195"
                    value={formData.longitude}
                    onChange={e => setFormData({ ...formData, longitude: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="field-label">Site Notes & Operational Instructions</label>
                <textarea
                  className="form-input mt-1 h-20 py-2"
                  placeholder="Gate access code, emergency procedures, main reception instructions…"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowModal(false)}
                  disabled={formBusy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={formBusy}
                >
                  {formBusy ? 'Saving…' : editingSite ? 'Update Site' : 'Create Site'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <Icon name="alert" size={24} />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">Delete Site?</h3>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Are you sure you want to delete <b>{deleteCandidate.name}</b>? Any assigned patrols or check calls will be archived.
            </p>
            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDeleteCandidate(null)}
                disabled={formBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button bg-red-600 hover:bg-red-700"
                onClick={handleDeleteSite}
                disabled={formBusy}
              >
                {formBusy ? 'Deleting…' : 'Delete Site'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
