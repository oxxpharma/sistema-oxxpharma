import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  CheckCircle2, XCircle, Clock, RefreshCcw, Copy, Check,
  ExternalLink, ShieldCheck,
} from 'lucide-react';
import { formatDateTime } from '../lib/utils';
import { Button } from '../components/ui/Button';
import BrandLogo from '../components/branding/BrandLogo';

const DISPATCH_STATUS = {
  success: { label: 'Enviado com sucesso', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  failed: { label: 'Falhou', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: XCircle },
  pending_config: { label: 'Aguardando configuração', color: 'bg-amber-50 text-amber-800 border-amber-200', icon: Clock },
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
      const cfg = await fetchApi('/api/admin/opery/config');
      setConfig(cfg);
      setAuthed(true);
      const activeToken = token || urlToken;
      if (activeToken) localStorage.setItem('opery_dev_token', activeToken);
    } catch (e) {
      setAuthed(false);
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, [fetchApi, token, urlToken]);

  useEffect(() => {
    if (urlToken && urlToken !== token) {
      setToken(urlToken);
      localStorage.setItem('opery_dev_token', urlToken);
    }
  }, [urlToken, token]);

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
    localStorage.setItem('opery_dev_token', clean);
    setSearchParams({ token: clean });
  };

  if (loading && !config) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="flex items-center gap-3">
          <RefreshCcw className="w-6 h-6 animate-spin text-orange-400" />
          <span className="font-mono text-sm text-slate-300">Carregando painel do desenvolvedor...</span>
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl max-w-md w-full p-8 space-y-6 shadow-2xl backdrop-blur">
          <div className="flex flex-col items-center text-center space-y-2">
            <BrandLogo slot="auth_pages" variant="dark" />
            <div className="pt-2">
              <h1 className="font-heading font-black text-2xl text-white tracking-tight">Dev Monitor</h1>
              <p className="text-xs text-slate-400">Acesso Restrito para Dev Externo</p>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 text-xs text-amber-300 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              Insira o <b>Token DEV</b> fornecido pelo administrador para acompanhar os logs de integração em tempo real.
            </div>
          </div>

          <form onSubmit={handleApplyToken} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Token de Acesso</label>
              <input
                type="text"
                value={inputToken}
                onChange={e => setInputToken(e.target.value)}
                placeholder="opdev_xxxxxxxx..."
                className="w-full h-11 px-3.5 border border-slate-700 bg-slate-950 text-white rounded-xl text-sm font-mono focus:outline-none focus:border-orange-500 transition"
              />
            </div>

            <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold h-11 rounded-xl shadow-md transition">
              Entrar no Monitor
            </Button>
          </form>

          <div className="text-center text-xs text-slate-400 border-t border-slate-800/80 pt-4">
            Dúvidas? Consulte a <a href="/docs/opery" target="_blank" rel="noreferrer" className="text-orange-400 hover:underline font-semibold inline-flex items-center gap-1">documentação da API <ExternalLink className="w-3 h-3" /></a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Header Banner inspired by OperyDocs */}
      <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-6 py-4 sticky top-0 z-30 shadow-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <BrandLogo slot="admin_topbar" variant="dark" />
            <div className="h-6 w-px bg-slate-700 hidden sm:block" />
            <div className="flex items-center gap-2.5">
              <h1 className="font-heading font-black text-xl text-white tracking-tight">Dev Monitor</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${config?.active_env === 'production' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
                {config?.active_env === 'production' ? '🚀 Produção' : '🧪 Sandbox'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${autoRefresh ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-slate-800/40 text-slate-400 border-slate-800 hover:text-slate-200'}`}
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin text-orange-400' : ''}`} />
              Auto-refresh {autoRefresh ? '(Ativo)' : '(Pausado)'}
            </button>

            <a
              href="/docs/opery"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white shadow-sm transition"
            >
              Docs API <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Navigation Tabs Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-1.5 shadow-sm sticky top-[65px] z-20">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto">
          {[
            { key: 'inbound', label: '📥 Logs de Entrada (Opery → OxxPharma)' },
            { key: 'outbound', label: '📤 Logs de Saída (OxxPharma → Opery)' },
            { key: 'snapshots', label: '📊 Snapshots Recebidos' },
            { key: 'status', label: '⚡ Endpoints & Status' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition ${tab === t.key ? 'border-orange-500 text-orange-600 bg-orange-50/50 rounded-t-lg' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-4">
        {tab === 'inbound' && <DevInboundTab fetchApi={fetchApi} />}
        {tab === 'outbound' && <DevOutboundTab fetchApi={fetchApi} />}
        {tab === 'snapshots' && <DevSnapshotsTab fetchApi={fetchApi} />}
        {tab === 'status' && <DevStatusTab config={config} />}
      </main>

      <footer className="max-w-7xl w-full mx-auto px-6 py-4 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
        <div>OxxPharma · Dev Monitor</div>
        <a href="/docs/opery" target="_blank" rel="noreferrer" className="hover:text-orange-600 font-semibold inline-flex items-center gap-1">
          Documentação da API <ExternalLink className="w-3 h-3" />
        </a>
      </footer>
    </div>
  );
}

/* ============ TAB: INBOUND LOGS ============ */

function DevInboundTab({ fetchApi }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [kind, setKind] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: p, per_page: perPage });
      if (kind) q.set('kind', kind);
      if (ok) q.set('ok', ok);
      const d = await fetchApi(`/api/admin/opery/inbound-log?${q}`);
      setItems(d.items || []); setTotal(d.total || 0);
    } catch (e) {
      toast.error(e.message);
    } finally { setLoading(false); }
  }, [fetchApi, kind, ok, page, perPage]);

  useEffect(() => { load(1); setPage(1); }, [kind, ok]);
  useEffect(() => { load(page); }, [page]);

  const totalPages = Math.ceil(total / perPage) || 1;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={kind} onChange={e => setKind(e.target.value)} className="h-9 px-3 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-medium focus:border-orange-500 focus:outline-none shadow-sm">
          <option value="">Todos os tipos</option>
          <option value="revenue">Snapshots de faturamento</option>
          <option value="sales">Vendas (legado)</option>
          <option value="health">Health check</option>
          <option value="nf_callback">Callback NF</option>
        </select>
        <select value={ok} onChange={e => setOk(e.target.value)} className="h-9 px-3 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-medium focus:border-orange-500 focus:outline-none shadow-sm">
          <option value="">Todos os status</option>
          <option value="true">Só Sucesso (200 OK)</option>
          <option value="false">Só Erros</option>
        </select>
        <button onClick={() => load(page)} className="h-9 px-3 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border border-slate-300 shadow-sm transition">
          <RefreshCcw className="w-3.5 h-3.5 text-slate-500" /> Atualizar
        </button>
        <div className="ml-auto text-xs text-slate-500 font-medium">{total} requisições de entrada</div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {loading && !items.length ? (
          <div className="p-12 flex justify-center"><RefreshCcw className="w-6 h-6 animate-spin text-orange-500" /></div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">Sem logs de entrada ainda.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-slate-800">
                <thead className="bg-slate-100 text-[11px] uppercase font-bold text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="p-3 text-left font-bold">Data / Hora</th>
                    <th className="p-3 text-left font-bold">Tipo</th>
                    <th className="p-3 text-center font-bold">Status</th>
                    <th className="p-3 text-left font-bold">User-Agent / Header</th>
                    <th className="p-3 text-left font-bold">Resumo Payload / Erro</th>
                    <th className="p-3 text-right font-bold">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map(log => (
                    <tr key={log.log_id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-mono text-slate-500 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                      <td className="p-3">
                        <span className="font-mono text-orange-700 font-bold px-2 py-0.5 rounded bg-orange-50 border border-orange-200">
                          {log.kind}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {log.ok ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" /> 200 OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-700 font-bold px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200">
                            <XCircle className="w-3.5 h-3.5" /> Erro
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-500 font-mono truncate max-w-[200px]">{log.headers?.['user-agent'] || '—'}</td>
                      <td className="p-3 text-slate-600 truncate max-w-[280px]">
                        {log.error || (log.body ? JSON.stringify(log.body).slice(0, 90) : '—')}
                      </td>
                      <td className="p-3 text-right">
                        <button onClick={() => setSelected(log)} className="text-orange-600 hover:text-orange-700 font-bold hover:underline">
                          Ver JSON
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
              <span>
                Página <b className="text-slate-900">{page}</b> de <b className="text-slate-900">{totalPages}</b> ({total} registros)
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 disabled:opacity-40 shadow-sm transition"
                >
                  Anterior
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 disabled:opacity-40 shadow-sm transition"
                >
                  Próxima
                </button>
              </div>
            </div>
          </>
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
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: p, per_page: perPage });
      if (status) q.set('status', status);
      const d = await fetchApi(`/api/admin/opery/dispatch-log?${q}`);
      setItems(d.items || []); setTotal(d.total || 0);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [fetchApi, status, page, perPage]);

  useEffect(() => { load(1); setPage(1); }, [status]);
  useEffect(() => { load(page); }, [page]);

  const totalPages = Math.ceil(total / perPage) || 1;

  const openDetail = async (order_id) => {
    try {
      const log = await fetchApi(`/api/admin/opery/dispatch-log/${order_id}`);
      setSelected(log);
    } catch (e) { toast.error(e.message); }
  };

  const retrySingle = async (order_id) => {
    try {
      await fetchApi(`/api/admin/opery/dispatch/${order_id}`, { method: 'POST' });
      toast.success('Pedido re-disparado para a Opery');
      load(page);
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={status} onChange={e => setStatus(e.target.value)} className="h-9 px-3 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-medium focus:border-orange-500 focus:outline-none shadow-sm">
          <option value="">Todos os status</option>
          <option value="success">Sucesso</option>
          <option value="failed">Falha</option>
          <option value="pending_config">Aguardando config</option>
        </select>
        <button onClick={() => load(page)} className="h-9 px-3 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border border-slate-300 shadow-sm transition">
          <RefreshCcw className="w-3.5 h-3.5 text-slate-500" /> Atualizar
        </button>
        <div className="ml-auto text-xs text-slate-500 font-medium">{total} disparos efetuados</div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {loading && !items.length ? (
          <div className="p-12 flex justify-center"><RefreshCcw className="w-6 h-6 animate-spin text-orange-500" /></div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">Sem envios registrados ainda.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-slate-800">
                <thead className="bg-slate-100 text-[11px] uppercase font-bold text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="p-3 text-left font-bold">Última Tentativa</th>
                    <th className="p-3 text-left font-bold">Pedido</th>
                    <th className="p-3 text-center font-bold">Status</th>
                    <th className="p-3 text-center font-bold">Tentativas</th>
                    <th className="p-3 text-left font-bold">Erro / Resposta Opery</th>
                    <th className="p-3 text-right font-bold">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map(log => {
                    const s = DISPATCH_STATUS[log.status] || DISPATCH_STATUS.failed;
                    const Icon = s.icon;
                    return (
                      <tr key={log.log_id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3 font-mono text-slate-500 whitespace-nowrap">{formatDateTime(log.updated_at)}</td>
                        <td className="p-3 font-mono text-orange-600 font-bold">#{log.order_id?.slice(-8).toUpperCase()}</td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${s.color}`}>
                            <Icon className="w-3 h-3" /> {s.label}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono">{log.attempts}</td>
                        <td className="p-3 text-slate-600 truncate max-w-[280px]">
                          {log.error || (log.response_body ? String(log.response_body).slice(0, 90) : '—')}
                        </td>
                        <td className="p-3 text-right space-x-3">
                          <button onClick={() => openDetail(log.order_id)} className="text-orange-600 hover:text-orange-700 font-bold hover:underline">
                            Ver JSON
                          </button>
                          {log.status !== 'success' && (
                            <button onClick={() => retrySingle(log.order_id)} className="text-emerald-600 hover:text-emerald-700 font-bold hover:underline">
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

            {/* Pagination Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
              <span>
                Página <b className="text-slate-900">{page}</b> de <b className="text-slate-900">{totalPages}</b> ({total} envios)
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 disabled:opacity-40 shadow-sm transition"
                >
                  Anterior
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 disabled:opacity-40 shadow-sm transition"
                >
                  Próxima
                </button>
              </div>
            </div>
          </>
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
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [envFilter, setEnvFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: p, per_page: perPage });
      if (envFilter) q.set('environment', envFilter);
      const d = await fetchApi(`/api/admin/opery/snapshots?${q}`);
      setItems(d.items || []); setTotal(d.total || 0);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [fetchApi, envFilter, page, perPage]);

  useEffect(() => { load(1); setPage(1); }, [envFilter]);
  useEffect(() => { load(page); }, [page]);

  const totalPages = Math.ceil(total / perPage) || 1;
  const currency = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={envFilter} onChange={e => setEnvFilter(e.target.value)} className="h-9 px-3 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-medium focus:border-orange-500 focus:outline-none shadow-sm">
          <option value="">Todos os ambientes</option>
          <option value="production">🚀 Produção</option>
          <option value="sandbox">🧪 Sandbox</option>
        </select>
        <button onClick={() => load(page)} className="h-9 px-3 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border border-slate-300 shadow-sm transition">
          <RefreshCcw className="w-3.5 h-3.5 text-slate-500" /> Atualizar
        </button>
        <div className="ml-auto text-xs text-slate-500 font-medium">{total} snapshots armazenados</div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {loading && !items.length ? (
          <div className="p-12 flex justify-center"><RefreshCcw className="w-6 h-6 animate-spin text-orange-500" /></div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">Nenhum snapshot recebido ainda.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-slate-800">
                <thead className="bg-slate-100 text-[11px] uppercase font-bold text-slate-600 border-b border-slate-200">
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
                <tbody className="divide-y divide-slate-100">
                  {items.map(s => {
                    const paid = s.paid_orders_count || s.orders_count || 0;
                    const ticket = paid ? (s.total_revenue || 0) / paid : 0;
                    const isSandbox = s.environment === 'sandbox';
                    return (
                      <tr key={`${s.date}-${s.environment || 'prod'}`} className="hover:bg-slate-50/80 transition">
                        <td className="p-3 font-mono font-bold text-orange-600">{s.date}</td>
                        <td className="p-3 text-center whitespace-nowrap">
                          {isSandbox ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">🧪 Sandbox</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">🚀 Produção</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-bold text-emerald-700">{currency(s.total_revenue)}</td>
                        <td className="p-3 text-right text-slate-700">{currency(s.total_orders_value)}</td>
                        <td className="p-3 text-right font-mono">{s.orders_count || 0}</td>
                        <td className="p-3 text-right font-mono">{paid}</td>
                        <td className="p-3 text-right font-mono">{currency(ticket)}</td>
                        <td className="p-3 font-mono text-slate-500 whitespace-nowrap">{formatDateTime(s.updated_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
              <span>
                Página <b className="text-slate-900">{page}</b> de <b className="text-slate-900">{totalPages}</b> ({total} snapshots)
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 disabled:opacity-40 shadow-sm transition"
                >
                  Anterior
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 disabled:opacity-40 shadow-sm transition"
                >
                  Próxima
                </button>
              </div>
            </div>
          </>
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
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
        <div>
          <h2 className="font-heading font-black text-lg text-slate-900">URLs de Webhook (Opery → OxxPharma)</h2>
          <p className="text-xs text-slate-500">Endpoints configurados para recebimento de snapshots e notificações do ERP Opery.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-800 text-xs uppercase tracking-wider">🧪 Ambiente Sandbox</span>
              {config?.active_env === 'sandbox' && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900">Ativo</span>}
            </div>
            <div className="space-y-2 font-mono text-xs">
              <div className="bg-slate-900 text-slate-100 p-3 rounded-lg border border-slate-800 flex items-center justify-between gap-2 shadow-inner">
                <span className="truncate">{base}/api/opery/sandbox/webhook/revenue</span>
                <button onClick={() => copy(`${base}/api/opery/sandbox/webhook/revenue`, 'sb-rev')} className="text-orange-400 hover:text-orange-300 font-sans font-bold text-xs shrink-0">
                  {copied === 'sb-rev' ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-800 text-xs uppercase tracking-wider">🚀 Ambiente Produção</span>
              {config?.active_env === 'production' && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-900">Ativo</span>}
            </div>
            <div className="space-y-2 font-mono text-xs">
              <div className="bg-slate-900 text-slate-100 p-3 rounded-lg border border-slate-800 flex items-center justify-between gap-2 shadow-inner">
                <span className="truncate">{base}/api/opery/webhook/revenue</span>
                <button onClick={() => copy(`${base}/api/opery/webhook/revenue`, 'pr-rev')} className="text-orange-400 hover:text-orange-300 font-sans font-bold text-xs shrink-0">
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
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-auto shadow-2xl text-slate-900" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-heading font-black text-base text-slate-900">Log Detalhado JSON</h3>
            <div className="text-xs font-mono text-slate-500">{log.log_id || log.order_id}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl font-bold">✕</button>
        </div>
        <div className="p-5 space-y-4">
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
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{title}</span>
        <button onClick={copy} className="text-xs text-orange-600 font-bold inline-flex items-center gap-1 hover:underline">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre className="bg-slate-900 text-slate-100 text-xs p-4 rounded-xl border border-slate-800 font-mono overflow-auto max-h-80 whitespace-pre-wrap break-all shadow-inner">{content}</pre>
    </div>
  );
}
