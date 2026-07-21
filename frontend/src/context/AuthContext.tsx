import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api, type AuthUser } from '../lib/api';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, mfaCode?: string) => Promise<{ mfaRequired?: boolean }>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const token = api.getToken();
      if (!token) {
        setUser(null);
        return;
      }
      const me = await api.get<AuthUser>('/auth/me');
      setUser(me);
    } catch {
      api.setToken(null);
      setUser(null);
    }
  };

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string, mfaCode?: string) => {
    const result = await api.post<{ accessToken?: string; user?: AuthUser; mfaRequired?: boolean }>(
      '/auth/login',
      { email, password, mfaCode }
    );
    if (result.mfaRequired) return { mfaRequired: true };
    if (result.accessToken) {
      api.setToken(result.accessToken);
      setUser(result.user!);
    }
    return {};
  };

  const register = async (email: string, password: string) => {
    await api.post('/auth/register', { email, password });
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      api.setToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
