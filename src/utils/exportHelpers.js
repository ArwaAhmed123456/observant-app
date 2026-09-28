// Shift Call Report Export Helpers (CSV and Printable PDF)

export const exportToCSV = (filename, headers, rows) => {
  const escapeCell = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvContent = [
    headers.map(h => escapeCell(h.label)).join(','),
    ...rows.map(row => headers.map(h => escapeCell(row[h.key] ?? '')).join(','))
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const openPrintablePDF = ({
  title = 'OBSERVANT SECURITY - SHIFT CALL & PATROL REPORT',
  companyName = 'Observant Security Group UK',
  companyAddress = '44 Bishopsgate, London EC2N 4AG | Operations Center: +44 800 092 1100',
  generatedBy = 'Elena Rostova (Operations Manager)',
  filters = {},
  headers = [],
  rows = [],
  checklistRows = [],
  includePhotos = true,
  summaryKpis = {}
}) => {
  const printWindow = window.open('', '_blank', 'width=1100,height=850');
  if (!printWindow) {
    alert('Please allow popups to generate the printable PDF report.');
    return;
  }

  const generatedDate = new Date().toLocaleString('en-GB', {
    dateStyle: 'full',
    timeStyle: 'medium'
  });

  const photoColIndex = headers.findIndex(h => h.key === 'photos');
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const renderChecklist = () => {
    const hoursFor = shift => Array.from({ length: 13 }, (_, i) => `${String(((shift === 'Day' ? 7 : 19) + i) % 24).padStart(2, '0')}00`);
    const headerCells = hours => hours.map(hour => `<th>${hour}</th>`).join('');
    const bands = ['Day', 'Night'].map(shift => {
      const rowsForShift = checklistRows.filter(row => row.shift === shift);
      const hours = hoursFor(shift);
      return `<h2 class="band-title">${shift} Check Calls <span>${shift === 'Day' ? '0700–1900' : '1900–0700'}</span></h2>
        <table class="checklist"><thead><tr><th>Site Name</th><th>Security Officer</th><th>ID No</th><th>Shift</th>${headerCells(hours)}<th>Incident / Notes</th></tr></thead>
        <tbody>${rowsForShift.map(row => `<tr><td>${escapeHtml(row.siteName)}</td><td>${escapeHtml(row.guardName)}</td><td>${escapeHtml(row.badgeNumber)}</td><td>${escapeHtml(row.shiftTime)}</td>${hours.map(hour => {
          const value = row.slots[hour] || '—';
          const cls = value.includes('MISSED') ? 'critical' : value.includes('LATE') ? 'late' : '';
          return `<td class="${cls}">${escapeHtml(value)}</td>`;
        }).join('')}<td>${escapeHtml(row.notes.join('; ') || '—')}</td></tr>`).join('') || `<tr><td colspan="${hours.length + 5}" class="empty-row">No ${shift.toLowerCase()} check calls in this period.</td></tr>`}</tbody></table>`;
    }).join('');
    return `<section class="register"><h1>CHECK CALL LOG</h1><div class="register-meta"><span><b>Start Date:</b> ${escapeHtml(filters.startDate || filters.dateRange || 'All records')}</span><span><b>Finish Date:</b> ${escapeHtml(filters.finishDate || '')}</span></div><p>Record the precise time of every call. Late calls are highlighted in red. Calls unanswered after 15 minutes must be reported and fully explained in the Incident Log Book.</p>${bands}</section>`;
  };

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 15mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          background: #ffffff;
          margin: 0;
          padding: 20px;
          font-size: 11px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 14px;
          margin-bottom: 16px;
        }
        .logo-block {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .logo-img {
          height: 40px;
          width: auto;
          object-fit: contain;
        }
        .logo-title {
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.5px;
          line-height: 1.1;
        }
        .logo-sub {
          font-size: 10px;
          color: #64748b;
          margin-top: 2px;
        }
        .meta-block {
          text-align: right;
          font-size: 10px;
          color: #475569;
          line-height: 1.4;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 18px;
        }
        .kpi-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 10px 12px;
          border-radius: 6px;
        }
        .kpi-card .label {
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #64748b;
        }
        .kpi-card .value {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          margin-top: 4px;
        }
        .filter-banner {
          background: #eff6ff;
          border-left: 3px solid #3b82f6;
          padding: 6px 10px;
          font-size: 10px;
          color: #1e40af;
          margin-bottom: 14px;
          border-radius: 0 4px 4px 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
        }
        th {
          background: #0f172a;
          color: #ffffff;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 700;
          padding: 8px 10px;
          text-align: left;
        }
        td {
          padding: 7px 10px;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: top;
          font-size: 10px;
        }
        tr:nth-child(even) td {
          background: #f8fafc;
        }
        .badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .badge-success { background: #dcfce7; color: #166534; }
        .badge-danger { background: #fee2e2; color: #991b1b; }
        .badge-warning { background: #fef3c7; color: #92400e; }
        .badge-info { background: #e0e7ff; color: #3730a3; }
        .thumbnail-strip {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .thumb-box {
          position: relative;
          width: 48px;
          height: 48px;
          border-radius: 4px;
          overflow: hidden;
          border: 1px solid #cbd5e1;
        }
        .thumb-box img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .footer {
          margin-top: 30px;
          padding-top: 12px;
          border-top: 1px solid #cbd5e1;
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          color: #64748b;
        }
        .signoff {
          margin-top: 25px;
          display: flex;
          justify-content: space-between;
          padding: 0 20px;
        }
        .sign-line {
          width: 200px;
          border-top: 1px solid #0f172a;
          padding-top: 6px;
          text-align: center;
          font-weight: 600;
          font-size: 10px;
        }
        .register { page-break-after: always; }
        .register h1 { font-size: 18px; letter-spacing: .8px; margin: 0 0 8px; }
        .register-meta { display:flex; gap:28px; font-size:10px; margin-bottom:8px; }
        .register > p { font-size:9px; color:#475569; margin:0 0 14px; }
        .band-title { font-size:12px; margin:14px 0 6px; }
        .band-title span { color:#64748b; font-size:9px; font-weight:500; margin-left:8px; }
        table.checklist { table-layout:fixed; font-size:7px; margin-bottom:14px; }
        .checklist th,.checklist td { padding:4px 3px; border:1px solid #cbd5e1; text-align:center; overflow-wrap:anywhere; }
        .checklist th { background:#172033; font-size:6.5px; }
        .checklist th:nth-child(1) { width:10%; }
        .checklist th:nth-child(2) { width:9%; }
        .checklist th:nth-child(3) { width:4%; }
        .checklist th:nth-child(4) { width:5%; }
        .checklist th:last-child { width:12%; }
        .checklist td:nth-child(1),.checklist td:nth-child(2),.checklist td:last-child { text-align:left; }
        .checklist .late,.checklist .critical { color:#dc2626; font-weight:800; }
        .checklist .empty-row { padding:12px; text-align:center; color:#64748b; }
        @media screen {
          .print-bar {
            background: #1e293b;
            color: #fff;
            padding: 10px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            border-radius: 6px;
          }
          .print-btn {
            background: #10b981;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            font-weight: 700;
            cursor: pointer;
            font-size: 12px;
          }
        }
        @media print {
          .print-bar { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="print-bar">
        <span>Observant Shift Call Report ready to export or print.</span>
        <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
      </div>

      <div class="header">
        <div class="logo-block">
          <img src="${window.location.origin}/logo.png" alt="Observant" class="logo-img" />
          <div>
            <div class="logo-title">OBSERVANT SECURITY GROUP</div>
            <div class="logo-sub">${companyAddress}</div>
          </div>
        </div>
        <div class="meta-block">
          <div><strong>OFFICIAL SHIFT OPERATIONS REPORT</strong></div>
          <div>Generated: ${generatedDate}</div>
          <div>Authorizing Manager: ${generatedBy}</div>
          <div>Classification: CONFIDENTIAL / SIA AUDIT READY</div>
        </div>
      </div>

      <div class="filter-banner">
        <strong>Report Scope:</strong> Range: ${filters.dateRange || 'All Records'} | Site: ${filters.siteName || 'All Sites'} | Guard: ${filters.guardName || 'All Guards'} | Type: ${filters.reportType || 'Combined'}
      </div>

      ${checklistRows.length ? renderChecklist() : ''}

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="label">Total Check Calls</div>
          <div class="value">${summaryKpis.totalCheckCalls ?? 0}</div>
        </div>
        <div class="kpi-card">
          <div class="label">Punctual Responses</div>
          <div class="value">${summaryKpis.completedCheckCalls ?? 0} (${summaryKpis.checkCallRate ?? '100%'})</div>
        </div>
        <div class="kpi-card">
          <div class="label">Reported Issues</div>
          <div class="value">${summaryKpis.issuesReported ?? 0}</div>
        </div>
        <div class="kpi-card">
          <div class="label">Completed Patrols</div>
          <div class="value">${summaryKpis.completedPatrols ?? 0} (${summaryKpis.photosCaptured ?? 0} Photos)</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            ${headers.map(h => `<th>${h.label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              ${headers.map(h => {
                if (h.key === 'photos') {
                  if (!includePhotos || !row.photosList || row.photosList.length === 0) {
                    return `<td>${row.photos || '0 captured'}</td>`;
                  }
                  return `
                    <td>
                      <div class="thumbnail-strip">
                        ${row.photosList.map(p => `
                          <div class="thumb-box" title="${p.name}">
                            <img src="${p.photoUrl}" alt="${p.name}" />
                          </div>
                        `).join('')}
                      </div>
                    </td>
                  `;
                }
                if (h.key === 'result') {
                  const val = row[h.key] || '';
                  const cls = val.includes('Yes') ? 'badge-success' : val.includes('Issue') ? 'badge-warning' : val.includes('Missed') ? 'badge-danger' : 'badge-info';
                  return `<td><span class="badge ${cls}">${val}</span></td>`;
                }
                return `<td>${row[h.key] ?? '—'}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="signoff">
        <div>
          <div class="sign-line">Duty Security Guard Signature</div>
        </div>
        <div>
          <div class="sign-line">Operations Manager Signature</div>
        </div>
        <div>
          <div class="sign-line">Client Site Representative</div>
        </div>
      </div>

      <div class="footer">
        <span>Observant Security Systems — Security Industry Authority Compliance Standard</span>
        <span>Page 1 of 1 — Document ID: OBS-${Date.now().toString(36).toUpperCase()}</span>
      </div>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};
