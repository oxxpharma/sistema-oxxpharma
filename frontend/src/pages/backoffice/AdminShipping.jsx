import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Truck, Loader2, Save, PlusCircle, Trash2, Play, RefreshCw, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDateTime } from '../../lib/utils';

const COMMON_SERVICES = [
  { code: '03298', label: 'PAC' },
  { code: '03220', label: 'SEDEX' },
  { code: '03158', label: 'PAC Mini' },
  { code: '03212', label: 'SEDEX Hoje' },
  { code: '03247', label: 'SEDEX 12' },
  { code: '03204', label: 'SEDEX 10' },
];

export default function AdminShipping() {
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('config');
  const [logs, setLogs] = useState([]);
  const [test, setTest] = useState({ cep: '', weight: 0.5, result: null, running: false });
  const [authTesting, setAuthTesting] = useState(false);
  const [authResult, setAuthResult] = useState(null);

  const testAuth = async () => {
    setAuthTesting(true);
    setAuthResult(null);
    try {
      const r = await api.post('/api/admin/correios-test-auth');
      setAuthResult(r);
      if (r.ok) toast.success('Autenticado com sucesso');
      else toast.error('Falha na autenticação');
    } catch (e) {
      setAuthResult({ ok: false, error: e?.message || 'Erro' });
      toast.error(e?.message || 'Erro');
    } finally { setAuthTesting(false); }
  };

  const load = async () => {
    try {
      const r = await api.get('/api/admin/correios-config');
      setCfg(r);
    } finally { setLoading(false); }
  };
  const loadLogs = async () => {
    try {
      const r = await api.get('/api/admin/correios-logs');
      setLogs(r.logs || []);
    } catch (e) { toast.error(e?.message); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === 'logs') loadLogs(); }, [tab]);

  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));
  const setService = (i, patch) => setCfg(c => ({ ...c, correios_services: c.correios_services.map((s, idx) => idx === i ? { ...s, ...patch } : s) }));
  const removeService = (i) => setCfg(c => ({ ...c, correios_services: c.correios_services.filter((_, idx) => idx !== i) }));
  const addService = () => setCfg(c => ({ ...c, correios_services: [...(c.correios_services || []), { code: '', label: '' }] }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...cfg };
      delete payload.updated_at;
      await api.put('/api/admin/correios-config', payload);
      toast.success('Configuração salva');
      await load();
    } catch (e) { toast.error(e?.message); }
    finally { setSaving(false); }
  };

  const runTest = async () => {
    if (!test.cep) { toast.error('Informe um CEP'); return; }
    setTest(t => ({ ...t, running: true, result: null }));
    try {
      const r = await api.post('/api/admin/correios-test', { cep_destination: test.cep, weight: parseFloat(test.weight || 0.5) });
      setTest(t => ({ ...t, result: r, running: false }));
    } catch (e) {
      toast.error(e?.message);
      setTest(t => ({ ...t, running: false }));
    }
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;
  if (!cfg) return null;

  return (
    <div data-testid="admin-shipping">
      <div className="mb-6">
        <h1 className="font-heading font-black text-2xl flex items-center gap-3">
          <Truck className="w-7 h-7 text-brand-main" /> Frete (Correios)
        </h1>
        <p className="text-sm text-txt-secondary mt-1">Configure CEP de origem, contrato Correios, serviços (PAC/SEDEX) e retirada local. As credenciais são salvas no banco.</p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-border">
        {['config', 'test', 'logs'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition ${tab === t ? 'border-brand-main text-brand-main' : 'border-transparent text-txt-secondary hover:text-txt-primary'}`}
            data-testid={`tab-${t}`}>
            {t === 'config' ? 'Configuração' : t === 'test' ? 'Testar' : 'Logs'}
          </button>
        ))}
      </div>

      {tab === 'config' && (
        <div className="space-y-4 max-w-3xl">
          <Card>
            <h3 className="font-heading font-bold mb-3">Ambiente CWS Correios</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button onClick={() => set('correios_environment', 'homologacao')}
                className={`text-left p-4 rounded-xl border-2 transition ${cfg.correios_environment === 'homologacao' ? 'border-brand-main bg-brand-light' : 'border-border'}`}
                data-testid="env-homologacao-btn">
                <div className="flex justify-between mb-1">
                  <Badge variant="warning">Homologação</Badge>
                  {cfg.correios_environment === 'homologacao' && <Badge variant="brand">ATIVO</Badge>}
                </div>
                <div className="text-xs text-txt-secondary">apihom.correios.com.br — testes sem cobrança</div>
              </button>
              <button onClick={() => set('correios_environment', 'producao')}
                className={`text-left p-4 rounded-xl border-2 transition ${cfg.correios_environment === 'producao' ? 'border-red-500 bg-red-50' : 'border-border'}`}
                data-testid="env-producao-btn">
                <div className="flex justify-between mb-1">
                  <Badge variant="error">Produção</Badge>
                  {cfg.correios_environment === 'producao' && <Badge variant="error">ATIVO</Badge>}
                </div>
                <div className="text-xs text-txt-secondary">api.correios.com.br — postagens reais</div>
              </button>
            </div>
            <p className="text-xs text-txt-secondary">⚠️ Lembre de salvar após mudar o ambiente.</p>
          </Card>

          <Card>
            <h3 className="font-heading font-bold mb-1">Credenciais CWS (Bearer Token)</h3>
            <p className="text-xs text-txt-secondary mb-3">Autenticação por <b>Contrato</b>. Gere o "código de acesso" no portal CWS dos Correios.</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Usuário (login Meu Correios)" value={cfg.correios_user} onChange={(v) => set('correios_user', v)} placeholder="seu_usuario" testId="cfg-user" />
              <Field label="Código de acesso (CWS)" value={cfg.correios_api_code} onChange={(v) => set('correios_api_code', v)} type="password" placeholder="••••••••" testId="cfg-api-code" />
              <Field label="Número do contrato" value={cfg.correios_contract} onChange={(v) => set('correios_contract', v)} placeholder="9999999999" testId="cfg-contract" />
              <Field label="CEP de origem" value={cfg.correios_origin_cep} onChange={(v) => set('correios_origin_cep', v)} placeholder="01310-100" testId="cfg-origin-cep" />
            </div>
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={testAuth} disabled={authTesting} data-testid="test-auth-btn">
                {authTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Testar autenticação
              </Button>
              {authResult && (
                <div className={`mt-3 p-3 rounded text-xs ${authResult.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`} data-testid="auth-result">
                  {authResult.ok
                    ? <>✓ Autenticado em <b>{authResult.environment}</b>. Token expira em {authResult.expires_at?.slice(0, 19).replace('T', ' ')}</>
                    : <>✗ {authResult.error}</>}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-heading font-bold">Status</h3>
                <p className="text-xs text-txt-secondary">Habilita cálculo automático nos checkouts.</p>
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!cfg.correios_enabled} onChange={(e) => set('correios_enabled', e.target.checked)} className="w-5 h-5 accent-brand-main" data-testid="toggle-correios" />
                <span className="text-sm font-semibold">{cfg.correios_enabled ? 'Ativado' : 'Desativado'}</span>
              </label>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold">Serviços Correios</h3>
              <Button variant="outline" size="sm" onClick={addService} data-testid="add-service-btn"><PlusCircle className="w-4 h-4" /> Adicionar</Button>
            </div>
            <div className="space-y-2">
              {(cfg.correios_services || []).map((s, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end" data-testid={`service-row-${i}`}>
                  <div className="col-span-4">
                    <label className="text-[11px] font-semibold">Código</label>
                    <input list="correios-services" value={s.code} onChange={(e) => {
                      const code = e.target.value;
                      const found = COMMON_SERVICES.find(c => c.code === code);
                      setService(i, { code, label: found?.label || s.label || code });
                    }} className="w-full px-2 py-1.5 border border-border rounded text-sm" />
                  </div>
                  <div className="col-span-7">
                    <label className="text-[11px] font-semibold">Nome exibido</label>
                    <input value={s.label} onChange={(e) => setService(i, { label: e.target.value })} className="w-full px-2 py-1.5 border border-border rounded text-sm" />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button onClick={() => removeService(i)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
              <datalist id="correios-services">
                {COMMON_SERVICES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </datalist>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-heading font-bold">Retirada no Local</h3>
                <p className="text-xs text-txt-secondary">Opção alternativa de entrega (cliente busca presencialmente).</p>
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!cfg.correios_pickup_enabled} onChange={(e) => set('correios_pickup_enabled', e.target.checked)} className="w-5 h-5 accent-brand-main" data-testid="toggle-pickup" />
                <span className="text-sm font-semibold">{cfg.correios_pickup_enabled ? 'Ativado' : 'Desativado'}</span>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome exibido" value={cfg.correios_pickup_label} onChange={(v) => set('correios_pickup_label', v)} placeholder="Retirada no Local" />
              <Field label="Preço (R$)" value={cfg.correios_pickup_price} onChange={(v) => set('correios_pickup_price', parseFloat(v || 0))} type="number" />
            </div>
            <Field label="Endereço de retirada" value={cfg.correios_pickup_address} onChange={(v) => set('correios_pickup_address', v)} placeholder="Av Paulista, 1000 - São Paulo/SP" />
          </Card>

          <Card>
            <h3 className="font-heading font-bold mb-3">Defaults para produtos sem dimensão</h3>
            <div className="grid grid-cols-4 gap-3">
              <Field label="Compr (cm)" type="number" value={cfg.correios_default_length_cm} onChange={(v) => set('correios_default_length_cm', parseInt(v || 16))} />
              <Field label="Largura (cm)" type="number" value={cfg.correios_default_width_cm} onChange={(v) => set('correios_default_width_cm', parseInt(v || 11))} />
              <Field label="Altura (cm)" type="number" value={cfg.correios_default_height_cm} onChange={(v) => set('correios_default_height_cm', parseInt(v || 6))} />
              <Field label="Peso mín (kg)" type="number" step="0.1" value={cfg.correios_min_weight_kg} onChange={(v) => set('correios_min_weight_kg', parseFloat(v || 0.3))} />
            </div>
          </Card>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving} data-testid="save-correios-btn">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
            </Button>
          </div>
        </div>
      )}

      {tab === 'test' && (
        <div className="space-y-4 max-w-2xl">
          <Card>
            <h3 className="font-heading font-bold mb-3">Teste rápido</h3>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="col-span-2">
                <label className="text-xs font-semibold block mb-1">CEP destino</label>
                <input value={test.cep} onChange={(e) => setTest(t => ({ ...t, cep: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder="04567-000" data-testid="test-cep" />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Peso (kg)</label>
                <input type="number" step="0.1" value={test.weight} onChange={(e) => setTest(t => ({ ...t, weight: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
            </div>
            <Button onClick={runTest} disabled={test.running} data-testid="run-test-btn">
              {test.running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Calcular
            </Button>
            {test.result && (
              <div className="mt-4">
                <div className="text-xs text-txt-secondary mb-2">Pacote calculado: {test.result.package?.weight_kg}kg / {test.result.package?.length_cm}×{test.result.package?.width_cm}×{test.result.package?.height_cm}cm</div>
                <div className="space-y-2">
                  {(test.result.options || []).map((o, i) => (
                    <div key={i} className="border border-border rounded p-3 flex justify-between items-center">
                      <div>
                        <div className="font-bold">{o.label} <span className="text-xs text-txt-secondary">({o.code})</span></div>
                        {o.error ? <div className="text-xs text-red-600">{o.error}</div> :
                         <div className="text-xs text-txt-secondary">Prazo: {o.deadline_days} dia(s) úteis{o.address ? ` · ${o.address}` : ''}</div>}
                      </div>
                      <div className={`text-lg font-heading font-black ${o.error ? 'text-red-600' : 'text-brand-main'}`}>
                        {o.error ? 'Indispon.' : formatCurrency(o.price)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'logs' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-txt-secondary">Últimas chamadas à API dos Correios.</p>
            <Button variant="outline" onClick={loadLogs}><RefreshCw className="w-4 h-4" /> Atualizar</Button>
          </div>
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
                  <tr>
                    <th className="text-left p-3">Data</th>
                    <th className="text-left p-3">Origem → Destino</th>
                    <th className="text-left p-3">Pacote</th>
                    <th className="text-center p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 && <tr><td colSpan={4} className="p-10 text-center text-txt-secondary">Nenhum log.</td></tr>}
                  {logs.map(l => (
                    <tr key={l.log_id} className="border-t border-border">
                      <td className="p-3 text-xs whitespace-nowrap">{formatDateTime(l.created_at)}</td>
                      <td className="p-3 text-xs font-mono">{l.cep_origin} → {l.cep_dest}</td>
                      <td className="p-3 text-xs">{l.pkg?.weight_kg}kg · {l.pkg?.length_cm}×{l.pkg?.width_cm}×{l.pkg?.height_cm}cm</td>
                      <td className="p-3 text-center">
                        {l.error ? <Badge variant="error">{(l.error || '').slice(0, 30)}</Badge> : <Badge variant="success">OK</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ children }) { return <div className="bg-white rounded-xl border border-border p-6">{children}</div>; }

function Field({ label, value, onChange, type = 'text', placeholder, testId, step }) {
  return (
    <div>
      <label className="text-xs font-semibold block mb-1">{label}</label>
      <input type={type} step={step} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-brand-main"
        data-testid={testId} autoComplete="off" />
    </div>
  );
}
