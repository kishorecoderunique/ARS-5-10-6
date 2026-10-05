/**
 * ARS - Disaster Rescue & SOS Management System
 * Admin Dashboard Controller (/assets/js/admin-dashboard.js)
 * Rescue Radar Engine
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (!await window.ARS_State.bootstrap('admin')) return;

  const currentUser = window.ARS_State.getCurrentUser();
  let currentTab = 'overview';
  let severityFilter = 'all';
  let statusFilter = 'all';

  // DOM Elements
  const activeCountElem = document.getElementById('active-sos-count');
  const notifCountElem = document.getElementById('notif-unread-count');
  const notifListElem = document.getElementById('notif-list');
  const notifDropdown = document.getElementById('notif-dropdown');
  const notifBellBtn = document.getElementById('notif-bell-btn');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const signoutBtn = document.getElementById('signout-btn');
  const simulateSosBtn = document.getElementById('simulate-sos-btn');

  // Summary Tile Counters
  const tileTotalSos = document.getElementById('tile-total-sos');
  const tilePendingSos = document.getElementById('tile-pending-sos');
  const tileAcceptedSos = document.getElementById('tile-accepted-sos');
  const tileResolvedSos = document.getElementById('tile-resolved-sos');
  const tileOnDutyRescuers = document.getElementById('tile-onduty-rescuers');

  // Content Views
  const rescuerRosterElem = document.getElementById('rescuer-roster-container');
  const pendingApprovalsElem = document.getElementById('pending-approvals-container');
  const sosTableBodyElem = document.getElementById('sos-table-body');
  const severityFilterElem = document.getElementById('severity-filter');
  const statusFilterElem = document.getElementById('status-filter');

  // Sidebar Tabs
  const sidebarItems = document.querySelectorAll('.sidebar-item');
  sidebarItems.forEach(item => {
    item.addEventListener('click', () => {
      sidebarItems.forEach(s => s.classList.remove('active'));
      item.classList.add('active');
      currentTab = item.dataset.tab;
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
      notifDropdown.classList.toggle('active');
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

  // Mobile Sidebar Toggle
  const mobileToggleBtn = document.getElementById('mobile-sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  if (mobileToggleBtn && sidebar) {
    mobileToggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('active');
    });
  }

  // --- Initialize Map Engine in Admin Mode ---
  window.ARS_MapManager.initMap('admin-map-canvas', {
    mode: 'admin',
    onMarkerClick: (sos) => {
      highlightSosTableRow(sos.id);
    }
  });

  // --- Subscribe to State Bus ---
  window.ARS_State.subscribe(() => {
    renderAdminDashboard();
    window.ARS_MapManager.updateMarkers();
  });

  // Initial Render
  renderAdminDashboard();

  function renderAdminDashboard() {
    updateMetrics();
    renderNotifications();
    renderRescuerRoster();
    renderPendingApprovals();
    renderSosTable();
  }

  function updateMetrics() {
    const sosList = window.ARS_State.getSortedSosList();
    const rescuers = window.ARS_State.getRescuers();

    const pendingCount = sosList.filter(s => s.status === 'pending').length;
    const acceptedCount = sosList.filter(s => ['accepted', 'en_route', 'reached'].includes(s.status)).length;
    const resolvedCount = sosList.filter(s => s.status === 'resolved').length;
    const onDutyCount = rescuers.filter(r => ['on_duty', 'on_case'].includes(r.status)).length;

    if (activeCountElem) activeCountElem.textContent = `${pendingCount} Pending`;

    if (tileTotalSos) tileTotalSos.textContent = sosList.length;
    if (tilePendingSos) tilePendingSos.textContent = pendingCount;
    if (tileAcceptedSos) tileAcceptedSos.textContent = acceptedCount;
    if (tileResolvedSos) tileResolvedSos.textContent = resolvedCount;
    if (tileOnDutyRescuers) tileOnDutyRescuers.textContent = onDutyCount;

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

  function renderRescuerRoster() {
    if (!rescuerRosterElem) return;
    const escapeHtml = window.ARS_State.escapeHtml;
    const rescuers = window.ARS_State.getRescuers().filter(r => r.statusLabel === 'approved');

    rescuerRosterElem.innerHTML = rescuers.map(r => `
      <div class="squircle-card" style="padding: 14px 18px; display: flex; align-items: center; justify-content: space-between;">
        <div>
          <div style="font-weight: 700; font-size: 0.95rem;">${escapeHtml(r.name)}</div>
          <div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-secondary);">${escapeHtml(r.phone)}</div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
          <span class="status-chip status-${r.status}">
            <span class="status-chip-dot"></span>
            ${r.status.replace('_', ' ')}
          </span>
          <span style="font-size: 0.78rem; color: var(--text-muted);">
            ${r.assignedSosLocation ? `Assigned: ${escapeHtml(r.assignedSosLocation)}` : 'Available'}
          </span>
        </div>
      </div>
    `).join('');
  }

  function renderPendingApprovals() {
    if (!pendingApprovalsElem) return;
    const escapeHtml = window.ARS_State.escapeHtml;
    const pendingRescuers = window.ARS_State.getRescuers().filter(r => r.status === 'pending_approval');

    if (pendingRescuers.length === 0) {
      pendingApprovalsElem.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">No pending rescuer approval requests.</div>`;
      return;
    }

    pendingApprovalsElem.innerHTML = pendingRescuers.map(r => `
      <div class="squircle-card" style="padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; border-color: rgba(255, 138, 0, 0.4);">
        <div>
          <div style="font-weight: 700;">${escapeHtml(r.name)}</div>
          <div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-secondary);">${escapeHtml(r.phone)}</div>
        </div>
        <button class="btn-primary" style="padding: 8px 16px; font-size: 0.8rem;" onclick="window.ARS_AdminDash.approve('${r.id}')">
          Approve User
        </button>
      </div>
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
    reassign: (sosId, newRescuerId) => {
      window.ARS_State.reassignSos(sosId, newRescuerId);
    },
    readNotif: (notifId) => {
      window.ARS_State.markNotificationRead(notifId);
    }
  };
});
