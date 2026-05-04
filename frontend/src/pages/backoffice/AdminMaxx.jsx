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
  // Teste de envio
  const [testSearch, setTestSearch] = useState('');
  const [testUsers, setTestUsers] = useState([]);
  const [testSelectedUser, setTestSelectedUser] = useState(null);
  const [testPoints, setTestPoints] = useState(1);
  const [testProductName, setTestProductName] = useState('[TESTE] Integração API');
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const load = async () => {
    try {
      const fresh = await api.get('/api/admin/maxx-config');
      // Nao trazer o token mascarado ao input - deixar vazio e usar placeholder
      // indicando que ha um valor salvo. Assim o admin SEMPRE digita de novo ou
      // deixa em branco para manter o valor atual.
      fresh._auth_value_configured = !!fresh.maxx_auth_value_configured;
      fresh._auth_value_length = fresh.maxx_auth_value_length || 0;
      fresh.maxx_auth_value = '';
      setCfg(fresh);
    } finally { setLoading(false); }
  };
  const loadLogs = async () => {
    try { const r = await api.get('/api/admin/maxx-logs'); setLogs(r.logs || []); } catch (e) { toast.error(e?.message); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === 'logs') loadLogs(); }, [tab]);

  // Busca usuarios com debounce simples
  useEffect(() => {
    if (tab !== 'test') return;
    const t = setTimeout(async () => {
      try {
        const r = await api.get(`/api/admin/maxx-test-users?q=${encodeURIComponent(testSearch)}&limit=30`);
        setTestUsers(r.users || []);
      } catch (e) { /* noop */ }
    }, 250);
    return () => clearTimeout(t);
  }, [testSearch, tab]);

  const runTest = async () => {
    if (!testSelectedUser) { toast.error('Selecione um usuário'); return; }
    if (!cfg.maxx_enabled) { toast.error('Habilite a integração antes de testar'); return; }
    setTestRunning(true); setTestResult(null);
    try {
      const r = await api.post('/api/admin/maxx-test-send', {
        user_id: testSelectedUser.user_id,
        points_value: Number(testPoints) || 1,
        product_name: testProductName,
      });
      setTestResult(r);
      if (r.success) toast.success(`OK · HTTP ${r.status_code}`);
      else toast.error(r.error || `HTTP ${r.status_code}`);
    } catch (e) { toast.error(e?.message); }
    finally { setTestRunning(false); }
  };

  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...cfg };
      delete payload.updated_at;
      delete payload._auth_value_configured;
      delete payload._auth_value_length;
      delete payload.maxx_auth_value_configured;
      delete payload.maxx_auth_value_length;
      // Se o campo ficou em branco e ja existe um valor salvo, NAO enviar
      // (para nao apagar o token real)
      if (!payload.maxx_auth_value) delete payload.maxx_auth_value;
      await api.put('/api/admin/maxx-config', payload);
      toast.success('Configuração salva');
      await load();
    } catch (e) { toast.error(e?.message); }
    finally { setSaving(false); }
  };

  const runManual = async () => {
    if (!window.confirm('Enviar AGORA todos os pontos pendentes para o Maxx?')) return;
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
          <Network className="w-7 h-7 text-brand-main" /> Integração Maxx Equipe
        </h1>
        <p className="text-sm text-txt-secondary mt-1">Envia pontos da OxxPharma para o sistema externo Maxx.</p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-border">
        {['config', 'test', 'logs'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition ${tab === t ? 'border-brand-main text-brand-main' : 'border-transparent text-txt-secondary hover:text-txt-primary'}`}
            data-testid={`tab-${t}`}>
            {t === 'config' ? 'Configuração' : t === 'test' ? 'Teste de envio' : 'Logs'}
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
              <Select label="Tipo" value={cfg.maxx_auth_type} onChange={(v) => set('maxx_auth_type', v)} options={['webhook_token', 'apikey', 'bearer', 'basic', 'none']} testId="maxx-auth-type" />
              <Field
                label="Valor (token / chave / user:pass)"
                value={cfg.maxx_auth_value || ''}
                onChange={(v) => set('maxx_auth_value', v)}
                type="password"
                placeholder={cfg._auth_value_configured ? `Já salvo (${cfg._auth_value_length} caracteres). Deixe vazio para manter.` : 'Cole o token aqui'}
                testId="maxx-auth-value"
              />
              {cfg._auth_value_configured && (
                <p className="text-[11px] text-emerald-600 mt-1">✓ Token já configurado ({cfg._auth_value_length} caracteres). Se digitar algo novo, ele será substituído.</p>
              )}
            </div>
            {(cfg.maxx_auth_type === 'apikey' || cfg.maxx_auth_type === 'webhook_token') && (
              <div className="mt-3">
                <Field label="Nome do header" value={cfg.maxx_auth_header_name} onChange={(v) => set('maxx_auth_header_name', v)} placeholder={cfg.maxx_auth_type === 'webhook_token' ? 'X-Webhook-Token' : 'X-API-Key'} />
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

      {tab === 'test' && (
        <div className="space-y-4 max-w-3xl" data-testid="maxx-test">
          <Card>
            <h3 className="font-heading font-bold mb-1">Teste de envio</h3>
            <p className="text-xs text-txt-secondary mb-4">
              Envia 1 ponto sintético referenciando um usuário real, sem persistir nada no histórico de pontos. Útil para validar credenciais e mapeamento do <code>external_id</code> antes de processar pendências reais.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-txt-secondary block mb-1.5">Buscar usuário (nome / e-mail / CPF / external_id)</label>
                <input
                  value={testSearch}
                  onChange={(e) => { setTestSearch(e.target.value); setTestSelectedUser(null); }}
                  placeholder="Digite para filtrar..."
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-brand-main"
                  data-testid="test-search"
                />
                {testUsers.length > 0 && !testSelectedUser && (
                  <div className="mt-1 border border-border rounded-lg max-h-56 overflow-auto bg-white">
                    {testUsers.map(u => (
                      <button
                        key={u.user_id}
                        type="button"
                        onClick={() => { setTestSelectedUser(u); setTestSearch(''); setTestUsers([]); }}
                        className="w-full text-left px-3 py-2 hover:bg-bg-secondary border-b border-border last:border-b-0"
                        data-testid={`test-user-${u.user_id}`}
                      >
                        <div className="text-sm font-semibold">{u.name || '(sem nome)'} {!u.external_id && <span className="ml-2 text-[10px] uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">sem external_id</span>}</div>
                        <div className="text-xs text-txt-secondary">{u.email} {u.external_id && <span className="font-mono">· {u.external_id}</span>} {u.network_type && <span>· {u.network_type}</span>}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {testSelectedUser && (
                <div className="bg-brand-light border border-brand-main/30 rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-brand-main mb-1">Usuário selecionado</div>
                      <div className="font-semibold">{testSelectedUser.name}</div>
                      <div className="text-xs text-txt-secondary">{testSelectedUser.email}</div>
                      <div className="text-xs mt-1">
                        external_id: <span className="font-mono">{testSelectedUser.external_id || '(vazio - precisa estar vinculado para Maxx aceitar)'}</span>
                      </div>
                      {!testSelectedUser.external_id && (
                        <div className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                          ⚠️ Este usuário não tem <code>external_id</code>. A Maxx provavelmente vai rejeitar. Use <a className="underline" href="/backoffice/usuarios">lista de usuários</a> para vincular ou aguarde sync.
                        </div>
                      )}
                    </div>
                    <button onClick={() => setTestSelectedUser(null)} className="text-xs text-txt-secondary hover:text-brand-main">trocar</button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Pontos (valor sintético)" type="number" value={testPoints} onChange={(v) => setTestPoints(v)} testId="test-points" />
                <Field label="Nome do produto" value={testProductName} onChange={(v) => setTestProductName(v)} testId="test-product" />
              </div>

              <Button onClick={runTest} disabled={testRunning || !testSelectedUser} data-testid="run-test-btn">
                {testRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar teste
              </Button>
            </div>
          </Card>

          {testResult && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading font-bold">Resultado</h3>
                {testResult.success ? <Badge variant="success">HTTP {testResult.status_code} · OK</Badge> : <Badge variant="error">{testResult.status_code ? `HTTP ${testResult.status_code}` : 'ERRO'}</Badge>}
              </div>
              {testResult.error && (
                <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-2 rounded mb-3">{testResult.error}</div>
              )}
              <div className="space-y-3 text-xs">
                <div>
                  <div className="font-bold text-txt-secondary uppercase tracking-wider mb-1">Endpoint</div>
                  <div className="font-mono break-all bg-bg-secondary p-2 rounded">{testResult.request_url}</div>
                </div>
                <div>
                  <div className="font-bold text-txt-secondary uppercase tracking-wider mb-1">Headers enviados</div>
                  <pre className="font-mono bg-bg-secondary p-2 rounded overflow-x-auto">{JSON.stringify(testResult.request_headers, null, 2)}</pre>
                </div>
                <div>
                  <div className="font-bold text-txt-secondary uppercase tracking-wider mb-1">Payload enviado</div>
                  <pre className="font-mono bg-bg-secondary p-2 rounded overflow-x-auto">{JSON.stringify(testResult.request_payload, null, 2)}</pre>
                </div>
                <div>
                  <div className="font-bold text-txt-secondary uppercase tracking-wider mb-1">Resposta da Maxx</div>
                  <pre className="font-mono bg-bg-secondary p-2 rounded overflow-x-auto whitespace-pre-wrap">{testResult.response || '(vazio)'}</pre>
                </div>
              </div>
            </Card>
          )}
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
