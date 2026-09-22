import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Store, CheckCircle2, XCircle, Clock, RefreshCcw, Eye, Copy, Check,
  ExternalLink, ArrowUpRight, ArrowDownLeft, AlertTriangle, Key, ShieldCheck,
  FileText, Play,
} from 'lucide-react';
import { formatDateTime } from '../lib/utils';
import { Button } from '../components/ui/Button';

const DISPATCH_STATUS = {
  success: { label: 'Enviado com sucesso', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
  failed: { label: 'Falhou', color: 'bg-rose-100 text-rose-800 border-rose-200', icon: XCircle },
  pending_config: { label: 'Aguardando configuração', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },
  never_dispatched: { label: 'Nunca disparado', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: Clock },
};

export default function OperyDevMonitor() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlToken = searchParams.get('token') || '';
  const [token, setToken] = useState(() => urlToken || localStorage.getItem('opery_dev_token') || '');
  const [inputToken, setInputToken] = useState('');
  const [tab, setTab] = useState('inbound');
  const [config, setConfig] = useState(null);
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchApi = useCallback(async (path, options = {}) => {
    const currentToken = token || urlToken;
    const url = new URL(path, window.location.origin);
    if (currentToken) url.searchParams.set('token', currentToken);
    
    const headers = {
      'Content-Type': 'application/json',
      ...(currentToken ? { 'X-Opery-Dev-Token': currentToken } : {}),
      ...(options.headers || {}),
    };

    const res = await fetch(url.toString(), { ...options, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || `Erro HTTP ${res.status}`);
    }
    return res.json();
  }, [token, urlToken]);

  const checkAuth = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await fetchApi('/api/opery/developer/config');
      setConfig(cfg);
      setAuthed(true);
      if (token) localStorage.setItem('opery_dev_token', token);
    } catch (e) {
      setAuthed(false);
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, [fetchApi, token]);

  useEffect(() => {
    if (urlToken && urlToken !== token) {
      setToken(urlToken);
    }
  }, [urlToken]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Auto refresh live logs every 6 seconds
  useEffect(() => {
    if (!authed || !autoRefresh) return;
    const interval = setInterval(() => {
      checkAuth();
    }, 6000);
    return () => clearInterval(interval);
  }, [authed, autoRefresh, checkAuth]);

  const handleApplyToken = (e) => {
    e.preventDefault();
    const clean = inputToken.trim();
    if (!clean) return;
    setToken(clean);
    setSearchParams({ token: clean });
  };

  if (loading && !config) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="flex items-center gap-3">
          <RefreshCcw className="w-6 h-6 animate-spin text-sky-400" />
          <span className="font-mono text-sm text-slate-300">Carregando painel do desenvolvedor...</span>
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-heading font-black text-xl text-white">Opery Monitor Portal</h1>
              <p className="text-xs text-slate-400">Acesso Restrito ao Desenvolvedor</p>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              Insira o <b>Token de Desenvolvedor Opery</b> fornecido pelo administrador para acompanhar os logs de integração em tempo real.
            </div>
          </div>

          <form onSubmit={handleApplyToken} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Token de Acesso</label>
              <div className="relative">
                <input
                  type="text"
                  value={inputToken}
                  onChange={e => setInputToken(e.target.value)}
                  placeholder="opdev_xxxxxxxx..."
                  className="w-full h-11 px-3.5 border border-slate-700 bg-slate-800 text-white rounded-xl text-sm font-mono focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <Button type="submit" className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold h-11">
              Entrar no Monitor
            </Button>
          </form>

          <div className="text-center text-xs text-slate-500">
            Dúvidas? Consulte a <a href="/docs/opery" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline inline-flex items-center gap-1">documentação da API <ExternalLink className="w-3 h-3" /></a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading font-black text-lg text-white">Opery Live Monitor</h1>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${config?.active_env === 'production' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                  {config?.active_env === 'production' ? '🚀 Produção' : '🧪 Sandbox'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Painel de Monitoramento de Integração ERP · OxxPharma Hub</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${autoRefresh ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'}`}
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin text-sky-400' : ''}`} />
              Auto-refresh {autoRefresh ? '(Ativo)' : '(Pausado)'}
            </button>

            <a
              href="/docs/opery"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700"
            >
              Docs API <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 space-y-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 overflow-x-auto pb-px">
          {[
            { key: 'inbound', label: '📥 Logs de Entrada (Opery → OxxPharma)' },
            { key: 'outbound', label: '📤 Logs de Saída (OxxPharma → Opery)' },
            { key: 'snapshots', label: '📊 Snapshots Recebidos' },
            { key: 'status', label: '⚡ Endpoints & Status' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition ${tab === t.key ? 'border-sky-400 text-sky-400 bg-sky-500/10 rounded-t-lg' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'inbound' && <DevInboundTab fetchApi={fetchApi} />}
        {tab === 'outbound' && <DevOutboundTab fetchApi={fetchApi} />}
        {tab === 'snapshots' && <DevSnapshotsTab fetchApi={fetchApi} />}
        {tab === 'status' && <DevStatusTab config={config} />}
      </main>
    </div>
  );
}

/* ============ TAB: INBOUND LOGS ============ */

function DevInboundTab({ fetchApi }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [kind, setKind] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ per_page: 40 });
      if (kind) q.set('kind', kind);
      if (ok) q.set('ok', ok);
      const d = await fetchApi(`/api/opery/developer/inbound-log?${q}`);
      setItems(d.items || []); setTotal(d.total || 0);
    } catch (e) {
      toast.error(e.message);
    } finally { setLoading(false); }
  }, [fetchApi, kind, ok]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={kind} onChange={e => setKind(e.target.value)} className="h-9 px-3 bg-slate-900 border border-slate-700 text-slate-200 rounded-lg text-xs">
          <option value="">Todos os tipos</option>
          <option value="revenue">Snapshots de faturamento</option>
          <option value="sales">Vendas (legado)</option>
          <option value="health">Health check</option>
          <option value="nf_callback">Callback NF</option>
        </select>
        <select value={ok} onChange={e => setOk(e.target.value)} className="h-9 px-3 bg-slate-900 border border-slate-700 text-slate-200 rounded-lg text-xs">
          <option value="">Todos os status</option>
          <option value="true">Só Sucesso (200 OK)</option>
          <option value="false">Só Erros</option>
        </select>
        <button onClick={load} className="h-9 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border border-slate-700">
          <RefreshCcw className="w-3.5 h-3.5" /> Atualizar
        </button>
        <div className="ml-auto text-xs text-slate-400 font-mono">{total} requisições de entrada</div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        {loading && !items.length ? (
          <div className="p-8 flex justify-center"><RefreshCcw className="w-6 h-6 animate-spin text-sky-400" /></div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">Sem logs de entrada ainda.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-slate-200">
              <thead className="bg-slate-950 text-[11px] uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3 text-left font-bold">Data / Hora</th>
                  <th className="p-3 text-left font-bold">Tipo</th>
                  <th className="p-3 text-center font-bold">Status</th>
                  <th className="p-3 text-left font-bold">User-Agent / Header</th>
                  <th className="p-3 text-left font-bold">Resumo Payload / Erro</th>
                  <th className="p-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.map(log => (
                  <tr key={log.log_id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3 font-mono text-slate-400 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                    <td className="p-3"><span className="font-mono text-sky-400 font-bold px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">{log.kind}</span></td>
                    <td className="p-3 text-center">
                      {log.ok ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 200 OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-400 font-bold px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20">
                          <XCircle className="w-3.5 h-3.5" /> Erro
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-400 font-mono truncate max-w-[200px]">{log.headers?.['user-agent'] || '—'}</td>
                    <td className="p-3 text-slate-400 truncate max-w-[280px]">
                      {log.error || (log.body ? JSON.stringify(log.body).slice(0, 90) : '—')}
                    </td>
                    <td className="p-3 text-right">
                      <button onClick={() => setSelected(log)} className="text-sky-400 hover:text-sky-300 font-semibold hover:underline">
                        Ver JSON
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <DevModal log={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

/* ============ TAB: OUTBOUND LOGS ============ */

function DevOutboundTab({ fetchApi }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ per_page: 40 });
      if (status) q.set('status', status);
      const d = await fetchApi(`/api/opery/developer/dispatch-log?${q}`);
      setItems(d.items || []); setTotal(d.total || 0);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [fetchApi, status]);

  const openDetail = async (order_id) => {
    try {
      const log = await fetchApi(`/api/opery/developer/dispatch-log/${order_id}`);
      setSelected(log);
    } catch (e) { toast.error(e.message); }
  };

  const retrySingle = async (order_id) => {
    try {
      await fetchApi(`/api/opery/developer/dispatch/${order_id}`, { method: 'POST' });
      toast.success('Pedido re-disparado para a Opery');
      load();
    } catch (e) { toast.error(e.message); }
  };

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={status} onChange={e => setStatus(e.target.value)} className="h-9 px-3 bg-slate-900 border border-slate-700 text-slate-200 rounded-lg text-xs">
          <option value="">Todos os status</option>
          <option value="success">Sucesso</option>
          <option value="failed">Falha</option>
          <option value="pending_config">Aguardando config</option>
        </select>
        <button onClick={load} className="h-9 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border border-slate-700">
          <RefreshCcw className="w-3.5 h-3.5" /> Atualizar
        </button>
        <div className="ml-auto text-xs text-slate-400 font-mono">{total} disparos efetuados</div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        {loading && !items.length ? (
          <div className="p-8 flex justify-center"><RefreshCcw className="w-6 h-6 animate-spin text-sky-400" /></div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">Sem envios registrados ainda.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-slate-200">
              <thead className="bg-slate-950 text-[11px] uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3 text-left font-bold">Última Tentativa</th>
                  <th className="p-3 text-left font-bold">Pedido</th>
                  <th className="p-3 text-center font-bold">Status</th>
                  <th className="p-3 text-center font-bold">Tentativas</th>
                  <th className="p-3 text-left font-bold">Erro / Resposta Opery</th>
                  <th className="p-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.map(log => {
                  const s = DISPATCH_STATUS[log.status] || DISPATCH_STATUS.failed;
                  const Icon = s.icon;
                  return (
                    <tr key={log.log_id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3 font-mono text-slate-400 whitespace-nowrap">{formatDateTime(log.updated_at)}</td>
                      <td className="p-3 font-mono text-sky-400 font-bold">#{log.order_id?.slice(-8).toUpperCase()}</td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${s.color}`}>
                          <Icon className="w-3 h-3" /> {s.label}
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono">{log.attempts}</td>
                      <td className="p-3 text-slate-400 truncate max-w-[280px]">
                        {log.error || (log.response_body ? String(log.response_body).slice(0, 90) : '—')}
                      </td>
                      <td className="p-3 text-right space-x-3">
                        <button onClick={() => openDetail(log.order_id)} className="text-sky-400 hover:text-sky-300 font-semibold hover:underline">
                          Ver JSON
                        </button>
                        {log.status !== 'success' && (
                          <button onClick={() => retrySingle(log.order_id)} className="text-emerald-400 hover:text-emerald-300 font-semibold hover:underline">
                            Reenviar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <DevModal log={selected} onClose={() => setSelected(null)} isOutbound />}
    </div>
  );
}

/* ============ TAB: SNAPSHOTS ============ */

function DevSnapshotsTab({ fetchApi }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [envFilter, setEnvFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ per_page: 60 });
      if (envFilter) q.set('environment', envFilter);
      const d = await fetchApi(`/api/opery/developer/snapshots?${q}`);
      setItems(d.items || []); setTotal(d.total || 0);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [fetchApi, envFilter]);

  useEffect(() => { load(); }, [load]);

  const currency = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={envFilter} onChange={e => setEnvFilter(e.target.value)} className="h-9 px-3 bg-slate-900 border border-slate-700 text-slate-200 rounded-lg text-xs">
          <option value="">Todos os ambientes</option>
          <option value="production">🚀 Produção</option>
          <option value="sandbox">🧪 Sandbox</option>
        </select>
        <button onClick={load} className="h-9 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border border-slate-700">
          <RefreshCcw className="w-3.5 h-3.5" /> Atualizar
        </button>
        <div className="ml-auto text-xs text-slate-400 font-mono">{total} snapshots armazenados</div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        {loading && !items.length ? (
          <div className="p-8 flex justify-center"><RefreshCcw className="w-6 h-6 animate-spin text-sky-400" /></div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">Nenhum snapshot recebido ainda.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-slate-200">
              <thead className="bg-slate-950 text-[11px] uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3 text-left font-bold">Data</th>
                  <th className="p-3 text-center font-bold">Ambiente</th>
                  <th className="p-3 text-right font-bold">Faturamento (Pago)</th>
                  <th className="p-3 text-right font-bold">Total Pedidos</th>
                  <th className="p-3 text-right font-bold">Qtd Pedidos</th>
                  <th className="p-3 text-right font-bold">Qtd Pagos</th>
                  <th className="p-3 text-right font-bold">Ticket Médio</th>
                  <th className="p-3 text-left font-bold">Última Atualização</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.map(s => {
                  const paid = s.paid_orders_count || s.orders_count || 0;
                  const ticket = paid ? (s.total_revenue || 0) / paid : 0;
                  const isSandbox = s.environment === 'sandbox';
                  return (
                    <tr key={`${s.date}-${s.environment || 'prod'}`} className="hover:bg-slate-800/40 transition">
                      <td className="p-3 font-mono font-bold text-sky-400">{s.date}</td>
                      <td className="p-3 text-center whitespace-nowrap">
                        {isSandbox ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">🧪 Sandbox</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">🚀 Produção</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-400">{currency(s.total_revenue)}</td>
                      <td className="p-3 text-right text-slate-300">{currency(s.total_orders_value)}</td>
                      <td className="p-3 text-right font-mono">{s.orders_count || 0}</td>
                      <td className="p-3 text-right font-mono">{paid}</td>
                      <td className="p-3 text-right font-mono">{currency(ticket)}</td>
                      <td className="p-3 font-mono text-slate-400 whitespace-nowrap">{formatDateTime(s.updated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ TAB: STATUS & ENDPOINTS ============ */

function DevStatusTab({ config }) {
  const [copied, setCopied] = useState(null);
  const base = window.location.origin;

  const copy = async (text, key) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success('Copiado');
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
        <h2 className="font-heading font-black text-base text-white">URLs de Webhook (Opery → OxxPharma)</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-300 text-xs uppercase">🧪 Ambiente Sandbox</span>
              {config?.active_env === 'sandbox' && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/30 text-amber-200">Ativo</span>}
            </div>
            <div className="space-y-2 font-mono text-xs">
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800 flex items-center justify-between gap-2">
                <span className="text-slate-300 truncate">{base}/api/opery/sandbox/webhook/revenue</span>
                <button onClick={() => copy(`${base}/api/opery/sandbox/webhook/revenue`, 'sb-rev')} className="text-sky-400 hover:text-sky-300 font-sans font-semibold">
                  {copied === 'sb-rev' ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-300 text-xs uppercase">🚀 Ambiente Produção</span>
              {config?.active_env === 'production' && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-200">Ativo</span>}
            </div>
            <div className="space-y-2 font-mono text-xs">
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800 flex items-center justify-between gap-2">
                <span className="text-slate-300 truncate">{base}/api/opery/webhook/revenue</span>
                <button onClick={() => copy(`${base}/api/opery/webhook/revenue`, 'pr-rev')} className="text-sky-400 hover:text-sky-300 font-sans font-semibold">
                  {copied === 'pr-rev' ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ MODAL DETALHES JSON ============ */

function DevModal({ log, onClose, isOutbound = false }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-auto shadow-2xl text-slate-100" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
          <div>
            <h3 className="font-heading font-black text-sm text-white">Log Detalhado JSON</h3>
            <div className="text-xs font-mono text-slate-400">{log.log_id || log.order_id}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg">✕</button>
        </div>
        <div className="p-4 space-y-4">
          {isOutbound ? (
            <>
              <DevCode title="Payload Enviado (OxxPharma → Opery)" content={JSON.stringify(log.payload, null, 2)} />
              {log.response_json ? (
                <DevCode title="Resposta Opery (JSON)" content={JSON.stringify(log.response_json, null, 2)} />
              ) : log.response_body ? (
                <DevCode title="Resposta Opery (Texto)" content={String(log.response_body)} />
              ) : null}
            </>
          ) : (
            <>
              <DevCode title="Headers Recebidos" content={JSON.stringify(log.headers, null, 2)} />
              <DevCode title="Body Recebido" content={JSON.stringify(log.body, null, 2)} />
              <DevCode title="Resposta Retornada" content={JSON.stringify(log.response, null, 2)} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DevCode({ title, content }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{title}</span>
        <button onClick={copy} className="text-xs text-sky-400 font-semibold inline-flex items-center gap-1">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre className="bg-slate-950 text-slate-200 text-xs p-3.5 rounded-xl border border-slate-800 font-mono overflow-auto max-h-80 whitespace-pre-wrap break-all">{content}</pre>
    </div>
  );
}
