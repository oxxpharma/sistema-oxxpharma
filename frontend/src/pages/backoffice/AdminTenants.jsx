import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { toast } from 'sonner';
import { Store, Globe, AlertTriangle, Loader2, Save, GitMerge } from 'lucide-react';

export default function AdminTenants() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [brandsUnified, setBrandsUnified] = useState(false);
  const [savingUnified, setSavingUnified] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/admin/tenants');
      setTenants(r.items || []);
      setBrandsUnified(!!r.brands_unified);
    } catch (e) {
      toast.error('Erro ao carregar: ' + (e.message || e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const updateTenant = async (tenantId, patch) => {
    try {
      await api.put(`/api/admin/tenants/${tenantId}`, patch);
      toast.success('Marca atualizada');
      load();
    } catch (e) { toast.error(e.message); }
  };

  const toggleUnified = async () => {
    if (!brandsUnified) {
      if (!window.confirm('Ativar a fusão das marcas? Todo acesso pelo domínio Pharmakon passará a exibir a OxxPharma.')) return;
    }
    setSavingUnified(true);
    try {
      const r = await api.put('/api/admin/brands-unified', { enabled: !brandsUnified });
      setBrandsUnified(r.enabled);
      toast.success(r.enabled ? 'Fusão das marcas ATIVADA' : 'Fusão DESATIVADA');
    } catch (e) {
      toast.error('Erro: ' + (e.message || e));
    } finally {
      setSavingUnified(false);
    }
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;

  return (
    <div className="space-y-6" data-testid="admin-tenants">
      <div>
        <h1 className="font-heading font-black text-2xl">Marcas (multi-tenant)</h1>
        <p className="text-sm text-txt-secondary mt-1">
          Configure as marcas do grupo. Cada marca tem seu próprio domínio, identidade visual e relatórios. O banco de dados é único.
        </p>
      </div>

      {/* Toggle de unificação */}
      <div className={`rounded-2xl border-2 p-5 ${brandsUnified ? 'border-amber-300 bg-amber-50' : 'border-border bg-white'}`}>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${brandsUnified ? 'bg-amber-200 text-amber-800' : 'bg-bg-secondary text-txt-secondary'}`}>
            <GitMerge className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h2 className="font-heading font-black text-lg">Fusão das marcas</h2>
            <p className="text-sm text-txt-secondary mt-1">
              Quando ativado, <strong>todo o tráfego é forçado para a marca principal</strong> (OxxPharma). Os dominios secundários (Pharmakon) passam a redirecionar/exibir a OxxPharma. Use isso quando concluir a unificação das marcas.
            </p>
            {brandsUnified && (
              <div className="mt-3 flex items-start gap-2 text-sm text-amber-900 bg-amber-100 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>Fusão ATIVA. Pharmakon não está mais sendo servido — todos os visitantes veem OxxPharma.</div>
              </div>
            )}
          </div>
          <Button onClick={toggleUnified} loading={savingUnified} variant={brandsUnified ? 'outline' : 'default'} data-testid="toggle-unified">
            {brandsUnified ? 'Desativar fusão' : 'Ativar fusão'}
          </Button>
        </div>
      </div>

      {/* Lista de tenants */}
      <div className="space-y-4">
        {tenants.map(t => (
          <TenantCard key={t.tenant_id} tenant={t} onSave={(patch) => updateTenant(t.tenant_id, patch)} />
        ))}
      </div>
    </div>
  );
}

function TenantCard({ tenant, onSave }) {
  const [form, setForm] = useState({
    name: tenant.name || '',
    short_name: tenant.short_name || '',
    hostnames: (tenant.hostnames || []).join('\n'),
    active: tenant.active !== false,
    benefits_program_label: tenant.benefits_program_label || '',
    theme: tenant.theme || {},
    email: tenant.email || {},
  });

  const save = () => {
    onSave({
      ...form,
      hostnames: form.hostnames.split('\n').map(s => s.trim().toLowerCase()).filter(Boolean),
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-border p-5" data-testid={`tenant-card-${tenant.tenant_id}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: form.theme?.primary_color || '#666' }}>
          <Store className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-heading font-black text-lg">{tenant.name}</h3>
          <div className="text-xs text-txt-secondary font-mono">{tenant.tenant_id}{tenant.is_primary && ' · principal'}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <Input label="Nome de exibição" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <Input label="Nome curto" value={form.short_name} onChange={e => setForm({ ...form, short_name: e.target.value })} />
        <Input label="Cor primária" type="text" value={form.theme?.primary_color || ''} onChange={e => setForm({ ...form, theme: { ...form.theme, primary_color: e.target.value } })} placeholder="#E8731A" />
        <Input label="Logo URL" value={form.theme?.logo_url || ''} onChange={e => setForm({ ...form, theme: { ...form.theme, logo_url: e.target.value } })} />
        <Input label="Nome do Programa de Benefícios" value={form.benefits_program_label} onChange={e => setForm({ ...form, benefits_program_label: e.target.value })} placeholder="Ex: Clube Pharmakon" />
        <Input label="Email remetente (from)" value={form.email?.from_email || ''} onChange={e => setForm({ ...form, email: { ...form.email, from_email: e.target.value } })} placeholder="noreply@oxxpharma.com.br" />
      </div>

      <div className="mb-3">
        <label className="text-xs font-bold text-txt-secondary block mb-1.5 flex items-center gap-1"><Globe className="w-3 h-3" /> Domínios (um por linha)</label>
        <textarea
          rows={3}
          value={form.hostnames}
          onChange={e => setForm({ ...form, hostnames: e.target.value })}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono"
          placeholder="www.oxxpharma.com.br
oxxpharma.com.br"
        />
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
          Marca ativa
        </label>
        <Button onClick={save} size="sm" data-testid={`save-tenant-${tenant.tenant_id}`}>
          <Save className="w-4 h-4" /> Salvar
        </Button>
      </div>
    </div>
  );
}
