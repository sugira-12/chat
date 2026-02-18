const CyberStorage = (() => {
  const safeRead = (store, key) => {
    try {
      return store.getItem(key);
    } catch (e) {
      return null;
    }
  };

  const safeWrite = (store, key, value) => {
    try {
      store.setItem(key, value);
    } catch (e) {
      // Ignore storage write failures.
    }
  };

  const safeRemove = (store, key) => {
    try {
      store.removeItem(key);
    } catch (e) {
      // Ignore storage remove failures.
    }
  };

  const get = (key) => {
    const sessionValue = safeRead(window.sessionStorage, key);
    if (sessionValue !== null && sessionValue !== undefined) {
      return sessionValue;
    }
    const legacy = safeRead(window.localStorage, key);
    if (legacy !== null && legacy !== undefined) {
      safeWrite(window.sessionStorage, key, legacy);
      safeRemove(window.localStorage, key);
      return legacy;
    }
    return null;
  };

  const set = (key, value) => {
    safeWrite(window.sessionStorage, key, value);
    safeRemove(window.localStorage, key);
  };

  const remove = (key) => {
    safeRemove(window.sessionStorage, key);
    safeRemove(window.localStorage, key);
  };

  const getJSON = (key) => {
    const raw = get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  };

  const setJSON = (key, value) => {
    set(key, JSON.stringify(value));
  };

  const clearAuth = () => {
    ['auth_token', 'auth_user', 'user_settings'].forEach((key) => remove(key));
  };

  return {
    get,
    set,
    getJSON,
    setJSON,
    remove,
    clearAuth,
  };
})();

window.CyberStorage = CyberStorage;

const CyberApi = (() => {
  const baseUrl = window.CYBER_CONFIG?.apiBaseUrl || 'http://localhost/cyber/php/backend/public/index.php/api';

  const request = async (path, options = {}) => {
    const token = CyberStorage.get('auth_token');
    const headers = Object.assign({
      'Content-Type': 'application/json'
    }, options.headers || {});
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });
    if (response.status === 204) return null;
    const data = await response.json();
    if (!response.ok) {
      throw data;
    }
    return data;
  };

  return { request };
})();

window.CyberApi = CyberApi;
