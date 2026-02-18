const CyberAuth = (() => {
  const saveToken = (token) => CyberStorage.set('auth_token', token);
  const saveUser = (user) => CyberStorage.set('auth_user', JSON.stringify(user));

  const login = async (email, password) => {
    const data = await CyberApi.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    saveToken(data.token);
    saveUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const data = await CyberApi.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    saveToken(data.token);
    saveUser(data.user);
    return data;
  };

  const logout = async () => {
    const token = CyberStorage.get('auth_token');
    try {
      if (token) {
        await CyberApi.request('/auth/logout', { method: 'POST' });
      }
    } catch (err) {
      // Ignore logout failures to avoid blocking UI.
    }
    CyberStorage.clearAuth();
  };

  return { login, register, logout };
})();

window.CyberAuth = CyberAuth;
