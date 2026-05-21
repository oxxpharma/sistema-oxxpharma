import React, { useEffect, useState } from 'react';
import { Store, ChevronDown } from 'lucide-react';
import { api } from '../../lib/api';

/**
 * Seletor de tenant ativo no header do backoffice. Persiste a escolha em
 * localStorage('admin_tenant') e dispara um custom event para re-fetch dos
 * dashboards/relatorios. Recarrega a pagina para que o header `X-Tenant` em
 * `api.js` passe a aplicar imediatamente.
 */
export default function TenantSwitcher({ compact = false }) {
  const [tenants, setTenants] = useState([]);
  const [current, setCurrent] = useState(localStorage.getItem('admin_tenant') || 'all');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/api/admin/tenants');
        setTenants(r.items || []);
      } catch { /* nao bloqueia */ }
    })();
  }, []);

  if (!tenants || tenants.length < 2) return null;

  const change = (val) => {
    if (val === 'all') localStorage.removeItem('admin_tenant');
    else localStorage.setItem('admin_tenant', val);
    setCurrent(val);
    setOpen(false);
    // Recarrega para os componentes refazerem fetch com o novo header
    window.location.reload();
  };

  const activeLabel = current === 'all'
    ? 'Todas as marcas'
    : (tenants.find(t => t.tenant_id === current)?.name || current);
  const activeColor = current === 'all'
    ? '#666'
    : (tenants.find(t => t.tenant_id === current)?.theme?.primary_color || '#666');

  return (
    <div className="relative" data-testid="tenant-switcher">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-white hover:bg-bg-secondary transition text-sm font-semibold ${compact ? 'text-xs' : ''}`}
        title="Marca ativa"
      >
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: activeColor }} />
        <Store className="w-4 h-4 text-txt-secondary" />
        <span className="truncate max-w-[140px]">{activeLabel}</span>
        <ChevronDown className="w-3.5 h-3.5 text-txt-secondary" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-60 bg-white rounded-lg border border-border shadow-lg z-40 overflow-hidden">
            <TenantOption active={current === 'all'} onClick={() => change('all')} color="#666" name="Todas as marcas" hint="Visão consolidada" />
            {tenants.map(t => (
              <TenantOption
                key={t.tenant_id}
                active={current === t.tenant_id}
                onClick={() => change(t.tenant_id)}
                color={t?.theme?.primary_color || '#666'}
                name={t.name}
                hint={t.is_primary ? 'Marca principal' : (t.hostnames?.[0] || '')}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TenantOption({ active, onClick, color, name, hint }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 text-sm hover:bg-bg-secondary border-b border-border last:border-0 flex items-center gap-3 ${active ? 'bg-bg-secondary' : ''}`}
    >
      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <div className="font-semibold">{name}</div>
        {hint && <div className="text-xs text-txt-secondary truncate">{hint}</div>}
      </div>
      {active && <span className="text-brand-main text-xs font-bold">●</span>}
    </button>
  );
}
