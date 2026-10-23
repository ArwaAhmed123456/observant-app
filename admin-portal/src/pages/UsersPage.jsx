import React, { useEffect, useMemo, useState } from 'react';

const API = (import.meta.env.VITE_API_URL || 'https://observant-api-zl49.onrender.com').replace(/\/$/, '');

function Icon({ name, size = 16 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const shapes = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    trash: <><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    close: <><path d="m18 6-12 12M6 6l12 12"/></>,
    lock: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
    check: <polyline points="20 6 9 17 4 12"/>,
    alert: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>,
    eyeOff: <><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></>,
  };
  return <svg {...common}>{shapes[name] || shapes.users}</svg>;
}

export default function UsersPage({ session, onNavigate }) {
  const [users, setUsers] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search & Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'guard',
    siteId: '',
    badgeNumber: '',
    phone: '',
    active: true,
  });

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [usersRes, sitesRes] = await Promise.all([
        fetch(`${API}/api/users?active=all`, {
          headers: { Authorization: `Bearer ${session.accessToken}`, Accept: 'application/json' },
        }),
        fetch(`${API}/api/sites`, {
          headers: { Authorization: `Bearer ${session.accessToken}`, Accept: 'application/json' },
        }),
      ]);

      const usersData = await usersRes.json();
      const sitesData = await sitesRes.json();

      if (!usersRes.ok) throw new Error(usersData.error || 'Failed to load users');
      if (!sitesRes.ok) throw new Error(sitesData.error || 'Failed to load sites');

      setUsers(usersData.users || []);
      setSites(sitesData.sites || []);
    } catch (err) {
      setError(err.message || 'Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.accessToken) {
      fetchData();
    }
  }, [session?.accessToken]);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'guard',
      siteId: sites[0]?._id || sites[0]?.id || '',
      badgeNumber: `SIA-${Math.floor(10000 + Math.random() * 90000)}`,
      phone: '',
      active: true,
    });
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name || '',
      email: user.email || '',
      password: '', // blank unless updating
      role: user.role || 'guard',
      siteId: user.siteId?._id || user.siteId || (user.managedSiteIds?.[0]) || '',
      badgeNumber: user.badgeNumber || '',
      phone: user.phone || '',
      active: user.active !== false,
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setFormBusy(true);
    setFormError('');

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        role: formData.role,
        badgeNumber: formData.badgeNumber.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        siteId: formData.siteId || undefined,
      };

      if (!editingUser) {
        if (!formData.password || formData.password.length < 6) {
          throw new Error('Initial password must be at least 6 characters.');
        }
        payload.password = formData.password;

        const res = await fetch(`${API}/api/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.accessToken}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create user');
        setSuccessMsg(`Member ${payload.name} created successfully!`);
      } else {
        if (formData.password) {
          if (formData.password.length < 6) throw new Error('New password must be at least 6 characters.');
          payload.password = formData.password;
        }
        payload.active = formData.active;

        const res = await fetch(`${API}/api/users/${editingUser._id || editingUser.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.accessToken}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update user');
        setSuccessMsg(`Member ${payload.name} updated successfully.`);
      }

      setShowModal(false);
      fetchData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setFormError(err.message || 'Operation failed');
    } finally {
      setFormBusy(false);
    }
  };

  const handleToggleActive = async (user) => {
    try {
      const nextActive = !user.active;
      const res = await fetch(`${API}/api/users/${user._id || user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({ active: nextActive }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to change status');
      }
      setUsers(prev => prev.map(u => (u._id === user._id || u.id === user.id ? { ...u, active: nextActive } : u)));
      setSuccessMsg(`${user.name} is now ${nextActive ? 'Active' : 'Inactive'}.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteCandidate) return;
    setFormBusy(true);
    try {
      const res = await fetch(`${API}/api/users/${deleteCandidate._id || deleteCandidate.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete user');
      }
      setUsers(prev => prev.filter(u => u._id !== deleteCandidate._id && u.id !== deleteCandidate.id));
      setDeleteCandidate(null);
      setSuccessMsg(`Account permanently removed.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setFormBusy(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(u => {
      const matchesSearch = !q || [u.name, u.email, u.badgeNumber, u.phone].some(f => String(f || '').toLowerCase().includes(q));
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? u.active !== false : u.active === false);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: users.length,
    guards: users.filter(u => u.role === 'guard').length,
    managers: users.filter(u => u.role === 'manager').length,
    admins: users.filter(u => ['admin', 'superadmin'].includes(u.role)).length,
  }), [users]);

  const getSiteName = (siteId) => {
    if (!siteId) return '—';
    const id = typeof siteId === 'object' ? (siteId._id || siteId.id) : siteId;
    const found = sites.find(s => (s._id || s.id) === id);
    return found ? found.name : 'Assigned Site';
  };

  return (
    <div className="users-page space-y-6">
      {/* Top Banner & Header */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="eyebrow">ORGANISATION ACCESS & STAFF</p>
          <h1 className="mt-1 text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">Team & Member Management</h1>
          <p className="mt-1 text-sm text-slate-500">Create new security guards, managers, and administrators with role-based access.</p>
        </div>
        <button className="primary-button" onClick={openCreateModal}>
          <Icon name="plus" size={16} /> Add New Member
        </button>
      </section>

      {/* Metrics Row */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="metric-card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="metric-icon tone-navy"><Icon name="users" size={16} /></div>
          <div className="mt-3 text-2xl font-bold text-slate-900">{stats.total}</div>
          <div className="text-xs font-semibold text-slate-500">Total Members</div>
        </div>
        <div className="metric-card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="metric-icon tone-blue"><Icon name="shield" size={16} /></div>
          <div className="mt-3 text-2xl font-bold text-blue-600">{stats.guards}</div>
          <div className="text-xs font-semibold text-slate-500">Security Guards</div>
        </div>
        <div className="metric-card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="metric-icon tone-gold"><Icon name="users" size={16} /></div>
          <div className="mt-3 text-2xl font-bold text-amber-600">{stats.managers}</div>
          <div className="text-xs font-semibold text-slate-500">Operations Managers</div>
        </div>
        <div className="metric-card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="metric-icon tone-green"><Icon name="shield" size={16} /></div>
          <div className="mt-3 text-2xl font-bold text-emerald-600">{stats.admins}</div>
          <div className="text-xs font-semibold text-slate-500">Administrators</div>
        </div>
      </section>

      {/* Feedback Messages */}
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

      {/* Search & Filter Bar */}
      <section className="panel rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="grid gap-3 sm:grid-cols-12">
          <div className="sm:col-span-6">
            <label className="field-label">Search Personnel</label>
            <div className="search-wrap mt-1.5">
              <Icon name="search" size={16} />
              <input
                type="text"
                placeholder="Search by name, email, badge, or phone…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="sm:col-span-3">
            <label className="field-label">Role Filter</label>
            <select
              className="form-input mt-1.5"
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="guard">Security Guards</option>
              <option value="manager">Managers</option>
              <option value="admin">Administrators</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className="field-label">Account Status</label>
            <select
              className="form-input mt-1.5"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>
      </section>

      {/* Table Section */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-bold text-slate-900">Personnel Directory ({filteredUsers.length})</h2>
          {loading && <span className="loading-label"><span className="spinner" /> Loading</span>}
        </div>

        {filteredUsers.length === 0 && !loading ? (
          <div className="empty-table p-8 text-center">
            <div className="empty-mark mx-auto"><Icon name="users" size={24} /></div>
            <h3 className="mt-3 text-sm font-bold text-slate-800">No members found</h3>
            <p className="mt-1 text-xs text-slate-500">Try adjusting your search criteria or add a new member.</p>
            <button className="primary-button mt-4" onClick={openCreateModal}>
              <Icon name="plus" size={16} /> Add Member
            </button>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="report-table w-full border-collapse text-left">
              <thead>
                <tr>
                  <th>Member Name</th>
                  <th>Role</th>
                  <th>SIA Badge</th>
                  <th>Assigned Site</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => {
                  const isCurrent = user._id === session?.user?._id || user.id === session?.user?._id;
                  const roleTone = user.role === 'admin' || user.role === 'superadmin'
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : user.role === 'manager'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200';

                  return (
                    <tr key={user._id || user.id} className="hover:bg-slate-50 transition-colors">
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-bold text-slate-700 text-xs border border-slate-200">
                            {user.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              {user.name}
                              {isCurrent && <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-semibold">You</span>}
                            </div>
                            <div className="text-xs text-slate-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border capitalize ${roleTone}`}>
                          {user.role}
                        </span>
                      </td>
                      <td>
                        <span className="font-mono text-xs text-slate-700">
                          {user.badgeNumber || '—'}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs font-medium text-slate-700">
                          {user.role === 'guard' ? getSiteName(user.siteId) : user.managedSiteIds?.length ? `${user.managedSiteIds.length} sites` : 'All sites'}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs text-slate-600">{user.phone || '—'}</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(user)}
                          disabled={isCurrent}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                            user.active !== false
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                          }`}
                          title={isCurrent ? "Cannot deactivate yourself" : "Click to toggle active status"}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${user.active !== false ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {user.active !== false ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            className="icon-button h-8 w-8 text-slate-600 hover:text-blue-600"
                            onClick={() => openEditModal(user)}
                            title="Edit User"
                          >
                            <Icon name="edit" size={14} />
                          </button>
                          {!isCurrent && (
                            <button
                              className="icon-button h-8 w-8 text-slate-400 hover:text-red-600"
                              onClick={() => setDeleteCandidate(user)}
                              title="Delete User"
                            >
                              <Icon name="trash" size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* CREATE / EDIT USER MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingUser ? 'Edit Member Details' : 'Add New Member'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingUser ? 'Update personal details, assigned site, or reset password.' : 'Create an officer, manager, or admin credential.'}
                </p>
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

            <form onSubmit={handleSaveUser} className="mt-4 space-y-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="field-label">Full Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input mt-1"
                    placeholder="e.g. John Doe"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Work Email *</label>
                  <input
                    type="email"
                    required
                    className="form-input mt-1"
                    placeholder="guard@company.com"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="field-label">Role *</label>
                  <select
                    className="form-input mt-1"
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="guard">Security Guard</option>
                    <option value="manager">Operations Manager</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Assigned Site {formData.role === 'guard' && '*'}</label>
                  <select
                    className="form-input mt-1"
                    value={formData.siteId}
                    onChange={e => setFormData({ ...formData, siteId: e.target.value })}
                    required={formData.role === 'guard'}
                  >
                    <option value="">Choose Site…</option>
                    {sites.map(s => (
                      <option key={s._id || s.id} value={s._id || s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="field-label">SIA Badge / ID</label>
                  <input
                    type="text"
                    className="form-input mt-1"
                    placeholder="e.g. SIA-88219"
                    value={formData.badgeNumber}
                    onChange={e => setFormData({ ...formData, badgeNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Phone Number</label>
                  <input
                    type="text"
                    className="form-input mt-1"
                    placeholder="+44 7700 900000"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="field-label">
                  {editingUser ? 'Reset Password (leave empty to keep current)' : 'Initial Password * (min 6 characters)'}
                </label>
                <div className="relative mt-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required={!editingUser}
                    minLength={6}
                    className="form-input pr-11"
                    placeholder={editingUser ? '••••••••' : 'Enter initial password'}
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700 transition-colors focus:outline-none"
                    onClick={() => setShowPassword(prev => !prev)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Icon name={showPassword ? 'eyeOff' : 'eye'} size={17} />
                  </button>
                </div>
              </div>

              {editingUser && (
                <div className="pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={e => setFormData({ ...formData, active: e.target.checked })}
                      className="rounded accent-blue-600 h-4 w-4"
                    />
                    Account is Active and authorized to sign in
                  </label>
                </div>
              )}

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
                  {formBusy ? 'Saving…' : editingUser ? 'Save Changes' : 'Create Member'}
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
            <h3 className="mt-4 text-lg font-bold text-slate-900">Delete Account?</h3>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Are you sure you want to permanently delete <b>{deleteCandidate.name}</b> ({deleteCandidate.email})? This action cannot be undone.
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
                onClick={handleDeleteUser}
                disabled={formBusy}
              >
                {formBusy ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
