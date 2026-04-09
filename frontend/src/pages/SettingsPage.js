import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AppLayout, { DashCard } from '../components/layout/AppLayout';
import { Settings as SettingsIcon, Save } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const SETTINGS_FIELDS = [
  { section: 'Comissoes por Geracao (%)', fields: [
    { key: 'commission_gen_1', label: '1a Geracao', type: 'number' },
    { key: 'commission_gen_2', label: '2a Geracao', type: 'number' },
    { key: 'commission_gen_3', label: '3a Geracao', type: 'number' },
    { key: 'commission_gen_4', label: '4a Geracao', type: 'number' },
    { key: 'commission_gen_5', label: '5a Geracao', type: 'number' },
    { key: 'commission_gen_6', label: '6a Geracao', type: 'number' },
  ]},
  { section: 'Comissoes Especiais (%)', fields: [
    { key: 'nacional_commission', label: 'Comissao Nacional', type: 'number' },
    { key: 'cross_state_split', label: 'Split Cross-State (%)', type: 'number' },
  ]},
  { section: 'Financeiro', fields: [
    { key: 'min_withdrawal', label: 'Saque Minimo (R$)', type: 'number' },
    { key: 'withdrawal_fee_percent', label: 'Taxa de Saque (%)', type: 'number' },
    { key: 'commission_block_days', label: 'Dias Bloqueio Comissao', type: 'number' },
  ]},
  { section: 'Indicadores', fields: [
    { key: 'indicador_min_referrals_upgrade', label: 'Min. Indicacoes p/ Upgrade', type: 'number' },
    { key: 'unidade_indicadora_investment', label: 'Investimento Unid. Indicadora (R$)', type: 'number' },
  ]},
];

export default function SettingsPage() {
  const { token } = useAuth();
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [saved, setSaved] = useState(null);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setSettings(await res.json());
    } catch {} finally { setLoading(false); }
  };

  const handleSave = async (key, value) => {
    setSaving(key);
    try {
      const res = await fetch(`${API_URL}/api/settings`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: String(value) }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        setSaved(key);
        setTimeout(() => setSaved(null), 2000);
      }
    } catch {} finally { setSaving(null); }
  };

  if (loading) {
    return (
      <AppLayout title="Configuracoes">
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-3 border-brand-main border-t-transparent rounded-full spinner" /></div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Configuracoes" subtitle="Gerencie as configuracoes do sistema">
      <div className="space-y-6 fade-in max-w-3xl">
        {SETTINGS_FIELDS.map(section => (
          <DashCard key={section.section} title={section.section}>
            <div className="space-y-4">
              {section.fields.map(field => (
                <div key={field.key} className="flex items-center gap-4">
                  <label className="flex-1 text-sm font-medium text-txt-primary">{field.label}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type={field.type}
                      value={settings[field.key] ?? ''}
                      onChange={e => setSettings({ ...settings, [field.key]: e.target.value })}
                      className="w-24 px-3 py-2 border border-border rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand-main"
                      data-testid={`setting-${field.key}`}
                    />
                    <button
                      onClick={() => handleSave(field.key, settings[field.key])}
                      disabled={saving === field.key}
                      className={`px-3 py-2 rounded-md text-xs font-semibold transition-all ${
                        saved === field.key
                          ? 'bg-accent-green text-white'
                          : 'bg-brand-main text-white hover:bg-brand-hover'
                      }`}
                      data-testid={`save-setting-${field.key}`}
                    >
                      {saving === field.key ? '...' : saved === field.key ? 'Salvo!' : 'Salvar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </DashCard>
        ))}
      </div>
    </AppLayout>
  );
}
