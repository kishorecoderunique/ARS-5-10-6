/**
 * API-backed shared state adapter for existing dashboard views.
 */
window.ARS_State = (function () {
  const THEME_KEY = 'ars_theme_setting';
  const ROLE_KEY = 'ars_last_selected_role';
  let currentUser = null;
  let sosList = [];
  let rescuers = [];
  let notifications = [];
  let listeners = [];
  let bootstrapped = false;
  let refreshPromise = null;

  function formatSos(sos) {
    return {
      ...sos,
      id: String(sos.id || sos._id),
      phone: sos.victimPhone || sos.phone,
      timestamp: new Date(sos.triggeredAt || sos.timestamp).getTime(),
      severity: String(sos.severity).toLowerCase(),
      assignedRescuerId: sos.assignedRescuerId ? String(sos.assignedRescuerId) : null
    };
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
  }

  function notifyListeners(eventType) {
    listeners.forEach(callback => callback(eventType));
  }

  async function refreshData(role = currentUser?.role) {
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
      const requests = [
        window.ARS_API.request('/sos'),
        window.ARS_API.request('/notifications')
      ];
      if (role === 'admin') requests.push(window.ARS_API.request('/admin/rescuers'));
      const [sosResponse, notificationsResponse, rescuersResponse] = await Promise.all(requests);
      sosList = sosResponse.sos.map(formatSos);
      notifications = notificationsResponse.notifications.map(item => ({
        ...item,
        id: String(item.id || item._id),
        timestamp: new Date(item.timestamp || item.createdAt).getTime()
      }));
      if (rescuersResponse) {
        rescuers = rescuersResponse.rescuers.map(rescuer => ({
          ...rescuer,
          id: String(rescuer.id || rescuer._id),
          email: rescuer.email || `${rescuer.name ? rescuer.name.toLowerCase().replace(/\s+/g, '.') : rescuer.phone}@ars.rescuers.org`,
          skills: rescuer.skills || 'Search & Medical Rescue',
          location: rescuer.location || 'Chennai Sector',
          appliedDate: rescuer.appliedDate || (rescuer.createdAt ? new Date(rescuer.createdAt).toISOString().split('T')[0] : '2026-01-15'),
          approvedDate: rescuer.approvedDate || (rescuer.status === 'approved' ? (rescuer.updatedAt ? new Date(rescuer.updatedAt).toISOString().split('T')[0] : '2026-02-01') : 'Pending'),
          documents: rescuer.documents || 'National_ID_Verified.pdf',
          status: rescuer.status === 'pending'
            ? 'pending_approval'
            : rescuer.status === 'rejected' ? 'rejected'
              : rescuer.duty === 'on' ? 'on_duty' : 'off_duty',
          statusLabel: rescuer.status,
          duty: rescuer.duty,
          phone: rescuer.phone
        }));
      }
      notifyListeners('state_changed');
      return true;
    })().finally(() => {
      refreshPromise = null;
    });
    return refreshPromise;
  }

  async function bootstrap(requiredRole) {
    if (bootstrapped && currentUser?.role === requiredRole) return true;
    const savedUser = JSON.parse(localStorage.getItem('ars_user_data') || 'null');
    if (!localStorage.getItem('ars_jwt') || !savedUser) {
      redirectToLogin(requiredRole);
      return false;
    }
    try {
      const response = await window.ARS_API.request('/auth/me');
      currentUser = response.user;
      if (currentUser.role !== requiredRole) {
        window.location.href = currentUser.role === 'admin' ? '/admin/index.html' : '/rescuer/index.html';
        return false;
      }
      await refreshData(currentUser.role);
      bootstrapped = true;
      const socket = window.ARS_API.connectSocket();
      if (socket) {
        ['sos:new', 'sos:accepted', 'sos:status', 'rescuer:duty', 'notification:new'].forEach(eventName => {
          socket.on(eventName, () => refreshData(currentUser.role).catch(reportError));
        });
      }
      return true;
    } catch (error) {
      reportError(error);
      return false;
    }
  }

  function redirectToLogin(role) {
    window.ARS_API.clearSession();
    const target = role === 'admin' ? '/login/index.html?role=admin' : '/login/index.html';
    if (!window.location.pathname.includes('/login')) window.location.href = target;
  }

  function reportError(error) {
    console.error(error);
    window.dispatchEvent(new CustomEvent('ars:error', { detail: error.message }));
  }

  function action(path, options) {
    return window.ARS_API.request(path, options)
      .then(async response => {
        if (response?.user?.duty && currentUser) {
          currentUser.duty = response.user.duty;
          localStorage.setItem('ars_user_data', JSON.stringify(currentUser));
        }
        await refreshData(currentUser?.role);
        return response;
      })
      .catch(error => {
        reportError(error);
        return null;
      });
  }

  function sortedSos() {
    const rank = { high: 3, medium: 2, low: 1 };
    return [...sosList].sort((a, b) =>
      (rank[b.severity] || 0) - (rank[a.severity] || 0) || b.timestamp - a.timestamp
    );
  }

  function getPendingSosList() {
    return sortedSos().filter(item => item.status === 'pending');
  }

  function getAcceptedSosList(rescuerId = null) {
    return sortedSos().filter(item =>
      ['accepted', 'en_route', 'reached'].includes(item.status) &&
      (!rescuerId || item.assignedRescuerId === String(rescuerId))
    );
  }

  function simulateNewSos(customData = {}) {
    const locations = [
      { name: 'T. Nagar Bus Terminus', lat: 13.04, lng: 80.233 },
      { name: 'Velachery Bypass Road', lat: 12.978, lng: 80.219 },
      { name: 'Guindy Kathipara Junction', lat: 13.0075, lng: 80.205 },
      { name: 'Adyar Flyover Area', lat: 13.006, lng: 80.257 },
      { name: 'Marina Beach Lighthouse', lat: 13.0385, lng: 80.279 }
    ];
    const location = locations[Math.floor(Math.random() * locations.length)];
    return action('/sos', {
      method: 'POST',
      body: {
        victimName: customData.victimName || `Victim ${Math.floor(100 + Math.random() * 900)}`,
        victimPhone: customData.victimPhone || customData.phone || `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
        lat: Number.isFinite(Number(customData.lat)) ? Number(customData.lat) : location.lat,
        lng: Number.isFinite(Number(customData.lng)) ? Number(customData.lng) : location.lng,
        severity: customData.severity || ['High', 'Medium', 'Low'][Math.floor(Math.random() * 3)],
        description: customData.description || 'Emergency alert triggered. Immediate rescue dispatch requested.'
      }
    }).then(response => response ? formatSos(response.sos) : null);
  }

  function getCurrentUser() {
    if (!localStorage.getItem('ars_jwt')) return null;
    if (currentUser) return currentUser;
    currentUser = JSON.parse(localStorage.getItem('ars_user_data') || 'null');
    return currentUser;
  }

  function logout() {
    window.ARS_API.clearSession();
    currentUser = null;
    window.location.href = '/login/index.html';
  }

  window.addEventListener('ars:error', event => {
    const message = event.detail || 'Something went wrong.';
    const liveRegion = document.getElementById('dashboard-error');
    if (liveRegion) {
      liveRegion.textContent = message;
      liveRegion.style.display = 'block';
    } else if (!window.location.pathname.includes('/login')) {
      console.error(message);
    }
  });

  document.documentElement.setAttribute('data-theme', localStorage.getItem(THEME_KEY) || 'dark');

  return {
    bootstrap,
    refreshData,
    subscribe(callback) {
      listeners.push(callback);
      return () => { listeners = listeners.filter(item => item !== callback); };
    },
    toggleTheme() {
      const next = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem(THEME_KEY, next);
      return next;
    },
    getLastSelectedRole: () => localStorage.getItem(ROLE_KEY) || 'rescuer',
    setLastSelectedRole: role => localStorage.setItem(ROLE_KEY, role),
    async login(phone, password, role) {
      const response = await window.ARS_API.request('/auth/login', { method: 'POST', body: { phone, password, role } });
      window.ARS_API.setSession(response.token, response.user);
      currentUser = response.user;
      localStorage.setItem(ROLE_KEY, role);
      bootstrapped = false;
      return { success: true, user: response.user };
    },
    async registerRescuer(name, phone, password) {
      await window.ARS_API.request('/auth/signup', { method: 'POST', body: { name, phone, password } });
      return { success: true };
    },
    logout,
    getCurrentUser,
    escapeHtml,
    requireAuth(role) {
      const user = getCurrentUser();
      if (!user || !localStorage.getItem('ars_jwt')) {
        redirectToLogin(role);
        return false;
      }
      if (role && user.role !== role) {
        window.location.href = user.role === 'admin' ? '/admin/index.html' : '/rescuer/index.html';
        return false;
      }
      return true;
    },
    getSortedSosList: sortedSos,
    getPendingSosList,
    getAcceptedSosList,
    getHistorySosList: () => sortedSos().filter(item => item.status === 'resolved'),
    getRescuers: () => [...rescuers],
    getNotifications: () => [...notifications],
    acceptSos(id) {
      return action(`/sos/${encodeURIComponent(id)}/accept`, { method: 'PATCH' });
    },
    advanceSosStatus(id) {
      const sos = sosList.find(item => item.id === String(id));
      const nextStatus = { accepted: 'en_route', en_route: 'reached', reached: 'resolved' }[sos?.status];
      if (!nextStatus) return Promise.reject(new Error('This SOS cannot advance to another status.'));
      return action(`/sos/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status: nextStatus } });
    },
    simulateNewSos,
    approveRescuer(id) {
      return action(`/admin/rescuers/${encodeURIComponent(id)}/approve`, { method: 'PATCH' });
    },
    rejectRescuer(id) {
      return action(`/admin/rescuers/${encodeURIComponent(id)}/reject`, { method: 'PATCH' });
    },
    deactivateRescuer(id) {
      return action(`/admin/rescuers/${encodeURIComponent(id)}/reject`, { method: 'PATCH' });
    },
    reassignSos(id, rescuerId) {
      return action(`/admin/sos/${encodeURIComponent(id)}/assign`, { method: 'PATCH', body: { rescuerId: rescuerId || null } });
    },
    markNotificationRead(id) {
      return action(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
    },
    markAllNotificationsRead() {
      return action('/notifications/read-all', { method: 'PATCH' });
    },
    setDuty(duty) {
      return action('/users/duty', { method: 'PATCH', body: { duty } });
    },
    formatTimeAgo(timestamp) {
      const seconds = Math.max(0, Math.floor((Date.now() - Number(timestamp)) / 1000));
      if (seconds < 60) return `${seconds}s ago`;
      const minutes = Math.floor(seconds / 60);
      return minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
    }
  };
})();
