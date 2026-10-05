/**
 * ARS - Disaster Rescue & SOS Management System
 * Rescuer Dashboard Controller (/assets/js/rescuer-dashboard.js)
 * Rescue Radar Engine
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (!await window.ARS_State.bootstrap('rescuer')) return;

  const currentUser = window.ARS_State.getCurrentUser();
  let currentTab = 'dashboard';
  let liveTimerInterval = null;

  // DOM Elements
  const activeCountElem = document.getElementById('active-sos-count');
  const notifCountElem = document.getElementById('notif-unread-count');
  const notifListElem = document.getElementById('notif-list');
  const notifDropdown = document.getElementById('notif-dropdown');
  const notifBellBtn = document.getElementById('notif-bell-btn');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const signoutBtn = document.getElementById('signout-btn');
  const sosCardsContainer = document.getElementById('sos-cards-container');
  const tabTitleElem = document.getElementById('tab-title');
  const simulateSosBtn = document.getElementById('simulate-sos-btn');

  // Sidebar Tabs
  const sidebarItems = document.querySelectorAll('.sidebar-item');
  sidebarItems.forEach(item => {
    item.addEventListener('click', () => {
      sidebarItems.forEach(s => s.classList.remove('active'));
      item.classList.add('active');
        currentTab = item.dataset.tab;
      updateTabTitle();
      renderSosCards();
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

  // Mobile Sidebar Toggle
  const mobileToggleBtn = document.getElementById('mobile-sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  if (mobileToggleBtn && sidebar) {
    mobileToggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('active');
    });
  }

  // --- Initialize Map Engine ---
  window.ARS_MapManager.initMap('map-canvas', {
    mode: 'rescuer',
    onMarkerClick: (sos) => {
      highlightSosCard(sos.id);
    }
  });

  // --- Subscribe to State Bus Updates ---
  window.ARS_State.subscribe(() => {
    updateTopBarMetrics();
    renderNotifications();
    renderSosCards();
    window.ARS_MapManager.updateMarkers();
  });

  // Live timer loop
  if (liveTimerInterval) clearInterval(liveTimerInterval);
  liveTimerInterval = setInterval(() => {
    updateLiveTimers();
  }, 1000);

  // Initial Render
  updateTopBarMetrics();
  renderNotifications();
  renderSosCards();

  function updateTabTitle() {
    const titles = {
      dashboard: 'Dashboard Overview',
      active_sos: 'Active Emergency SOS Requests',
      accepted_cases: 'My Accepted Rescue Cases',
      history: 'Resolved Rescue History',
      profile: 'Rescuer Profile'
    };
    if (tabTitleElem) {
      tabTitleElem.textContent = titles[currentTab] || 'SOS Requests';
    }
  }

  function updateTopBarMetrics() {
    const pending = window.ARS_State.getPendingSosList();
    if (activeCountElem) {
      activeCountElem.textContent = `${pending.length} Active`;
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
      notifListElem.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted);">No notifications yet.</div>`;
      return;
    }

    notifListElem.innerHTML = notifs.map(n => `
      <div class="notif-item ${!n.read ? 'unread' : ''}" onclick="window.ARS_RescuerDash.readNotif('${n.id}')">
        <div class="notif-title">
          <span>${escapeHtml(n.title)}</span>
          <span class="notif-time">${window.ARS_State.formatTimeAgo(n.timestamp)}</span>
        </div>
        <div class="notif-body">${escapeHtml(n.message)}</div>
      </div>
    `).join('');
  }

  function renderSosCards() {
    if (!sosCardsContainer) return;

    let items = [];
    if (currentTab === 'dashboard' || currentTab === 'active_sos') {
      items = window.ARS_State.getPendingSosList();
    } else if (currentTab === 'accepted_cases') {
      items = window.ARS_State.getAcceptedSosList(currentUser.id);
    } else if (currentTab === 'history') {
      items = window.ARS_State.getHistorySosList();
    } else if (currentTab === 'profile') {
      renderProfileView();
      return;
    }

    if (items.length === 0) {
      sosCardsContainer.innerHTML = `
        <div class="squircle-card" style="padding: 40px; text-align: center; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 8px;">🛡️</div>
          <div style="font-family: var(--font-heading); font-size: 1.1rem; color: var(--text-primary); margin-bottom: 4px;">No SOS Cases Found</div>
          <div>There are currently no active emergency requests in this category.</div>
        </div>
      `;
      return;
    }

    sosCardsContainer.innerHTML = items.map(sos => renderSingleSosCard(sos)).join('');

    // Attach Press-and-Hold Listeners
    items.forEach(sos => {
      if (sos.status === 'pending') {
        const btn = document.getElementById(`hold-btn-${sos.id}`);
        if (btn) {
          attachPressAndHoldListener(btn, sos.id);
        }
      }
    });
  }

  function renderSingleSosCard(sos) {
    const escapeHtml = window.ARS_State.escapeHtml;
    const isAccepted = ['accepted', 'en_route', 'reached'].includes(sos.status);

    return `
      <div class="sos-card" id="sos-card-${sos.id}" onclick="window.ARS_MapManager.highlightAndZoomToSos('${sos.id}')">
        <div class="sos-card-header">
          <div class="victim-meta">
            <span class="victim-name">${escapeHtml(sos.victimName)}</span>
            <span class="victim-phone">${escapeHtml(sos.phone)}</span>
          </div>
          <div class="severity-badge severity-${sos.severity}">
            <span class="siren-lamp-dot"></span>
            <span>${sos.severity}</span>
          </div>
        </div>

        <div class="sos-location-row">
          <svg class="location-pin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <span style="font-weight: 600; color: var(--text-primary);">${escapeHtml(sos.locationName)}</span>
        </div>

        <div style="display: flex; gap: 8px; align-items: center;">
          <span class="coordinates-badge">Lat: ${sos.lat.toFixed(4)}, Lng: ${sos.lng.toFixed(4)}</span>
        </div>

        <div style="font-size: 0.88rem; color: var(--text-secondary); background: var(--bg-input); padding: 10px 14px; border-radius: var(--radius-sm);">
          "${escapeHtml(sos.description)}"
        </div>

        <div class="sos-timer-row">
          <span>Triggered:</span>
          <span class="live-timer-val" id="timer-${sos.id}">${window.ARS_State.formatTimeAgo(sos.timestamp)}</span>
        </div>

        ${!isAccepted && sos.status === 'pending' ? `
          <div class="btn-hold-accept" id="hold-btn-${sos.id}">
            <div class="hold-progress-fill" id="hold-fill-${sos.id}"></div>
            <svg class="hold-ring-svg" viewBox="0 0 24 24" fill="none">
              <circle class="hold-ring-bg" cx="12" cy="12" r="9.5"></circle>
              <circle class="hold-ring-fill" id="hold-ring-${sos.id}" cx="12" cy="12" r="9.5"></circle>
            </svg>
            <span>PRESS & HOLD (1s) TO ACCEPT</span>
          </div>
        ` : ''}

        ${isAccepted ? `
          <div style="margin-top: 8px;">
            ${renderStatusStepper(sos)}
            <div style="display: flex; gap: 10px; margin-top: 14px;">
              <button class="btn-primary" style="flex: 1; padding: 10px 16px; font-size: 0.88rem;" onclick="event.stopPropagation(); window.ARS_RescuerDash.advanceStatus('${sos.id}')">
                ${getNextStepLabel(sos.status)}
              </button>
              <button type="button" class="btn-secondary" style="padding: 10px 16px; font-size: 0.88rem;" onclick="event.stopPropagation(); window.ARS_MapManager.showDirectionsToSos('${sos.id}')">
                🗺️ Show Route
              </button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderStatusStepper(sos) {
    const steps = ['accepted', 'en_route', 'reached', 'resolved'];
    const currentIdx = steps.indexOf(sos.status);

    return `
      <div class="status-stepper">
        ${steps.map((step, idx) => {
          const isDone = idx < currentIdx;
          const isActive = idx === currentIdx;
          const label = step.replace('_', ' ').toUpperCase();
          return `
            <div class="stepper-step ${isDone ? 'completed' : ''} ${isActive ? 'active' : ''}">
              <div class="stepper-node">${idx + 1}</div>
              <span>${label}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function getNextStepLabel(status) {
    switch (status) {
      case 'accepted': return '🚀 Mark En Route';
      case 'en_route': return '📍 Mark Reached Location';
      case 'reached': return '✅ Mark Resolved';
      default: return 'Case Complete';
    }
  }

  function renderProfileView() {
    const escapeHtml = window.ARS_State.escapeHtml;
    const isOnDuty = currentUser.duty === 'on';
    sosCardsContainer.innerHTML = `
      <div class="squircle-card" style="padding: 32px;">
        <div style="font-family: var(--font-heading); font-size: 1.4rem; font-weight: 800; margin-bottom: 16px;">Rescuer Profile</div>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div><strong style="color: var(--text-secondary);">Name:</strong> ${escapeHtml(currentUser.name)}</div>
          <div><strong style="color: var(--text-secondary);">Phone:</strong> ${escapeHtml(currentUser.phone)}</div>
          <div><strong style="color: var(--text-secondary);">Role:</strong> Field Rescuer (Emergency Response Unit)</div>
          <div><strong style="color: var(--text-secondary);">Status:</strong> <span class="status-chip ${isOnDuty ? 'status-on_duty' : 'status-off_duty'}"><span class="status-chip-dot"></span> ${isOnDuty ? 'On Duty' : 'Off Duty'}</span></div>
          <button type="button" class="btn-secondary" style="align-self: flex-start;" onclick="window.ARS_RescuerDash.toggleDuty()">
            Set ${isOnDuty ? 'Off' : 'On'} Duty
          </button>
        </div>
      </div>
    `;
  }

  function attachPressAndHoldListener(btn, sosId) {
    let holdTimer = null;
    let startTime = 0;
    const holdDuration = 1000;
    const fillElem = document.getElementById(`hold-fill-${sosId}`);
    const ringElem = document.getElementById(`hold-ring-${sosId}`);

    function startHold(e) {
      e.preventDefault();
      e.stopPropagation();
      startTime = Date.now();

      holdTimer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / holdDuration, 1);

        if (fillElem) fillElem.style.width = `${progress * 100}%`;
        if (ringElem) ringElem.style.strokeDashoffset = `${60 - (progress * 60)}`;

        if (elapsed >= holdDuration) {
          clearInterval(holdTimer);
          window.ARS_State.acceptSos(sosId).catch(() => {});
        }
      }, 30);
    }

    function cancelHold() {
      if (holdTimer) clearInterval(holdTimer);
      if (fillElem) fillElem.style.width = '0%';
      if (ringElem) ringElem.style.strokeDashoffset = '60';
    }

    btn.addEventListener('mousedown', startHold);
    btn.addEventListener('mouseup', cancelHold);
    btn.addEventListener('mouseleave', cancelHold);

    btn.addEventListener('touchstart', startHold, { passive: false });
    btn.addEventListener('touchend', cancelHold);
    btn.addEventListener('touchcancel', cancelHold);
  }

  function updateLiveTimers() {
    const sosList = window.ARS_State.getSortedSosList();
    sosList.forEach(sos => {
      const timerElem = document.getElementById(`timer-${sos.id}`);
      if (timerElem) {
        timerElem.textContent = window.ARS_State.formatTimeAgo(sos.timestamp);
      }
    });
  }

  function highlightSosCard(sosId) {
    const card = document.getElementById(`sos-card-${sosId}`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.style.borderColor = 'var(--siren-red)';
      card.style.boxShadow = 'var(--shadow-red-glow)';
      setTimeout(() => {
        card.style.borderColor = '';
        card.style.boxShadow = '';
      }, 2000);
    }
  }

  window.ARS_RescuerDash = {
    advanceStatus: (sosId) => {
      window.ARS_State.advanceSosStatus(sosId);
    },
    toggleDuty: () => {
      const nextDuty = currentUser.duty === 'on' ? 'off' : 'on';
      window.ARS_State.setDuty(nextDuty);
    },
    readNotif: (notifId) => {
      window.ARS_State.markNotificationRead(notifId);
    }
  };
});
