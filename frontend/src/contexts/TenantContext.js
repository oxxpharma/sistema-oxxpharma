import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

const TenantContext = createContext({
  tenant: null,
  loading: true,
});

/**
 * Iter 43: TenantContext — busca o tenant atual do backend (detectado por Host)
 * e expoe via hook `useTenant()`. Aplica CSS variables para cores da marca.
 */
export function TenantProvider({ children }) {
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await api.get('/api/tenant/current');
        if (mounted) setTenant(r);
      } catch (e) {
        console.warn('[Tenant] erro ao carregar tenant atual', e);
        if (mounted) setTenant({ tenant_id: 'oxxpharma', name: 'OxxPharma', theme: {} });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Aplica cor primaria da marca em CSS vars
  useEffect(() => {
    if (!tenant?.theme?.primary_color) return;
    document.documentElement.style.setProperty('--brand-main', tenant.theme.primary_color);
    // Atualiza title da janela tambem
    if (tenant.name && document.title.indexOf(tenant.name) === -1) {
      const orig = document.title.split(' · ')[0] || document.title;
      document.title = `${orig} · ${tenant.name}`;
    }
  }, [tenant]);

  return (
    <TenantContext.Provider value={{ tenant, loading }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
