import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Network, Loader2, Save, Send, RefreshCw, Webhook, Play } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '../../lib/utils';

const MODES = [
  { value: 'realtime', label: 'Tempo real (1 req por pedido pago)' },
  { value: 'batch', label: 'Lote diário (1 req agrupada às 23:50 BRT)' },
  { value: 'manual', label: 'Manual (apenas quando admin disparar)' },
];

export default function AdminMaxx() {
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState([]);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState('config');

  const load = async () => {
    try { setCfg(await api.get('/api/admin/maxx-config')); } finally { setLoading(false); }
  };
  const loadLogs = async () => {
    try { const r = await api.get('/api/admin/maxx-logs'); setLogs(r.logs || []); } catch (e) { toast.error(e?.message); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === 'logs') loadLogs(); }, [tab]);

  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...cfg }; delete payload.updated_at;
      await api.put('/api/admin/maxx-config', payload);
      toast.success('Configuração salva');
      await load();
    } catch (e) { toast.error(e?.message); }
    finally { setSaving(false); }
  };

  const runManual = async () => {
    if (!confirm('Enviar AGORA todos os pontos pendentes para o Maxx?')) return;
    setRunning(true);
    try {
      const r = await api.post('/api/admin/maxx-sync-points');
      if (r.skipped) toast.info(r.reason || 'Nada a enviar');
      else if (r.success) toast.success(`Enviados ${r.sent_count} registros`);
      else toast.error(r.error || 'Falha no envio');
      if (tab === 'logs') loadLogs();
    } catch (e) { toast.error(e?.message); }
    finally { setRunning(false); }
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;
  if (!cfg) return null;

  return (
    <div data-testid="admin-maxx">
      <div className="mb-6">
        <h1 className="font-heading font-black text-2xl flex items-center gap-3">
          <Network className="w-7 h-7 text-brand-main" /> Integração Maxx MMN
        </h1>
        <p className="text-sm text-txt-secondary mt-1">Envia pontos da OxxPharma para o sistema externo Maxx.</p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-border">
        {['config', 'logs'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition ${tab === t ? 'border-brand-main text-brand-main' : 'border-transparent text-txt-secondary hover:text-txt-primary'}`}
            data-testid={`tab-${t}`}>
            {t === 'config' ? 'Configuração' : 'Logs'}
          </button>
        ))}
      </div>

      {tab === 'config' && (
        <div className="space-y-4 max-w-3xl">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-heading font-bold">Status</h3>
                <p className="text-xs text-txt-secondary">Habilita o envio automático de pontos.</p>
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!cfg.maxx_enabled} onChange={(e) => set('maxx_enabled', e.target.checked)} className="w-5 h-5 accent-brand-main" data-testid="toggle-maxx" />
                <span className="text-sm font-semibold">{cfg.maxx_enabled ? 'Ativado' : 'Desativado'}</span>
              </label>
            </div>
          </Card>

          <Card>
            <h3 className="font-heading font-bold mb-3">Modo de operação</h3>
            <div className="space-y-2">
              {MODES.map(m => (
                <label key={m.value} className={`flex items-start gap-2 p-3 rounded-lg cursor-pointer border-2 ${cfg.maxx_mode === m.value ? 'border-brand-main bg-brand-light' : 'border-border'}`}>
                  <input type="radio" name="mode" checked={cfg.maxx_mode === m.value} onChange={() => set('maxx_mode', m.value)} className="mt-1" data-testid={`mode-${m.value}`} />
                  <span className="text-sm">{m.label}</span>
                </label>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="font-heading font-bold mb-3">Endpoint do Maxx</h3>
            <Field label="URL" value={cfg.maxx_api_url} onChange={(v) => set('maxx_api_url', v)} placeholder="https://api.maxx.com.br/integration/points" testId="maxx-url" />
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Select label="Método" value={cfg.maxx_api_method} onChange={(v) => set('maxx_api_method', v)} options={['POST', 'PUT']} />
              <Field label="Timeout (s)" type="number" value={cfg.maxx_timeout_seconds} onChange={(v) => set('maxx_timeout_seconds', parseInt(v || 30))} />
            </div>
          </Card>

          <Card>
            <h3 className="font-heading font-bold mb-3">Autenticação</h3>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Tipo" value={cfg.maxx_auth_type} onChange={(v) => set('maxx_auth_type', v)} options={['none', 'bearer', 'apikey', 'basic']} testId="maxx-auth-type" />
              <Field label="Valor (token / chave / user:pass)" value={cfg.maxx_auth_value} onChange={(v) => set('maxx_auth_value', v)} type="password" placeholder="••••••••" testId="maxx-auth-value" />
            </div>
            {cfg.maxx_auth_type === 'apikey' && (
              <div className="mt-3">
                <Field label="Nome do header da API Key" value={cfg.maxx_auth_header_name} onChange={(v) => set('maxx_auth_header_name', v)} placeholder="X-API-Key" />
              </div>
            )}
            <div className="mt-3">
              <Field label="Headers extras (JSON)" value={cfg.maxx_extra_headers} onChange={(v) => set('maxx_extra_headers', v)} placeholder='{"X-Client":"OxxPharma"}' />
            </div>
          </Card>

          <Card>
            <h3 className="font-heading font-bold mb-3">Template de payload (opcional)</h3>
            <p className="text-xs text-txt-secondary mb-2">Use <code>{'{{batch_json}}'}</code> onde a lista de pontos deve aparecer. Vazio = formato padrão.</p>
            <textarea value={cfg.maxx_payload_template || ''} onChange={(e) => set('maxx_payload_template', e.target.value)}
              rows={5} className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono"
              placeholder='{"client":"oxxpharma","data":{{batch_json}}}' />
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={runManual} disabled={running || !cfg.maxx_enabled} data-testid="run-manual-btn">
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Enviar pendentes agora
            </Button>
            <Button onClick={save} disabled={saving} data-testid="save-maxx-btn">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
            </Button>
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-txt-secondary">Histórico de chamadas para o Maxx.</p>
            <Button variant="outline" onClick={loadLogs}><RefreshCw className="w-4 h-4" /> Atualizar</Button>
          </div>
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
                  <tr><th className="text-left p-3">Data</th><th className="text-left p-3">Tipo</th><th className="text-left p-3">URL</th><th className="text-center p-3">Status</th><th className="text-right p-3">Pontos</th></tr>
                </thead>
                <tbody>
                  {logs.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-txt-secondary">Nenhum envio.</td></tr>}
                  {logs.map(l => (
                    <tr key={l.log_id} className="border-t border-border">
                      <td className="p-3 text-xs whitespace-nowrap">{formatDateTime(l.created_at)}</td>
                      <td className="p-3 text-xs">{l.kind}</td>
                      <td className="p-3 text-xs font-mono truncate max-w-xs">{l.url}</td>
                      <td className="p-3 text-center">{l.success ? <Badge variant="success">{l.status_code || 'OK'}</Badge> : <Badge variant="error">{l.status_code || 'ERR'}</Badge>}</td>
                      <td className="p-3 text-right text-xs">{(l.point_log_ids || []).length}</td>
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
function Field({ label, value, onChange, type = 'text', placeholder, testId }) {
  return (
    <div>
      <label className="text-xs font-semibold block mb-1">{label}</label>
      <input type={type} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-brand-main"
        data-testid={testId} autoComplete="off" />
    </div>
  );
}
function Select({ label, value, onChange, options, testId }) {
  return (
    <div>
      <label className="text-xs font-semibold block mb-1">{label}</label>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-lg text-sm" data-testid={testId}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
