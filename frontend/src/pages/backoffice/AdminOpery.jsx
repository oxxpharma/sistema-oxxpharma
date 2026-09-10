import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  Loader2, Copy, Check, ExternalLink, Save, RefreshCcw, Eye, EyeOff,
  Store, CheckCircle2, XCircle, Clock, ArrowUpRight, ArrowDownLeft,
  FileText, AlertTriangle, Play,
} from 'lucide-react';
import { api } from '../../lib/api';
import { formatDateTime } from '../../lib/utils';
import { Button } from '../../components/ui/Button';

const DISPATCH_STATUS = {
  success: { label: 'Enviado com sucesso', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
  failed: { label: 'Falhou', color: 'bg-rose-100 text-rose-800 border-rose-200', icon: XCircle },
  pending_config: { label: 'Aguardando configuração', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },
  never_dispatched: { label: 'Nunca disparado', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: Clock },
};

export default function AdminOpery() {
  const [tab, setTab] = useState('config');
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    try {
      const c = await api.get('/api/admin/opery/config');
      setConfig(c);
    } finally { setLoading(false); }
  };

  useEffect(() => { reload(); }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-main" /></div>;
  }

  return (
    <div className="space-y-5" data-testid="admin-opery-page">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-heading font-black text-2xl">Integração Opery</h1>
              <p className="text-xs text-txt-secondary">ERP interno da loja física · vendas presenciais + emissão de NF-e</p>
            </div>
          </div>
        </div>
        <a href="/docs/opery" target="_blank" rel="noreferrer"
           className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-brand-main text-white hover:bg-brand-hover shadow-sm"
           data-testid="opery-docs-link">
          <FileText className="w-4 h-4" /> Documentação da API <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border">
        {[
          { key: 'config', label: 'Configuração' },
          { key: 'endpoints', label: 'Endpoints' },
          { key: 'inbound', label: 'Logs Entrada' },
          { key: 'outbound', label: 'Logs Saída' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 -mb-px text-sm font-semibold border-b-2 transition ${tab === t.key ? 'border-brand-main text-brand-main' : 'border-transparent text-txt-secondary hover:text-txt-primary'}`}
            data-testid={`opery-tab-${t.key}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'config' && <ConfigForm config={config} onSaved={reload} />}
      {tab === 'endpoints' && <EndpointsCard config={config} />}
      {tab === 'inbound' && <InboundLogs />}
      {tab === 'outbound' && <OutboundLogs />}
    </div>
  );
}

/* ============ CONFIG ============ */

function ConfigForm({ config, onSaved }) {
  const [form, setForm] = useState({ webhook_secret: '', outbound_url: config?.outbound_url || '', outbound_token: '', docs_url: config?.docs_url || '/docs/opery' });
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const payload = {};
    // Só envia campos preenchidos (não sobrescreve com mask)
    if (form.webhook_secret && !form.webhook_secret.includes('*')) payload.webhook_secret = form.webhook_secret;
    if (form.outbound_url !== config?.outbound_url) payload.outbound_url = form.outbound_url;
    if (form.outbound_token && !form.outbound_token.includes('*')) payload.outbound_token = form.outbound_token;
    if (form.docs_url !== config?.docs_url) payload.docs_url = form.docs_url;
    if (!Object.keys(payload).length) { toast.info('Nada foi alterado'); return; }
    setSaving(true);
    try {
      await api.put('/api/admin/opery/config', payload);
      toast.success('Configuração salva no banco');
      setForm({ webhook_secret: '', outbound_url: form.outbound_url, outbound_token: '', docs_url: form.docs_url });
      onSaved();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4" data-testid="opery-config-form">
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <div>
          <h2 className="font-heading font-black text-lg">Credenciais no banco de dados</h2>
          <p className="text-xs text-txt-secondary">Salvas em <code className="bg-bg-secondary px-1 rounded">opery_settings</code>. Fallback automático para <code className="bg-bg-secondary px-1 rounded">.env</code> se DB estiver vazio.</p>
          {config?.source && (
            <div className={`inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-full text-[11px] font-bold ${config.source === 'db' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              Fonte: {config.source === 'db' ? 'Banco de Dados' : '.env (fallback)'}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-bold text-txt-secondary uppercase tracking-wider">Webhook Secret (Opery → OxxPharma)</label>
          <p className="text-[11px] text-txt-secondary mb-1">Chave que a Opery deve enviar no header <code>X-Opery-Api-Key</code>.</p>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={form.webhook_secret}
                onChange={e => setForm({ ...form, webhook_secret: e.target.value })}
                placeholder={config?.webhook_secret_masked || 'não configurado'}
                className="w-full h-10 px-3 pr-10 border border-border rounded-lg text-sm font-mono"
                data-testid="opery-secret-input"
              />
              <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-2 top-1/2 -translate-y-1/2 text-txt-secondary hover:text-brand-main">
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Button variant="outline" onClick={() => setForm({ ...form, webhook_secret: genSecret() })} data-testid="opery-gen-secret">Gerar</Button>
          </div>
          {config?.webhook_secret_masked && !form.webhook_secret && (
            <div className="text-[11px] text-txt-secondary mt-1">Atual: <code>{config.webhook_secret_masked}</code></div>
          )}
        </div>

        <div>
          <label className="text-xs font-bold text-txt-secondary uppercase tracking-wider">Outbound URL (OxxPharma → Opery)</label>
          <p className="text-[11px] text-txt-secondary mb-1">Endpoint que a Opery vai expor para receber nossos pedidos pagos e emitir NF-e.</p>
          <input
            type="url"
            value={form.outbound_url}
            onChange={e => setForm({ ...form, outbound_url: e.target.value })}
            placeholder="https://opery.example.com/api/nfe/receber"
            className="w-full h-10 px-3 border border-border rounded-lg text-sm font-mono"
            data-testid="opery-outbound-url"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-txt-secondary uppercase tracking-wider">Outbound Token</label>
          <p className="text-[11px] text-txt-secondary mb-1">Bearer token para autenticar contra a URL acima.</p>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={form.outbound_token}
              onChange={e => setForm({ ...form, outbound_token: e.target.value })}
              placeholder={config?.outbound_token_masked || 'não configurado'}
              className="w-full h-10 px-3 pr-10 border border-border rounded-lg text-sm font-mono"
              data-testid="opery-outbound-token"
            />
            <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-2 top-1/2 -translate-y-1/2 text-txt-secondary hover:text-brand-main">
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {config?.outbound_token_masked && !form.outbound_token && (
            <div className="text-[11px] text-txt-secondary mt-1">Atual: <code>{config.outbound_token_masked}</code></div>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div className="text-[11px] text-txt-secondary">
            {config?.updated_at && <>Última atualização: {formatDateTime(config.updated_at)} · {config.updated_by || '—'}</>}
          </div>
          <Button onClick={save} disabled={saving} data-testid="opery-save-config">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <StatusCards config={config} />
        <div className="bg-white rounded-2xl border border-border p-5">
          <h3 className="font-heading font-black text-base mb-2">Como funciona</h3>
          <ol className="text-sm space-y-1.5 text-txt-secondary list-decimal list-inside">
            <li>Configure a chave <code>Webhook Secret</code> aqui e passe pra Opery.</li>
            <li>A Opery envia vendas presenciais via <code>POST /api/opery/webhook/sales</code>.</li>
            <li>Quando um pedido é pago no e-commerce, disparamos para a URL da Opery.</li>
            <li>A Opery retorna XML da NF-e ou callback → geramos o DANFE (PDF).</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function genSecret() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 40; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function StatusCards({ config }) {
  const inboundOk = !!config?.webhook_secret_configured;
  const outboundOk = !!(config?.outbound_url && config?.outbound_token_configured);
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className={`rounded-2xl border p-4 ${inboundOk ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`} data-testid="opery-inbound-status">
        <ArrowDownLeft className={`w-5 h-5 ${inboundOk ? 'text-emerald-600' : 'text-amber-600'}`} />
        <div className="mt-2 font-heading font-black text-lg">{inboundOk ? 'OK' : 'Pendente'}</div>
        <div className="text-xs">Entrada (Opery → nós)</div>
      </div>
      <div className={`rounded-2xl border p-4 ${outboundOk ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`} data-testid="opery-outbound-status">
        <ArrowUpRight className={`w-5 h-5 ${outboundOk ? 'text-emerald-600' : 'text-amber-600'}`} />
        <div className="mt-2 font-heading font-black text-lg">{outboundOk ? 'OK' : 'Pendente'}</div>
        <div className="text-xs">Saída (nós → Opery)</div>
      </div>
    </div>
  );
}

/* ============ ENDPOINTS ============ */

function EndpointsCard({ config }) {
  const [copied, setCopied] = useState(null);
  const base = window.location.origin;

  const copy = async (v, key) => {
    await navigator.clipboard.writeText(v);
    setCopied(key);
    toast.success('Copiado');
    setTimeout(() => setCopied(null), 1500);
  };

  const items = [
    { key: 'sales', label: 'Recebimento de vendas', url: `${base}/api/opery/webhook/sales`, method: 'POST', desc: 'A Opery envia vendas presenciais aqui.' },
    { key: 'health', label: 'Health check', url: `${base}/api/opery/webhook/health`, method: 'POST', desc: 'Teste de autenticação/conectividade.' },
    { key: 'nf', label: 'Callback NF emitida', url: `${base}/api/opery/webhook/nf-issued`, method: 'POST', desc: 'Opery avisa que emitiu NF-e (opcional).' },
  ];

  return (
    <div className="space-y-4" data-testid="opery-endpoints-card">
      <div className="bg-white rounded-2xl border border-border p-5">
        <h2 className="font-heading font-black text-lg mb-3">Endpoints públicos (Opery → OxxPharma)</h2>
        <p className="text-xs text-txt-secondary mb-4">Todos exigem o header <code className="bg-bg-secondary px-1 rounded font-mono">X-Opery-Api-Key: &lt;webhook_secret&gt;</code>.</p>
        <div className="space-y-3">
          {items.map(it => (
            <div key={it.key} className="border border-border rounded-lg p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">{it.method}</span>
                  <span className="font-semibold text-sm">{it.label}</span>
                </div>
                <button onClick={() => copy(it.url, it.key)} className="text-txt-secondary hover:text-brand-main text-xs font-semibold inline-flex items-center gap-1" data-testid={`copy-${it.key}`}>
                  {copied === it.key ? <><Check className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                </button>
              </div>
              <div className="font-mono text-xs bg-bg-secondary p-2 rounded break-all">{it.url}</div>
              <div className="text-xs text-txt-secondary mt-1">{it.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border p-5">
        <h2 className="font-heading font-black text-lg mb-2">Saída (OxxPharma → Opery)</h2>
        <p className="text-xs text-txt-secondary mb-3">Quando um pedido é pago, disparamos automaticamente para:</p>
        <div className="font-mono text-xs bg-bg-secondary p-2 rounded break-all">
          {config?.outbound_url || <span className="text-amber-700">⚠ URL da Opery ainda não configurada</span>}
        </div>
      </div>

      <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 flex items-start gap-3">
        <FileText className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-semibold text-sky-900">Documentação completa para a equipe Opery</div>
          <div className="text-sky-800 mt-0.5">Compartilhe este link com o time deles para eles implementarem a integração:</div>
          <a href="/docs/opery" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 font-mono text-xs text-sky-700 hover:underline">
            {base}/docs/opery <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

/* ============ LOGS ENTRADA ============ */

function InboundLogs() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = async (p = page) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: p, per_page: 30 });
      if (kind) q.set('kind', kind);
      if (ok) q.set('ok', ok);
      const d = await api.get(`/api/admin/opery/inbound-log?${q}`);
      setItems(d.items || []); setTotal(d.total || 0);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(1); setPage(1); /* eslint-disable-next-line */ }, [kind, ok]);

  return (
    <div className="space-y-3" data-testid="opery-inbound-logs">
      <div className="flex flex-wrap items-center gap-2">
        <select value={kind} onChange={e => setKind(e.target.value)} className="h-9 px-2 border border-border rounded-lg text-sm" data-testid="inbound-filter-kind">
          <option value="">Todos os tipos</option>
          <option value="sales">Vendas</option>
          <option value="health">Health check</option>
          <option value="nf_callback">Callback NF</option>
        </select>
        <select value={ok} onChange={e => setOk(e.target.value)} className="h-9 px-2 border border-border rounded-lg text-sm" data-testid="inbound-filter-status">
          <option value="">Todos</option>
          <option value="true">Só sucesso</option>
          <option value="false">Só erros</option>
        </select>
        <Button variant="outline" size="sm" onClick={() => load(page)}><RefreshCcw className="w-4 h-4" /> Atualizar</Button>
        <div className="ml-auto text-xs text-txt-secondary">{total} registros</div>
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-main" /></div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-txt-secondary">Sem logs de entrada ainda.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
              <tr>
                <th className="p-2 text-left">Quando</th>
                <th className="p-2 text-left">Tipo</th>
                <th className="p-2 text-center">Status</th>
                <th className="p-2 text-left">User-Agent / Origem</th>
                <th className="p-2 text-left">Resumo</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(log => (
                <tr key={log.log_id} className="border-t border-border hover:bg-bg-secondary/40">
                  <td className="p-2 text-xs text-txt-secondary whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                  <td className="p-2"><span className="text-xs font-semibold">{log.kind}</span></td>
                  <td className="p-2 text-center">
                    {log.ok
                      ? <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-bold"><CheckCircle2 className="w-3.5 h-3.5" /> OK</span>
                      : <span className="inline-flex items-center gap-1 text-rose-700 text-xs font-bold"><XCircle className="w-3.5 h-3.5" /> Erro</span>}
                  </td>
                  <td className="p-2 text-xs truncate max-w-[220px]">{log.headers?.['user-agent'] || '—'}</td>
                  <td className="p-2 text-xs text-txt-secondary truncate max-w-[280px]">
                    {log.error || (log.response ? JSON.stringify(log.response).slice(0, 100) : '—')}
                  </td>
                  <td className="p-2">
                    <button onClick={() => setSelected(log)} className="text-brand-main font-semibold text-xs hover:underline" data-testid={`view-inbound-${log.log_id}`}>Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && <LogDetailModal log={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

/* ============ LOGS SAÍDA ============ */

function OutboundLogs() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [retrying, setRetrying] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ per_page: 50 });
      if (status) q.set('status', status);
      const d = await api.get(`/api/admin/opery/dispatch-log?${q}`);
      setItems(d.items || []); setTotal(d.total || 0);
    } finally { setLoading(false); }
  };

  const openDetail = async (order_id) => {
    setSelectedId(order_id);
    const d = await api.get(`/api/admin/opery/dispatch-log/${order_id}`);
    setDetail(d);
  };

  const retry = async () => {
    setRetrying(true);
    try {
      const r = await api.post('/api/admin/opery/dispatch/retry?limit=100');
      toast.success(`Reprocessados: ${r.success} sucesso, ${r.failed} falhas${r.reason ? ` (${r.reason})` : ''}`);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setRetrying(false); }
  };

  const retrySingle = async (order_id) => {
    try {
      await api.post(`/api/admin/opery/dispatch/${order_id}`);
      toast.success('Reenviado');
      load();
      if (selectedId === order_id) openDetail(order_id);
    } catch (e) { toast.error(e.message); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  return (
    <div className="space-y-3" data-testid="opery-outbound-logs">
      <div className="flex flex-wrap items-center gap-2">
        <select value={status} onChange={e => setStatus(e.target.value)} className="h-9 px-2 border border-border rounded-lg text-sm" data-testid="outbound-filter-status">
          <option value="">Todos</option>
          <option value="success">Sucesso</option>
          <option value="failed">Falha</option>
          <option value="pending_config">Aguardando config</option>
        </select>
        <Button variant="outline" size="sm" onClick={load}><RefreshCcw className="w-4 h-4" /> Atualizar</Button>
        <Button size="sm" onClick={retry} disabled={retrying} data-testid="opery-retry-all">
          {retrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Reprocessar falhas
        </Button>
        <div className="ml-auto text-xs text-txt-secondary">{total} envios</div>
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-main" /></div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-txt-secondary">Sem envios registrados ainda.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
              <tr>
                <th className="p-2 text-left">Última tentativa</th>
                <th className="p-2 text-left">Pedido</th>
                <th className="p-2 text-center">Status</th>
                <th className="p-2 text-center">Tentativas</th>
                <th className="p-2 text-left">Erro / Response</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(log => {
                const s = DISPATCH_STATUS[log.status] || DISPATCH_STATUS.failed;
                const Icon = s.icon;
                return (
                  <tr key={log.log_id} className="border-t border-border hover:bg-bg-secondary/40">
                    <td className="p-2 text-xs text-txt-secondary whitespace-nowrap">{formatDateTime(log.updated_at)}</td>
                    <td className="p-2 font-mono text-xs">
                      <a href={`/backoffice/pedidos?highlight=${log.order_id}`} className="text-brand-main hover:underline">
                        #{log.order_id.slice(-8).toUpperCase()}
                      </a>
                    </td>
                    <td className="p-2 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${s.color}`}>
                        <Icon className="w-3 h-3" /> {s.label}
                      </span>
                    </td>
                    <td className="p-2 text-center text-xs">{log.attempts}</td>
                    <td className="p-2 text-xs text-txt-secondary truncate max-w-[280px]">
                      {log.error || (log.response_body ? String(log.response_body).slice(0, 100) : '—')}
                    </td>
                    <td className="p-2 flex gap-2 whitespace-nowrap">
                      <button onClick={() => openDetail(log.order_id)} className="text-brand-main font-semibold text-xs hover:underline" data-testid={`view-outbound-${log.order_id}`}>Ver</button>
                      {log.status !== 'success' && (
                        <button onClick={() => retrySingle(log.order_id)} className="text-emerald-600 font-semibold text-xs hover:underline">Reenviar</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {detail && <LogDetailModal log={detail} onClose={() => { setDetail(null); setSelectedId(null); }} isOutbound />}
    </div>
  );
}

/* ============ LOG DETAIL MODAL ============ */

function LogDetailModal({ log, onClose, isOutbound = false }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose} data-testid="opery-log-detail">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-heading font-black text-lg">Log detalhado</h3>
            <div className="text-xs text-txt-secondary font-mono">{log.log_id || log.order_id}</div>
          </div>
          <button onClick={onClose} className="text-txt-secondary hover:text-brand-main">✕</button>
        </div>
        <div className="p-5 space-y-4">
          {isOutbound ? (
            <>
              <Field label="Order ID" value={log.order_id} mono />
              <Field label="Status" value={log.status} />
              <Field label="Tentativas" value={String(log.attempts)} />
              <Field label="Criado em" value={formatDateTime(log.created_at)} />
              <Field label="Atualizado em" value={formatDateTime(log.updated_at)} />
              {log.error && <Field label="Erro" value={log.error} error />}
              {log.response_status !== undefined && <Field label="HTTP Status" value={String(log.response_status || '—')} />}
              <CodeBlock title="Payload enviado" content={JSON.stringify(log.payload, null, 2)} />
              {log.response_json ? (
                <CodeBlock title="Response JSON" content={JSON.stringify(log.response_json, null, 2)} />
              ) : log.response_body ? (
                <CodeBlock title="Response body" content={String(log.response_body)} />
              ) : null}
            </>
          ) : (
            <>
              <Field label="Tipo" value={log.kind} />
              <Field label="Status" value={log.ok ? 'OK' : 'Erro'} error={!log.ok} />
              <Field label="Quando" value={formatDateTime(log.created_at)} />
              {log.error && <Field label="Erro" value={log.error} error />}
              <CodeBlock title="Headers" content={JSON.stringify(log.headers, null, 2)} />
              <CodeBlock title="Body recebido" content={JSON.stringify(log.body, null, 2)} />
              <CodeBlock title="Resposta enviada" content={JSON.stringify(log.response, null, 2)} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, mono = false, error = false }) {
  return (
    <div>
      <div className="text-[11px] font-bold text-txt-secondary uppercase tracking-wider">{label}</div>
      <div className={`text-sm ${mono ? 'font-mono' : ''} ${error ? 'text-rose-700' : 'text-txt-primary'}`}>{value || '—'}</div>
    </div>
  );
}

function CodeBlock({ title, content }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[11px] font-bold text-txt-secondary uppercase tracking-wider">{title}</div>
        <button onClick={copy} className="text-xs text-brand-main font-semibold inline-flex items-center gap-1">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre className="bg-slate-900 text-slate-100 text-xs p-3 rounded-lg overflow-auto max-h-96 font-mono whitespace-pre-wrap break-all">{content}</pre>
    </div>
  );
}
