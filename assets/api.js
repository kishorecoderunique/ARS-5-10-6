(function () {
  const TOKEN_KEY = 'ars_jwt';
  const API_UNAVAILABLE_MESSAGE = 'The ARS API is unavailable. Start the backend with npm.cmd run dev and open http://localhost:5000/login/.';
  let socket = null;
  const API_BASE = window.ARS_CONFIG?.API_BASE || '/api';

  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body !== undefined) headers.set('Content-Type', 'application/json');
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers.set('Authorization', `Bearer ${token}`);

    let response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
      });
    } catch (error) {
      if (error instanceof TypeError) throw new Error(API_UNAVAILABLE_MESSAGE);
      throw error;
    }

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json') || contentType.includes('+json');
    const responseText = response.status === 204 ? '' : await response.text();
    let payload = null;
    if (responseText && isJson) {
      try {
        payload = JSON.parse(responseText);
      } catch {
        throw new Error('The ARS API returned an invalid response. Please try again.');
      }
    }

    if (response.status === 401) {
      clearSession();
      if (!location.pathname.includes('/login')) location.href = '/login/index.html';
    }
    if (!response.ok) {
      if (!isJson) throw new Error(API_UNAVAILABLE_MESSAGE);
      throw new Error(payload?.error?.message || payload?.message || 'The request could not be completed.');
    }
    if (responseText && !isJson) throw new Error(API_UNAVAILABLE_MESSAGE);
    return payload;
  }

  function connectSocket() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!window.io || !token) return null;
    if (!socket) {
      socket = window.io({ auth: { token } });
      socket.on('connect_error', error => {
        if (/expired|invalid token|authentication required|no longer valid/i.test(error.message)) {
          clearSession();
          location.href = '/login/index.html';
        }
      });
    }
    return socket;
  }

  function disconnectSocket() {
    if (socket) socket.disconnect();
    socket = null;
  }

  async function checkHealth() {
    try {
      const result = await request('/health');
      return { ok: result?.ok === true || result?.status === 'ok', result };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('ars_user_data');
    disconnectSocket();
  }

  window.ARS_API = {
    API_BASE,
    request,
    checkHealth,
    connectSocket,
    disconnectSocket,
    setSession(token, user) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem('ars_user_data', JSON.stringify(user));
    },
    clearSession
  };
})();
