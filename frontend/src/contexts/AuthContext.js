import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

const ADMIN_ROLES = new Set(['admin', 'super_admin', 'financeiro', 'comercial']);
const IMPERSONATE_KEY = 'impersonation_return_token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState(false);
  const [impersonator, setImpersonator] = useState(null);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const u = await api.get('/api/auth/me');
      setUser(u);
      // Detecta se o token atual eh impersonated (decodifica sem verificar)
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.impersonated) {
          setImpersonating(true);
          setImpersonator({
            user_id: payload.impersonator_user_id,
            email: payload.impersonator_email,
            role: payload.impersonator_role,
          });
        } else {
          setImpersonating(false);
          setImpersonator(null);
        }
      } catch { /* ignore */ }
      return u;
    } catch {
      localStorage.removeItem('token');
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (email, password) => {
    const data = await api.post('/api/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    sessionStorage.removeItem(IMPERSONATE_KEY);
    setImpersonating(false);
    setImpersonator(null);
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const data = await api.post('/api/auth/register', payload);
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try { await api.post('/api/auth/logout'); } catch {}
    localStorage.removeItem('token');
    sessionStorage.removeItem(IMPERSONATE_KEY);
    setImpersonating(false);
    setImpersonator(null);
    setUser(null);
  };

  // Inicia impersonation: guarda o token atual (admin) e usa o novo token (target)
  const startImpersonation = async (targetUserId) => {
    const originalToken = localStorage.getItem('token');
    const data = await api.post(`/api/admin/users/${targetUserId}/impersonate`);
    sessionStorage.setItem(IMPERSONATE_KEY, originalToken);
    localStorage.setItem('token', data.token);
    setImpersonating(true);
    setImpersonator(data.impersonator);
    setUser(data.user);
    return data.user;
  };

  // Termina impersonation: restaura o token original
  const stopImpersonation = async () => {
    try { await api.post('/api/auth/impersonate/stop'); } catch {}
    const orig = sessionStorage.getItem(IMPERSONATE_KEY);
    if (orig) {
      localStorage.setItem('token', orig);
      sessionStorage.removeItem(IMPERSONATE_KEY);
    }
    setImpersonating(false);
    setImpersonator(null);
    await refresh();
  };

  const role = user?.role || (user ? 'customer' : null);
  const isAdmin = ADMIN_ROLES.has(role) || (user?.access_level ?? 99) <= 1;
  const isSuperAdmin = role === 'super_admin' || role === 'admin' && (user?.access_level ?? 99) === 0;
  // 'admin' legacy = super_admin se access_level == 0, senão é admin limitado
  const isSuperAdminEffective = role === 'super_admin' || (role === 'admin' && (user?.access_level ?? 99) === 0);
  const canImpersonate = ['super_admin', 'admin', 'comercial'].includes(role);
  const can = {
    integrations: isSuperAdminEffective,      // Maxx, Melhor Envio, Webhooks, settings avancadas
    financial: ['super_admin', 'admin', 'financeiro'].includes(role),
    commercial: ['super_admin', 'admin', 'comercial'].includes(role),
    impersonate: canImpersonate,
    editProducts: ['super_admin', 'admin'].includes(role),
    manageRoles: isSuperAdminEffective,
  };

  return (
    <AuthContext.Provider value={{
      user, loading, role,
      isAuthenticated: !!user, isAdmin, isSuperAdmin: isSuperAdminEffective, can,
      impersonating, impersonator,
      login, register, logout, refresh, setUser,
      startImpersonation, stopImpersonation,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
