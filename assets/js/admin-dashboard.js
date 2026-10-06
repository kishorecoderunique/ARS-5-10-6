/**
 * ARS - Disaster Rescue & SOS Management System
 * Admin Dashboard Controller (/assets/js/admin-dashboard.js)
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (!await window.ARS_State.bootstrap('admin')) return;

  const currentUser = window.ARS_State.getCurrentUser();
  let currentTab = 'overview';
  let severityFilter = 'all';
  let statusFilter = 'all';
  let pendingSearchQuery = '';
  let activeSearchQuery = '';

  // DOM Elements
  const activeCountElem = document.getElementById('active-sos-count');
  const notifCountElem = document.getElementById('notif-unread-count');
  const notifListElem = document.getElementById('notif-list');
  const notifDropdown = document.getElementById('notif-dropdown');
  const notifBellBtn = document.getElementById('notif-bell-btn');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const signoutBtn = document.getElementById('signout-btn');
  const simulateSosBtn = document.getElementById('simulate-sos-btn');
  const sidebarPendingBadge = document.getElementById('sidebar-pending-badge');

  // Summary Tile Counters
  const tileTotalSos = document.getElementById('tile-total-sos');
  const tilePendingSos = document.getElementById('tile-pending-sos');
  const tileAcceptedSos = document.getElementById('tile-accepted-sos');
  const tileResolvedSos = document.getElementById('tile-resolved-sos');
  const tileOnDutyRescuers = document.getElementById('tile-onduty-rescuers');

  // Table Body Elements
  const sosTableBodyElem = document.getElementById('sos-table-body');
  const pendingRescuersTableBody = document.getElementById('pending-rescuers-table-body');
  const activeRescuersTableBody = document.getElementById('active-rescuers-table-body');
  const severityFilterElem = document.getElementById('severity-filter');
  const statusFilterElem = document.getElementById('status-filter');
  const pendingSearchInput = document.getElementById('pending-search-input');
  const activeSearchInput = document.getElementById('active-search-input');

  // Sidebar Tab Handlers
  const sidebarItems = document.querySelectorAll('.sidebar-item');
  sidebarItems.forEach(item => {
    item.addEventListener('click', () => {
      sidebarItems.forEach(s => s.classList.remove('active'));
      item.classList.add('active');
      currentTab = item.dataset.tab;

      // Toggle tab views
      document.querySelectorAll('.tab-view').forEach(view => {
        view.style.display = 'none';
        view.classList.remove('active');
      });
      const activeView = document.getElementById(`tab-view-${currentTab}`);
      if (activeView) {
        activeView.style.display = 'block';
        activeView.classList.add('active');
      }

      renderAdminDashboard();
    });
  });

  // Top Bar Handlers
  if (signoutBtn) {
    signoutBtn.addEventListener('click', () => window.ARS_State.logout());
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const newTheme = window.ARS_State.toggleTheme();
      themeToggleBtn.innerHTML = newTheme === 'dark' ? '☀️' : '🌙';
    });
  }

  if (notifBellBtn) {
    notifBellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (notifDropdown) notifDropdown.classList.toggle('active');
    });
  }

  document.addEventListener('click', (e) => {
    if (notifDropdown && !notifDropdown.contains(e.target) && !notifBellBtn.contains(e.target)) {
      notifDropdown.classList.remove('active');
    }
  });

  if (simulateSosBtn) {
    simulateSosBtn.addEventListener('click', () => {
      window.ARS_State.simulateNewSos();
    });
  }

  if (severityFilterElem) {
    severityFilterElem.addEventListener('change', (e) => {
      severityFilter = e.target.value;
      renderSosTable();
    });
  }

  if (statusFilterElem) {
    statusFilterElem.addEventListener('change', (e) => {
      statusFilter = e.target.value;
      renderSosTable();
    });
  }

  if (pendingSearchInput) {
    pendingSearchInput.addEventListener('input', (e) => {
      pendingSearchQuery = e.target.value.toLowerCase().trim();
      renderPendingRescuersTable();
    });
  }

  if (activeSearchInput) {
    activeSearchInput.addEventListener('input', (e) => {
      activeSearchQuery = e.target.value.toLowerCase().trim();
      renderActiveRescuersTable();
    });
  }

  // Mobile Sidebar Toggle
  const mobileToggleBtn = document.getElementById('mobile-sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  if (mobileToggleBtn && sidebar) {
    mobileToggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('active');
    });
  }

  // Initialize Map Engine in Admin Mode
  window.ARS_MapManager.initMap('admin-map-canvas', {
    mode: 'admin',
    onMarkerClick: (sos) => {
      highlightSosTableRow(sos.id);
    }
  });

  // Subscribe to State Bus
  window.ARS_State.subscribe(() => {
    renderAdminDashboard();
    window.ARS_MapManager.updateMarkers();
  });

  // Initial Render
  renderAdminDashboard();

  function renderAdminDashboard() {
    updateMetrics();
    renderNotifications();
    renderSosTable();
    renderPendingRescuersTable();
    renderActiveRescuersTable();
  }

  function updateMetrics() {
    const sosList = window.ARS_State.getSortedSosList();
    const rescuers = window.ARS_State.getRescuers();

    const pendingSosCount = sosList.filter(s => s.status === 'pending').length;
    const acceptedCount = sosList.filter(s => ['accepted', 'en_route', 'reached'].includes(s.status)).length;
    const resolvedCount = sosList.filter(s => s.status === 'resolved').length;
    const onDutyCount = rescuers.filter(r => (r.statusLabel === 'approved' || r.status !== 'pending_approval') && ['on_duty', 'on_case'].includes(r.status)).length;
    const pendingRescuersCount = rescuers.filter(r => r.status === 'pending_approval' || r.statusLabel === 'pending').length;

    if (activeCountElem) activeCountElem.textContent = `${pendingSosCount} Pending`;

    if (tileTotalSos) tileTotalSos.textContent = sosList.length;
    if (tilePendingSos) tilePendingSos.textContent = pendingSosCount;
    if (tileAcceptedSos) tileAcceptedSos.textContent = acceptedCount;
    if (tileResolvedSos) tileResolvedSos.textContent = resolvedCount;
    if (tileOnDutyRescuers) tileOnDutyRescuers.textContent = onDutyCount;

    if (sidebarPendingBadge) {
      sidebarPendingBadge.textContent = pendingRescuersCount;
      sidebarPendingBadge.style.display = pendingRescuersCount > 0 ? 'inline-block' : 'none';
    }

    const notifs = window.ARS_State.getNotifications();
    const unread = notifs.filter(n => !n.read).length;
    if (notifCountElem) {
      notifCountElem.textContent = unread;
      notifCountElem.style.display = unread > 0 ? 'flex' : 'none';
    }
  }

  function renderNotifications() {
    if (!notifListElem) return;
    const escapeHtml = window.ARS_State.escapeHtml;
    const notifs = window.ARS_State.getNotifications();
    if (notifs.length === 0) {
      notifListElem.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted);">No notifications.</div>`;
      return;
    }

    notifListElem.innerHTML = notifs.map(n => `
      <div class="notif-item ${!n.read ? 'unread' : ''}" onclick="window.ARS_AdminDash.readNotif('${n.id}')">
        <div class="notif-title">
          <span>${escapeHtml(n.title)}</span>
          <span class="notif-time">${window.ARS_State.formatTimeAgo(n.timestamp)}</span>
        </div>
        <div class="notif-body">${escapeHtml(n.message)}</div>
      </div>
    `).join('');
  }

  function renderPendingRescuersTable() {
    if (!pendingRescuersTableBody) return;
    const escapeHtml = window.ARS_State.escapeHtml;
    let pendingList = window.ARS_State.getRescuers().filter(r => r.status === 'pending_approval' || r.statusLabel === 'pending');

    if (pendingSearchQuery) {
      pendingList = pendingList.filter(r =>
        (r.name && r.name.toLowerCase().includes(pendingSearchQuery)) ||
        (r.phone && r.phone.toLowerCase().includes(pendingSearchQuery)) ||
        (r.email && r.email.toLowerCase().includes(pendingSearchQuery)) ||
        (r.skills && r.skills.toLowerCase().includes(pendingSearchQuery)) ||
        (r.location && r.location.toLowerCase().includes(pendingSearchQuery))
      );
    }

    if (pendingList.length === 0) {
      pendingRescuersTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 40px 16px; color: var(--text-muted);">
            <div style="font-size: 1.1rem; font-weight: 700; margin-bottom: 6px; color: var(--text-primary);">No Pending Rescuer Approvals</div>
            <div style="font-size: 0.85rem;">${pendingSearchQuery ? 'No applicants match your search query.' : 'All rescuer registration applications have been reviewed.'}</div>
          </td>
        </tr>
      `;
      return;
    }

    pendingRescuersTableBody.innerHTML = pendingList.map(r => `
      <tr>
        <td style="font-weight: 700;">${escapeHtml(r.name)}</td>
        <td style="font-family: var(--font-mono); font-size: 0.82rem;">${escapeHtml(r.phone)}</td>
        <td style="font-size: 0.82rem; color: var(--text-secondary);">${escapeHtml(r.email || `${r.phone}@ars.rescuers.org`)}</td>
        <td><span style="font-size: 0.8rem; background: rgba(255,255,255,0.06); padding: 3px 8px; border-radius: 4px; border: 1px solid var(--grid-line);">${escapeHtml(r.skills || 'Emergency Search & Rescue')}</span></td>
        <td style="font-size: 0.84rem;">${escapeHtml(r.location || 'Chennai Sector')}</td>
        <td style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(r.appliedDate || '2026-01-15')}</td>
        <td><span style="color: #10B981; font-size: 0.8rem; font-weight: 600;">📄 ${escapeHtml(r.documents || 'ID_Card_Verified.pdf')}</span></td>
        <td>
          <div style="display: flex; gap: 8px;">
            <button class="btn-approve" style="background: #10B981; color: #ffffff; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 0.8rem; cursor: pointer;" onclick="window.ARS_AdminDash.approve('${r.id}')">Approve</button>
            <button class="btn-reject" style="background: rgba(225,6,0,0.15); color: #EF4444; border: 1px solid rgba(225,6,0,0.4); padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 0.8rem; cursor: pointer;" onclick="window.ARS_AdminDash.reject('${r.id}')">Reject</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function renderActiveRescuersTable() {
    if (!activeRescuersTableBody) return;
    const escapeHtml = window.ARS_State.escapeHtml;
    let activeList = window.ARS_State.getRescuers().filter(r => r.statusLabel === 'approved' || r.status === 'on_duty' || r.status === 'off_duty' || r.status === 'on_case');

    if (activeSearchQuery) {
      activeList = activeList.filter(r =>
        (r.name && r.name.toLowerCase().includes(activeSearchQuery)) ||
        (r.phone && r.phone.toLowerCase().includes(activeSearchQuery)) ||
        (r.email && r.email.toLowerCase().includes(activeSearchQuery)) ||
        (r.skills && r.skills.toLowerCase().includes(activeSearchQuery)) ||
        (r.location && r.location.toLowerCase().includes(activeSearchQuery)) ||
        (r.status && r.status.toLowerCase().includes(activeSearchQuery))
      );
    }

    if (activeList.length === 0) {
      activeRescuersTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 40px 16px; color: var(--text-muted);">
            <div style="font-size: 1.1rem; font-weight: 700; margin-bottom: 6px; color: var(--text-primary);">No Active Rescuers Found</div>
            <div style="font-size: 0.85rem;">${activeSearchQuery ? 'No active rescuers match your search query.' : 'There are currently no active field rescuers.'}</div>
          </td>
        </tr>
      `;
      return;
    }

    activeRescuersTableBody.innerHTML = activeList.map(r => `
      <tr>
        <td style="font-weight: 700;">${escapeHtml(r.name)}</td>
        <td style="font-family: var(--font-mono); font-size: 0.82rem;">${escapeHtml(r.phone)}</td>
        <td style="font-size: 0.82rem; color: var(--text-secondary);">${escapeHtml(r.email || `${r.phone}@ars.rescuers.org`)}</td>
        <td><span style="font-size: 0.8rem; background: rgba(255,255,255,0.06); padding: 3px 8px; border-radius: 4px; border: 1px solid var(--grid-line);">${escapeHtml(r.skills || 'Search & Medical Rescue')}</span></td>
        <td style="font-size: 0.84rem;">${escapeHtml(r.location || 'Chennai Sector')}</td>
        <td>
          <span class="status-chip status-${r.status}">
            <span class="status-chip-dot"></span>
            ${r.status.replace('_', ' ')}
          </span>
        </td>
        <td style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(r.approvedDate || '2026-02-01')}</td>
        <td>
          <div style="display: flex; gap: 8px;">
            <button style="background: var(--bg-surface-elevated); color: var(--text-primary); border: 1px solid var(--grid-line); padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 0.8rem; cursor: pointer;" onclick="window.ARS_AdminDash.viewDetails('${r.id}')">View Details</button>
            <button style="background: rgba(225,6,0,0.15); color: #EF4444; border: 1px solid rgba(225,6,0,0.4); padding: 6px 12px; border-radius: 6px; font-weight: 700; font-size: 0.8rem; cursor: pointer;" onclick="window.ARS_AdminDash.deactivate('${r.id}')">Deactivate</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function renderSosTable() {
    if (!sosTableBodyElem) return;
    const escapeHtml = window.ARS_State.escapeHtml;
    let sosList = window.ARS_State.getSortedSosList();
    const rescuers = window.ARS_State.getRescuers().filter(r => r.statusLabel === 'approved');

    if (severityFilter !== 'all') {
      sosList = sosList.filter(s => s.severity === severityFilter);
    }
    if (statusFilter !== 'all') {
      sosList = sosList.filter(s => s.status === statusFilter);
    }

    sosTableBodyElem.innerHTML = sosList.map(sos => `
      <tr id="sos-row-${sos.id}" onclick="window.ARS_MapManager.highlightAndZoomToSos('${sos.id}')">
        <td style="font-family: var(--font-mono); font-weight: 700;">${escapeHtml(sos.id)}</td>
        <td>
          <div style="font-weight: 700;">${escapeHtml(sos.victimName)}</div>
          <div style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(sos.phone)}</div>
        </td>
        <td>${escapeHtml(sos.locationName)}</td>
        <td>
          <span class="severity-badge severity-${sos.severity}">
            <span class="siren-lamp-dot"></span>
            ${sos.severity}
          </span>
        </td>
        <td>
          <span style="font-family: var(--font-mono); font-size: 0.8rem; text-transform: uppercase; font-weight: 700;">
            ${sos.status}
          </span>
        </td>
        <td>
          <select style="background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--grid-line); padding: 4px 8px; border-radius: var(--radius-sm); font-size: 0.8rem;" onclick="event.stopPropagation()" onchange="window.ARS_AdminDash.reassign('${sos.id}', this.value)">
            <option value="">Unassigned</option>
            ${rescuers.map(r => `
              <option value="${escapeHtml(r.id)}" ${sos.assignedRescuerId === r.id ? 'selected' : ''}>${escapeHtml(r.name)}</option>
            `).join('')}
          </select>
        </td>
      </tr>
    `).join('');
  }

  function highlightSosTableRow(sosId) {
    const row = document.getElementById(`sos-row-${sosId}`);
    if (row) {
      document.querySelectorAll('.custom-table tr').forEach(r => r.classList.remove('highlighted-row'));
      row.classList.add('highlighted-row');
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  window.ARS_AdminDash = {
    approve: (rescuerId) => {
      window.ARS_State.approveRescuer(rescuerId);
    },
    reject: (rescuerId) => {
      if (confirm('Are you sure you want to reject this rescuer application?')) {
        window.ARS_State.rejectRescuer(rescuerId);
      }
    },
    deactivate: (rescuerId) => {
      if (confirm('Are you sure you want to deactivate this active rescuer?')) {
        window.ARS_State.deactivateRescuer(rescuerId);
      }
    },
    viewDetails: (rescuerId) => {
      const r = window.ARS_State.getRescuers().find(item => item.id === rescuerId);
      if (!r) return;
      const modal = document.getElementById('rescuer-detail-modal');
      const nameEl = document.getElementById('modal-rescuer-name');
      const contentEl = document.getElementById('modal-rescuer-content');
      if (!modal || !contentEl) return;

      nameEl.textContent = r.name;
      const escapeHtml = window.ARS_State.escapeHtml;
      contentEl.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div><strong>Phone:</strong> <span style="font-family: var(--font-mono);">${escapeHtml(r.phone)}</span></div>
          <div><strong>Email:</strong> <span>${escapeHtml(r.email || `${r.phone}@ars.rescuers.org`)}</span></div>
          <div><strong>Role / Skills:</strong> <span>${escapeHtml(r.skills || 'Emergency Search & Rescue')}</span></div>
          <div><strong>Location:</strong> <span>${escapeHtml(r.location || 'Chennai Sector')}</span></div>
          <div><strong>Status:</strong> <span style="text-transform: capitalize;">${escapeHtml(r.statusLabel || r.status)}</span></div>
          <div><strong>Duty Status:</strong> <span style="text-transform: capitalize;">${escapeHtml((r.status || '').replace('_', ' '))}</span></div>
          <div><strong>Applied Date:</strong> <span>${escapeHtml(r.appliedDate || '2026-01-15')}</span></div>
          <div><strong>Approved Date:</strong> <span>${escapeHtml(r.approvedDate || '2026-02-01')}</span></div>
        </div>
        <div style="margin-top: 8px; padding: 10px; background: rgba(255,255,255,0.04); border-radius: 8px; border: 1px solid var(--grid-line);">
          <strong>Verified Documents:</strong><br>
          <span style="color: #10B981;">📄 ${escapeHtml(r.documents || 'National_ID_Verified.pdf')}</span>
        </div>
        ${r.assignedSosLocation ? `
          <div style="margin-top: 4px; padding: 10px; background: rgba(225,6,0,0.1); border-radius: 8px; border: 1px solid rgba(225,6,0,0.3);">
            <strong>🚨 Active Assigned Case:</strong><br>
            <span>${escapeHtml(r.assignedSosLocation)}</span>
          </div>
        ` : ''}
      `;
      modal.style.display = 'flex';
    },
    reassign: (sosId, newRescuerId) => {
      window.ARS_State.reassignSos(sosId, newRescuerId);
    },
    readNotif: (notifId) => {
      window.ARS_State.markNotificationRead(notifId);
    }
  };
});
