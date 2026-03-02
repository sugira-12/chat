import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { http, setAuthToken } from '../lib/http.js';

const AuthContext = createContext(null);

const storageKey = 'cyber_token';
const userKey = 'cyber_user';

const readJson = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem(storageKey) || '');
  const [user, setUser] = useState(() => readJson(userKey));
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    setAuthToken(token || '');
    if (token) localStorage.setItem(storageKey, token);
    else localStorage.removeItem(storageKey);
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(userKey, JSON.stringify(user));
    } else {
      localStorage.removeItem(userKey);
    }
  }, [user]);

  const api = useMemo(() => {
    const login = async (email, password) => {
      const resp = await http.post('/auth/login', { email, password });
      setToken(resp.data.token || '');
      setUser(resp.data.user || null);
      return resp.data;
    };

    const register = async (payload) => {
      const resp = await http.post('/auth/register', payload);
      setToken(resp.data.token || '');
      setUser(resp.data.user || null);
      return resp.data;
    };

    const logout = async () => {
      try {
        await http.post('/auth/logout');
      } catch (e) {
        // ignore
      } finally {
        setToken('');
        setUser(null);
      }
    };

    const refreshMe = async () => {
      if (!token) return null;
      const resp = await http.get('/auth/me');
      setUser(resp.data.user || null);
      return resp.data.user || null;
    };

    return { token, user, booting, login, register, logout, refreshMe };
  }, [token, user, booting]);

  useEffect(() => {
    (async () => {
      try {
        if (token) {
          await api.refreshMe();
        }
      } catch (e) {
        setToken('');
        setUser(null);
      } finally {
        setBooting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('AuthProvider missing');
  return ctx;
};

