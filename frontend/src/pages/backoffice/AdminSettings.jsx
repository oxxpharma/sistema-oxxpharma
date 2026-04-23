import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Save, Settings as SettingsIcon, Loader2, Percent, Award, Wallet, Building2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const s = await api.get('/api/admin/settings');
      setSettings(s);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        affiliate_commission_rate: parseFloat(settings.affiliate_commission_rate),
        network1_generations: (settings.network1_generations || []).map(x => parseFloat(x) || 0),
        network2_generations: (settings.network2_generations || []).map(x => parseFloat(x) || 0),
        propaganda_threshold_referrals: parseInt(settings.propaganda_threshold_referrals, 10) || 0,
        propaganda_threshold_period_days: parseInt(settings.propaganda_threshold_period_days, 10) || 30,
        withdrawal_enabled: !!settings.withdrawal_enabled,
        withdrawal_min_amount: parseFloat(settings.withdrawal_min_amount) || 0,
        withdrawal_release_days: parseInt(settings.withdrawal_release_days, 10) || 0,
        company_name: settings.company_name || '',
        company_cnpj: settings.company_cnpj || '',
        company_address: settings.company_address || '',
        company_city: settings.company_city || '',
        company_state: settings.company_state || '',
        company_zip: settings.company_zip || '',
        company_phone: settings.company_phone || '',
        company_email: settings.company_email || '',
        invoice_prefix: settings.invoice_prefix || 'OXX',
      };
      const updated = await api.put('/api/admin/settings', payload);
      setSettings(updated);
      toast.success('Configurações salvas');
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const updateGen = (key, idx, val) => {
    const arr = [...(settings[key] || [0, 0, 0, 0, 0, 0])];
    arr[idx] = val;
    setSettings({ ...settings, [key]: arr });
  };

  if (loading || !settings) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;

  return (
    <div data-testid="admin-settings">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="font-heading font-black text-3xl text-txt-primary flex items-center gap-3"><SettingsIcon className="w-7 h-7 text-brand-main" /> Configurações</h1>
          <p className="text-sm text-txt-secondary mt-1">Comissões, promoção a Propagandista e saques.</p>
        </div>
        <Button onClick={save} loading={saving} data-testid="save-settings"><Save className="w-4 h-4" /> Salvar</Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Afiliado */}
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-heading font-black text-lg flex items-center gap-2 mb-4"><Percent className="w-5 h-5 text-brand-main" /> Comissão de afiliado (link)</h2>
          <Input
            label="Taxa sobre subtotal (ex: 0.08 = 8%)"
            type="number" step="0.001"
            value={settings.affiliate_commission_rate}
            onChange={e => setSettings({ ...settings, affiliate_commission_rate: e.target.value })}
            hint="Pago ao sponsor direto em TODA compra, independente da rede."
            data-testid="affiliate-rate"
          />
        </div>

        {/* Promoção a Propagandista */}
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-heading font-black text-lg flex items-center gap-2 mb-4"><Award className="w-5 h-5 text-brand-main" /> Critério de promoção a Propagandista</h2>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Mínimo de indicações" type="number" value={settings.propaganda_threshold_referrals} onChange={e => setSettings({ ...settings, propaganda_threshold_referrals: e.target.value })} data-testid="threshold-referrals" />
            <Input label="Período (dias)" type="number" value={settings.propaganda_threshold_period_days} onChange={e => setSettings({ ...settings, propaganda_threshold_period_days: e.target.value })} data-testid="threshold-days" />
          </div>
          <p className="text-xs text-txt-secondary mt-2">
            Clientes com ≥ {settings.propaganda_threshold_referrals} indicações nos últimos {settings.propaganda_threshold_period_days} dias aparecerão como candidatos.
          </p>
        </div>
      </div>

      {/* Rede 1 & 2 */}
      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-heading font-black text-lg mb-1">Rede 1 — Corporativa (importada)</h2>
          <p className="text-xs text-txt-secondary mb-4">Percentuais sobre subtotal da venda, por geração.</p>
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <Input
                key={`n1-${i}`}
                label={`${i + 1}ª geração (%)`}
                type="number" step="0.01"
                value={settings.network1_generations?.[i] ?? 0}
                onChange={e => updateGen('network1_generations', i, e.target.value)}
                data-testid={`n1-gen-${i + 1}`}
              />
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-heading font-black text-lg mb-1">Rede 2 — Propagandistas</h2>
          <p className="text-xs text-txt-secondary mb-4">Percentuais para usuários promovidos organicamente.</p>
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <Input
                key={`n2-${i}`}
                label={`${i + 1}ª geração (%)`}
                type="number" step="0.01"
                value={settings.network2_generations?.[i] ?? 0}
                onChange={e => updateGen('network2_generations', i, e.target.value)}
                data-testid={`n2-gen-${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Saques */}
      <div className="bg-white rounded-xl border border-border p-6 mt-6">
        <h2 className="font-heading font-black text-lg flex items-center gap-2 mb-4"><Wallet className="w-5 h-5 text-brand-main" /> Saques (PIX)</h2>
        <label className="flex items-center gap-2 text-sm mb-4">
          <input type="checkbox" checked={!!settings.withdrawal_enabled} onChange={e => setSettings({ ...settings, withdrawal_enabled: e.target.checked })} data-testid="withdrawal-enabled" />
          <span className="font-semibold">Ativar saques</span>
          <span className="text-xs text-txt-secondary">(quando ativo, usuários podem solicitar saque via PIX)</span>
        </label>
        <div className="grid md:grid-cols-2 gap-3">
          <Input label="Valor mínimo de saque (R$)" type="number" step="0.01" value={settings.withdrawal_min_amount} onChange={e => setSettings({ ...settings, withdrawal_min_amount: e.target.value })} />
          <Input label="Dias para liberação após pagamento" type="number" value={settings.withdrawal_release_days} onChange={e => setSettings({ ...settings, withdrawal_release_days: e.target.value })} hint="Tempo de quarentena antes da comissão liberar para saque" />
        </div>
      </div>

      {/* Empresa (para nota de faturamento) */}
      <div className="bg-white rounded-xl border border-border p-6 mt-6">
        <h2 className="font-heading font-black text-lg flex items-center gap-2 mb-1"><Building2 className="w-5 h-5 text-brand-main" /> Dados da empresa</h2>
        <p className="text-xs text-txt-secondary mb-4">Aparecem no cabeçalho das notas de faturamento.</p>
        <div className="grid md:grid-cols-2 gap-3">
          <Input label="Razão social" value={settings.company_name || ''} onChange={e => setSettings({ ...settings, company_name: e.target.value })} data-testid="company-name" />
          <Input label="CNPJ" value={settings.company_cnpj || ''} onChange={e => setSettings({ ...settings, company_cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
          <Input label="Endereço" className="md:col-span-2" value={settings.company_address || ''} onChange={e => setSettings({ ...settings, company_address: e.target.value })} />
          <Input label="Cidade" value={settings.company_city || ''} onChange={e => setSettings({ ...settings, company_city: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="UF" value={settings.company_state || ''} onChange={e => setSettings({ ...settings, company_state: e.target.value })} maxLength={2} />
            <Input label="CEP" value={settings.company_zip || ''} onChange={e => setSettings({ ...settings, company_zip: e.target.value })} />
          </div>
          <Input label="Telefone" value={settings.company_phone || ''} onChange={e => setSettings({ ...settings, company_phone: e.target.value })} />
          <Input label="Email" value={settings.company_email || ''} onChange={e => setSettings({ ...settings, company_email: e.target.value })} />
          <Input label="Prefixo do nº da nota" className="md:col-span-2" value={settings.invoice_prefix || ''} onChange={e => setSettings({ ...settings, invoice_prefix: e.target.value })} hint={`Exemplo atual: ${settings.invoice_prefix || 'OXX'}-000001`} />
        </div>
      </div>
    </div>
  );
}
