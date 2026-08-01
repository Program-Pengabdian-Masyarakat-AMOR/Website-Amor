import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, clearToken } from '../services/api';
import { closeSocket } from '../services/socket';

const AuthContext = createContext(null);

const ROLE_KEY = 'amor.role';
const USER_KEY = 'amor.username';

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => getToken());
  const [role, setRole] = useState(() => localStorage.getItem(ROLE_KEY) || null);
  const [username, setUsername] = useState(() => localStorage.getItem(USER_KEY) || null);
  const [loading, setLoading] = useState(false);

  // Sinkronkan localStorage bila state berubah dari sumber lain (mis. tab lain).
  useEffect(() => {
    function onStorage() {
      setTokenState(getToken());
      setRole(localStorage.getItem(ROLE_KEY) || null);
      setUsername(localStorage.getItem(USER_KEY) || null);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  async function login(usernameInput, password) {
    setLoading(true);
    try {
      const data = await api.post('/auth/login', { username: usernameInput, password });
      setToken(data.token);
      localStorage.setItem(ROLE_KEY, data.role);
      localStorage.setItem(USER_KEY, usernameInput);
      setTokenState(data.token);
      setRole(data.role);
      setUsername(usernameInput);
      return data;
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    closeSocket();
    clearToken();
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(USER_KEY);
    setTokenState(null);
    setRole(null);
    setUsername(null);
  }

  const value = useMemo(
    () => ({
      token,
      role,
      username,
      loading,
      isAuthenticated: Boolean(token),
      login,
      logout,
    }),
    [token, role, username, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>');
  return ctx;
}
