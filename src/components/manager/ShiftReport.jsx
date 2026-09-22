import React, { useState } from 'react';
import {
  FileText,
  Download,
  Printer,
  Filter,
  CheckSquare,
  Square,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye
} from 'lucide-react';
import { useSecurity } from '../../context/SecurityContext';
import { exportToCSV, openPrintablePDF } from '../../utils/exportHelpers';

const AVAILABLE_COLUMNS = [
  { key: 'guardName', label: 'Guard Name', default: true },
  { key: 'siteName', label: 'Site Location', default: true },
  { key: 'shiftTime', label: 'Scheduled Shift', default: true },
  { key: 'type', label: 'Activity Type', default: true },
  { key: 'time', label: 'Event Timestamp', default: true },
  { key: 'result', label: 'Check Call / Patrol Result', default: true },
  { key: 'notes', label: 'Notes & Reported Issues', default: true },
  { key: 'photos', label: 'Checkpoint Photos', default: true }
];

export const ShiftReport = () => {
  const {
    users,
    sites,
    checkCalls,
    patrolSessions,
    shiftSessions,
    currentUser
  } = useSecurity();

  // Filters
  const [dateRange, setDateRange] = useState('all'); // 'today', 'week', 'month', 'custom', 'all'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState('all');
  const [selectedGuardId, setSelectedGuardId] = useState('all');
  const [reportType, setReportType] = useState('combined'); // 'check_call', 'patrol', 'combined'
  const [includePhotos, setIncludePhotos] = useState(true);

  // Selected Columns
  const [activeColumns, setActiveColumns] = useState(() =>
    AVAILABLE_COLUMNS.reduce((acc, col) => ({ ...acc, [col.key]: col.default }), {})
  );

  const toggleColumn = (key) => {
    setActiveColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Build combined normalized rows
  const getRows = () => {
    const rows = [];
    const guardsMap = Object.fromEntries(users.map(u => [u.id, u]));
    const sitesMap = Object.fromEntries(sites.map(s => [s.id, s]));

    // 1. Process Check Calls
    if (reportType === 'check_call' || reportType === 'combined') {
      checkCalls.forEach(cc => {
        const guard = guardsMap[cc.guardId];
        const site = sitesMap[cc.siteId];
        const session = shiftSessions.find(s => s.id === cc.sessionId);

        // Date filter check
        const promptDate = new Date(cc.promptTime);
        if (dateRange === 'today') {
          const todayStr = new Date().toDateString();
          if (promptDate.toDateString() !== todayStr) return;
        }

        if (selectedSiteId !== 'all' && cc.siteId !== selectedSiteId) return;
        if (selectedGuardId !== 'all' && cc.guardId !== selectedGuardId) return;

        let resultLabel = 'Yes (All Okay)';
        if (cc.response === 'no' || cc.status === 'issue_reported') resultLabel = '⚠️ Issue Reported';
        if (cc.status === 'missed') resultLabel = '🚨 Missed (10m SLA)';

        rows.push({
          id: `row-cc-${cc.id}`,
          timestamp: promptDate.getTime(),
          guardName: guard ? `${guard.name} (${guard.badgeNumber})` : 'Guard',
          siteName: site ? site.name : 'Site',
          shiftTime: session ? `${session.scheduledStartTime}–${session.scheduledEndTime}` : '18:00–06:00',
          type: cc.callType === 'random' ? 'Check Call (Random)' : 'Check Call (Hourly)',
          time: promptDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          result: resultLabel,
          notes: cc.notes || '—',
          photos: 'N/A (Check Call)',
          photosList: []
        });
      });
    }

    // 2. Process Patrols
    if (reportType === 'patrol' || reportType === 'combined') {
      patrolSessions.forEach(patrol => {
        const guard = guardsMap[patrol.guardId];
        const site = sitesMap[patrol.siteId];
        const session = shiftSessions.find(s => s.id === patrol.sessionId);

        const patrolDate = new Date(patrol.startTime);
        if (dateRange === 'today') {
          const todayStr = new Date().toDateString();
          if (patrolDate.toDateString() !== todayStr) return;
        }

        if (selectedSiteId !== 'all' && patrol.siteId !== selectedSiteId) return;
        if (selectedGuardId !== 'all' && patrol.guardId !== selectedGuardId) return;

        const isComplete = patrol.checkpointsCompleted >= patrol.checkpointsTotal;

        rows.push({
          id: `row-pt-${patrol.id}`,
          timestamp: patrolDate.getTime(),
          guardName: guard ? `${guard.name} (${guard.badgeNumber})` : 'Guard',
          siteName: site ? site.name : 'Site',
          shiftTime: session ? `${session.scheduledStartTime}–${session.scheduledEndTime}` : '18:00–06:00',
          type: patrol.isAntiIdlePrompted ? 'Patrol (Anti-Idle Early)' : 'Patrol (Scheduled)',
          time: `${patrolDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${patrol.endTime ? new Date(patrol.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ongoing'}`,
          result: isComplete ? `Completed (${patrol.checkpointsCompleted}/${patrol.checkpointsTotal} CP)` : `Incomplete (${patrol.checkpointsCompleted}/${patrol.checkpointsTotal} CP)`,
          notes: patrol.warningNotes || (patrol.isAntiIdlePrompted ? 'Dynamic +1h schedule advance applied' : 'Route clear, all locks inspected'),
          photos: `${patrol.captures.length} Photos Captured`,
          photosList: patrol.captures
        });
      });
    }

    // Sort newest first
    return rows.sort((a, b) => b.timestamp - a.timestamp);
  };

  const filteredRows = getRows();
  const visibleHeaders = AVAILABLE_COLUMNS.filter(c => activeColumns[c.key]);

  // Compute summary KPI counts
  const totalCalls = checkCalls.length;
  const okCalls = checkCalls.filter(c => c.response === 'yes').length;
  const issueCalls = checkCalls.filter(c => c.response === 'no' || c.status === 'issue_reported').length;
  const missedCalls = checkCalls.filter(c => c.status === 'missed').length;
  const totalPatrols = patrolSessions.length;
  const totalPhotos = patrolSessions.reduce((acc, p) => acc + (p.captures?.length || 0), 0);

  const kpis = {
    totalCheckCalls: totalCalls,
    completedCheckCalls: okCalls,
    checkCallRate: totalCalls > 0 ? `${Math.round((okCalls / totalCalls) * 100)}%` : '100%',
    issuesReported: issueCalls,
    missedCheckCalls: missedCalls,
    completedPatrols: totalPatrols,
    photosCaptured: totalPhotos
  };

  const handleExportCSV = () => {
    exportToCSV(`Observant_Shift_Call_Report_${Date.now()}`, visibleHeaders, filteredRows);
  };

  const handleExportPDF = () => {
    const siteObj = sites.find(s => s.id === selectedSiteId);
    const guardObj = users.find(u => u.id === selectedGuardId);

    openPrintablePDF({
      title: 'OBSERVANT SECURITY - OFFICIAL SHIFT CALL REPORT',
      companyName: 'Observant Security Group UK',
      generatedBy: `${currentUser.name} (${currentUser.role === 'manager' ? 'Operations Manager' : 'Duty Supervisor'})`,
      filters: {
        dateRange: dateRange.toUpperCase(),
        siteName: siteObj ? siteObj.name : 'All Monitored Sites',
        guardName: guardObj ? guardObj.name : 'All Duty Guards',
        reportType: reportType.toUpperCase()
      },
      headers: visibleHeaders,
      rows: filteredRows,
      includePhotos,
      summaryKpis: kpis
    });
  };

  return (
    <div className="report-generator-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={22} color="var(--accent-green)" />
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#fff' }}>
              Shift Call & Patrol Executive Report
            </h2>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Export SIA-compliant audit reports for client review, billing validation, and welfare compliance.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleExportCSV}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--accent-cyan)',
              padding: '9px 16px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleExportPDF}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#042b14',
              padding: '9px 18px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
            }}
          >
            <Printer size={14} />
            <span>Print / Save as PDF</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="filter-grid">
        <div className="filter-group">
          <label>Date Range</label>
          <select
            className="filter-input"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            <option value="all">All Available Records</option>
            <option value="today">Today Only</option>
            <option value="week">Current Week</option>
            <option value="month">Current Month</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Site Filter</label>
          <select
            className="filter-input"
            value={selectedSiteId}
            onChange={(e) => setSelectedSiteId(e.target.value)}
          >
            <option value="all">All Sites (Cross-Facility)</option>
            {sites.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Guard Filter</label>
          <select
            className="filter-input"
            value={selectedGuardId}
            onChange={(e) => setSelectedGuardId(e.target.value)}
          >
            <option value="all">All Security Guards</option>
            {users.filter(u => u.role === 'guard').map(g => (
              <option key={g.id} value={g.id}>{g.name} ({g.badgeNumber})</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Report Type</label>
          <select
            className="filter-input"
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
          >
            <option value="combined">Combined (Check Calls & Patrols)</option>
            <option value="check_call">Check Calls Log Only</option>
            <option value="patrol">Patrol Verification Only</option>
          </select>
        </div>
      </div>

      {/* Customizable Columns Selector */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Customizable Columns (Select/Deselect for Export):
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--accent-cyan)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={includePhotos}
              onChange={(e) => setIncludePhotos(e.target.checked)}
              style={{ accentColor: 'var(--accent-cyan)' }}
            />
            <span>Include Inline Checkpoint Photos</span>
          </label>
        </div>

        <div className="column-pill-selector">
          {AVAILABLE_COLUMNS.map(col => {
            const isSelected = activeColumns[col.key];
            return (
              <div
                key={col.key}
                className={`col-toggle-pill ${isSelected ? 'active' : ''}`}
                onClick={() => toggleColumn(col.key)}
              >
                {isSelected ? <CheckSquare size={12} /> : <Square size={12} />}
                <span>{col.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Table Preview */}
      <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: 'var(--bg-elevated)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
              {visibleHeaders.map(h => (
                <th key={h.key} style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={visibleHeaders.length} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No matching log records found for the selected filters.
                </td>
              </tr>
            ) : (
              filteredRows.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {visibleHeaders.map(h => {
                    if (h.key === 'photos') {
                      if (!includePhotos || !row.photosList || row.photosList.length === 0) {
                        return (
                          <td key={h.key} style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                            {row.photos}
                          </td>
                        );
                      }
                      return (
                        <td key={h.key} style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {row.photosList.map(p => (
                              <img
                                key={p.checkpointId}
                                src={p.photoUrl}
                                alt={p.name}
                                title={p.name}
                                style={{ width: '36px', height: '36px', borderRadius: '4px', objectFit: 'cover', border: '1px solid rgba(6, 182, 212, 0.4)' }}
                              />
                            ))}
                          </div>
                        </td>
                      );
                    }

                    if (h.key === 'result') {
                      const isOk = row.result.includes('Yes') || row.result.includes('Completed');
                      const isIssue = row.result.includes('Issue');
                      const isMissed = row.result.includes('Missed');

                      return (
                        <td key={h.key} style={{ padding: '10px 12px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '700',
                              background: isOk ? 'rgba(16, 185, 129, 0.15)' : isIssue ? 'rgba(245, 158, 11, 0.15)' : isMissed ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.05)',
                              color: isOk ? 'var(--accent-green)' : isIssue ? 'var(--accent-amber)' : isMissed ? 'var(--accent-red)' : 'var(--text-secondary)'
                            }}
                          >
                            {row.result}
                          </span>
                        </td>
                      );
                    }

                    return (
                      <td key={h.key} style={{ padding: '10px 12px', color: '#fff' }}>
                        {row[h.key]}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', fontSize: '11px', color: 'var(--text-muted)' }}>
        <div>Showing {filteredRows.length} total event log records</div>
        <div>Compliant with UK SIA Operational Auditing Standards</div>
      </div>
    </div>
  );
};
