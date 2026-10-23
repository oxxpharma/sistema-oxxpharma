import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { CreditCard, Loader2, AlertTriangle, RefreshCw, Save, Webhook, Eye, EyeOff, ShieldCheck, Zap, ArrowUpRight, ArrowDownLeft, Copy, Check, Search, FileText, Filter, Trash2, X, ChevronLeft, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '../../lib/utils';

export default function AdminPayments() {
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsPages, setLogsPages] = useState(1);
  const [logsStats, setLogsStats] = useState({ total_all: 0, outgoing: 0, incoming: 0, errors: 0 });
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsFilter, setLogsFilter] = useState({ provider: 'all', direction: 'all', search: '', success: 'all' });
  const [selectedLog, setSelectedLog] = useState(null);
  const [modalTab, setModalTab] = useState('request');
  const [copiedKey, setCopiedKey] = useState(null);
  const [tab, setTab] = useState('provider');
  const [showSecrets, setShowSecrets] = useState(false);
  const [form, setForm] = useState({
    mp_test_public_key: '', mp_test_access_token: '',
    mp_prod_public_key: '', mp_prod_access_token: '',
    mp_webhook_secret: '',
    ipag_sandbox_api_id: '', ipag_sandbox_api_key: '',
    ipag_prod_api_id: '', ipag_prod_api_key: '',
  });
  const backendUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;

  const load = async () => {
    try {
      const r = await api.get('/api/admin/payments-config');
      setCfg(r);
      const ipagSbId = r.ipag_sandbox_api_id ?? r.ipag?.sandbox_api_id ?? '';
      const ipagPrId = r.ipag_prod_api_id ?? r.ipag?.prod_api_id ?? '';
      setForm({
        mp_test_public_key: r.test_public_key || '',
        mp_test_access_token: '',
        mp_prod_public_key: r.prod_public_key || '',
        mp_prod_access_token: '',
        mp_webhook_secret: '',
        ipag_sandbox_api_id: ipagSbId,
        ipag_sandbox_api_key: '',
        ipag_prod_api_id: ipagPrId,
        ipag_prod_api_key: '',
      });
    } finally { setLoading(false); }
  };

  const loadLogs = async (page = 1, filterOverride = null) => {
    setLogsLoading(true);
    try {
      const f = filterOverride || logsFilter;
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '25');
      if (f.provider && f.provider !== 'all') params.append('provider', f.provider);
      if (f.direction && f.direction !== 'all') params.append('direction', f.direction);
      if (f.success && f.success !== 'all') params.append('success', f.success);
      if (f.search && f.search.trim()) params.append('search', f.search.trim());

      const r = await api.get(`/api/admin/payments/logs?${params.toString()}`);
      setLogs(r.logs || []);
      setLogsTotal(r.total || 0);
      setLogsPage(r.page || 1);
      setLogsPages(r.pages || 1);
      if (r.stats) setLogsStats(r.stats);
    } catch (e) {
      toast.error(e?.message || 'Erro ao carregar logs de pagamento');
    } finally {
      setLogsLoading(false);
    }
  };

  const copyToClipboard = (content, key) => {
    try {
      const textToCopy = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      navigator.clipboard.writeText(textToCopy);
      setCopiedKey(key);
      toast.success('JSON copiado com sucesso!');
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      toast.error('Erro ao copiar');
    }
  };

  const clearAllLogs = async () => {
    if (!window.confirm('Tem certeza que deseja apagar todo o histórico de logs de pagamento? Esta ação não pode ser desfeita.')) return;
    try {
      await api.delete('/api/admin/payments/logs');
      toast.success('Histórico de logs limpo com sucesso');
      loadLogs(1);
    } catch (e) {
      toast.error(e?.message || 'Erro ao limpar logs');
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === 'logs') loadLogs(1); }, [tab]);

  const setActiveProvider = async (provider) => {
    setSaving(true);
    try {
      await api.put('/api/admin/payments-config', { active_payment_provider: provider });
      toast.success(`Gateway principal alterado para ${provider.toUpperCase()}`);
      await load();
    } catch (e) { toast.error(e?.message); }
    finally { setSaving(false); }
  };

  const saveCredentials = async () => {
    setSaving(true);
    try {
      const payload = {
        mp_test_public_key: form.mp_test_public_key || '',
        mp_prod_public_key: form.mp_prod_public_key || '',
        ipag_sandbox_api_id: (form.ipag_sandbox_api_id || '').trim(),
        ipag_prod_api_id: (form.ipag_prod_api_id || '').trim(),
      };

      if (form.mp_test_access_token && form.mp_test_access_token.trim()) {
        payload.mp_test_access_token = form.mp_test_access_token.trim();
      }
      if (form.mp_prod_access_token && form.mp_prod_access_token.trim()) {
        payload.mp_prod_access_token = form.mp_prod_access_token.trim();
      }
      if (form.mp_webhook_secret && form.mp_webhook_secret.trim()) {
        payload.mp_webhook_secret = form.mp_webhook_secret.trim();
      }
      if (form.ipag_sandbox_api_key && form.ipag_sandbox_api_key.trim()) {
        payload.ipag_sandbox_api_key = form.ipag_sandbox_api_key.trim();
      }
      if (form.ipag_prod_api_key && form.ipag_prod_api_key.trim()) {
        payload.ipag_prod_api_key = form.ipag_prod_api_key.trim();
      }

      const updated = await api.put('/api/admin/payments-config', payload);
      setCfg(updated);

      const sbId = updated.ipag_sandbox_api_id ?? updated.ipag?.sandbox_api_id ?? form.ipag_sandbox_api_id;
      const prId = updated.ipag_prod_api_id ?? updated.ipag?.prod_api_id ?? form.ipag_prod_api_id;

      setForm(prev => ({
        ...prev,
        mp_test_public_key: updated.test_public_key ?? prev.mp_test_public_key,
        mp_test_access_token: '',
        mp_prod_public_key: updated.prod_public_key ?? prev.mp_prod_public_key,
        mp_prod_access_token: '',
        mp_webhook_secret: '',
        ipag_sandbox_api_id: sbId,
        ipag_sandbox_api_key: '',
        ipag_prod_api_id: prId,
        ipag_prod_api_key: '',
      }));
      toast.success('Credenciais de pagamento salvas com sucesso');
    } catch (e) { toast.error(e?.message); }
    finally { setSaving(false); }
  };

  const setMpEnv = async (env) => {
    if (env === 'production' && !cfg.production_configured && form.mp_prod_access_token === '') {
      toast.error('Configure as credenciais de PRODUÇÃO do MercadoPago antes de ativar');
      return;
    }
    if (env === 'production' && !window.confirm('CUIDADO: ativar PRODUÇÃO no MercadoPago vai cobrar pagamentos REAIS. Continuar?')) return;
    setSaving(true);
    try {
      await api.put('/api/admin/payments-config', { mp_environment: env });
      toast.success(`Ambiente MercadoPago alterado para ${env === 'production' ? 'PRODUÇÃO' : 'SANDBOX/TESTE'}`);
      await load();
    } catch (e) { toast.error(e?.message); }
    finally { setSaving(false); }
  };

  const setIpagEnv = async (env) => {
    const isProdConfigured = cfg.ipag_prod_configured || cfg.ipag?.production_configured;
    if (env === 'production' && !isProdConfigured && form.ipag_prod_api_key === '') {
      toast.error('Configure as credenciais de PRODUÇÃO do iPag antes de ativar');
      return;
    }
    if (env === 'production' && !window.confirm('CUIDADO: ativar PRODUÇÃO no iPag vai cobrar pagamentos REAIS. Continuar?')) return;
    setSaving(true);
    try {
      await api.put('/api/admin/payments-config', { ipag_environment: env });
      toast.success(`Ambiente iPag alterado para ${env === 'production' ? 'PRODUÇÃO' : 'SANDBOX/TESTE'}`);
      await load();
    } catch (e) { toast.error(e?.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;
  if (!cfg) return null;

  const activeProvider = cfg.active_payment_provider || 'mercadopago';
  const mpWebhookUrl = `${backendUrl}/api/payments/webhook/mercadopago`;
  const ipagWebhookUrl = `${backendUrl}/api/payments/webhook/ipag`;

  return (
    <div data-testid="admin-payments">
      <div className="mb-6">
        <h1 className="font-heading font-black text-2xl flex items-center gap-3">
          <CreditCard className="w-7 h-7 text-brand-main" /> Gateways de Pagamento
        </h1>
        <p className="text-sm text-txt-secondary mt-1">
          Gerencie as integrações de pagamento (MercadoPago e iPag). Selecione qual gateway processará os pedidos.
        </p>
      </div>

      {/* SELETOR DE PROVIDER ATIVO */}
      <div className="bg-white rounded-xl border border-border p-6 mb-6">
        <h3 className="font-heading font-bold mb-3 flex items-center gap-2 text-base">
          <Zap className="w-5 h-5 text-amber-500" /> Gateway Principal Ativo
        </h3>
        <p className="text-xs text-txt-secondary mb-4">
          Defina qual integração de pagamento o e-commerce usará para processar transações de checkout.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* MERCADOPAGO */}
          <button
            onClick={() => setActiveProvider('mercadopago')}
            disabled={saving}
            className={`text-left p-5 rounded-xl border-2 transition relative ${activeProvider === 'mercadopago' ? 'border-sky-500 bg-sky-50/50 shadow-sm' : 'border-border bg-white hover:border-slate-300'}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-sky-700 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4" /> MercadoPago
              </div>
              {activeProvider === 'mercadopago' && <Badge variant="brand">ATIVO</Badge>}
            </div>
            <p className="text-xs text-txt-secondary">
              Checkout Transparente / Checkout Pro (Pix, Cartão, Boleto).
            </p>
            <div className="mt-3 text-[11px] flex items-center gap-2">
              <span>Ambiente: <b>{cfg.mp_environment === 'production' ? 'PRODUÇÃO' : 'Sandbox'}</b></span>
              {cfg.test_configured || cfg.production_configured ? (
                <span className="text-emerald-600 font-bold">✓ Configurado</span>
              ) : (
                <span className="text-amber-600">⚠ Pendente</span>
              )}
            </div>
          </button>

          {/* IPAG */}
          <button
            onClick={() => setActiveProvider('ipag')}
            disabled={saving}
            className={`text-left p-5 rounded-xl border-2 transition relative ${activeProvider === 'ipag' ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' : 'border-border bg-white hover:border-slate-300'}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-indigo-700 flex items-center gap-1.5">
                <Zap className="w-4 h-4" /> iPag Gateway
              </div>
              {activeProvider === 'ipag' && <Badge variant="brand">ATIVO</Badge>}
            </div>
            <p className="text-xs text-txt-secondary">
              Gateway v2 API direta (Pix QR Code, Cartão de Crédito e Boleto).
            </p>
            <div className="mt-3 text-[11px] flex items-center gap-2">
              <span>Ambiente: <b>{(cfg.ipag_environment || cfg.ipag?.ipag_environment) === 'production' ? 'PRODUÇÃO' : 'Sandbox'}</b></span>
              {(cfg.ipag_sandbox_configured || cfg.ipag?.sandbox_configured || cfg.ipag_prod_configured || cfg.ipag?.production_configured) ? (
                <span className="text-emerald-600 font-bold">✓ Configurado</span>
              ) : (
                <span className="text-amber-600">⚠ Pendente</span>
              )}
            </div>
          </button>

          {/* MOCK */}
          <button
            onClick={() => setActiveProvider('mock')}
            disabled={saving}
            className={`text-left p-5 rounded-xl border-2 transition relative ${activeProvider === 'mock' ? 'border-slate-600 bg-slate-100 shadow-sm' : 'border-border bg-white hover:border-slate-300'}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-slate-700 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Mock (Desenvolvimento)
              </div>
              {activeProvider === 'mock' && <Badge variant="neutral">ATIVO</Badge>}
            </div>
            <p className="text-xs text-txt-secondary">
              Simulador interno. Permite confirmar pagamentos com 1 clique para testes de fluxo.
            </p>
            <div className="mt-3 text-[11px] text-slate-500">
              Ideal para homologação e desenvolvimento local.
            </div>
          </button>
        </div>
      </div>

      {/* ABAS DE NAVEGAÇÃO INTERNA */}
      <div className="flex gap-2 mb-6 border-b border-border">
        {[
          { id: 'provider', label: 'Provedores & Ambientes' },
          { id: 'credentials', label: 'Credenciais & Chaves' },
          { id: 'logs', label: 'Logs & Payloads das Integrações' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition ${tab === t.id ? 'border-brand-main text-brand-main' : 'border-transparent text-txt-secondary hover:text-txt-primary'}`}
            data-testid={`tab-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* AMBIENTES & WEBHOOKS */}
      {tab === 'provider' && (
        <div className="space-y-6 max-w-4xl">
          {/* AMBIENTE MERCADOPAGO */}
          <div className="bg-white rounded-xl border border-border p-6">
            <h3 className="font-heading font-bold mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-sky-600" /> MercadoPago - Ambiente
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <button onClick={() => setMpEnv('test')} disabled={saving}
                className={`text-left p-4 rounded-xl border-2 transition ${cfg.mp_environment === 'test' ? 'border-sky-500 bg-sky-50/40' : 'border-border bg-white hover:border-slate-300'}`}>
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="warning">Sandbox</Badge>
                  {cfg.mp_environment === 'test' && <Badge variant="brand">ATIVO</Badge>}
                </div>
                <div className="font-bold text-sm">Sandbox (Testes)</div>
                <p className="text-xs text-txt-secondary mt-1">Sem cobrança real. Usa cartões e contas de teste MP.</p>
              </button>

              <button onClick={() => setMpEnv('production')} disabled={saving}
                className={`text-left p-4 rounded-xl border-2 transition ${cfg.mp_environment === 'production' ? 'border-red-500 bg-red-50/40' : 'border-border bg-white hover:border-slate-300'}`}>
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="error">Produção</Badge>
                  {cfg.mp_environment === 'production' && <Badge variant="error">ATIVO</Badge>}
                </div>
                <div className="font-bold text-sm">Produção</div>
                <p className="text-xs text-txt-secondary mt-1">Cobranças reais efetuadas nos cartões dos clientes.</p>
              </button>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-xs font-semibold text-slate-700 block mb-1 flex items-center gap-1">
                <Webhook className="w-3.5 h-3.5" /> URL Webhook MercadoPago:
              </span>
              <div className="font-mono text-xs text-slate-600 bg-white p-2 rounded border border-slate-200 break-all">{mpWebhookUrl}</div>
            </div>
          </div>

          {/* AMBIENTE IPAG */}
          <div className="bg-white rounded-xl border border-border p-6">
            <h3 className="font-heading font-bold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-600" /> iPag - Ambiente
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <button onClick={() => setIpagEnv('sandbox')} disabled={saving}
                className={`text-left p-4 rounded-xl border-2 transition ${(cfg.ipag_environment || cfg.ipag?.ipag_environment) === 'sandbox' ? 'border-indigo-500 bg-indigo-50/40' : 'border-border bg-white hover:border-slate-300'}`}>
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="warning">Sandbox</Badge>
                  {(cfg.ipag_environment || cfg.ipag?.ipag_environment) === 'sandbox' && <Badge variant="brand">ATIVO</Badge>}
                </div>
                <div className="font-bold text-sm">Sandbox (https://sandbox.ipag.com.br)</div>
                <p className="text-xs text-txt-secondary mt-1">Ambiente de homologação e testes de API v2.</p>
              </button>

              <button onClick={() => setIpagEnv('production')} disabled={saving}
                className={`text-left p-4 rounded-xl border-2 transition ${(cfg.ipag_environment || cfg.ipag?.ipag_environment) === 'production' ? 'border-red-500 bg-red-50/40' : 'border-border bg-white hover:border-slate-300'}`}>
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="error">Produção</Badge>
                  {(cfg.ipag_environment || cfg.ipag?.ipag_environment) === 'production' && <Badge variant="error">ATIVO</Badge>}
                </div>
                <div className="font-bold text-sm">Produção (https://api.ipag.com.br)</div>
                <p className="text-xs text-txt-secondary mt-1">Cobranças e processamento em produção real iPag.</p>
              </button>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-xs font-semibold text-slate-700 block mb-1 flex items-center gap-1">
                <Webhook className="w-3.5 h-3.5" /> URL Callback / Webhook iPag:
              </span>
              <div className="font-mono text-xs text-slate-600 bg-white p-2 rounded border border-slate-200 break-all">{ipagWebhookUrl}</div>
            </div>
          </div>
        </div>
      )}

      {/* CREDENCIAIS */}
      {tab === 'credentials' && (
        <div className="space-y-6 max-w-4xl">
          <div className="flex items-center justify-between">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2 flex-1 mr-4">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                As chaves de API secretas são salvas criptografadas. Deixe os campos de senha em branco se desejar manter o valor atual já salvo.
              </div>
            </div>
            <button onClick={() => setShowSecrets(s => !s)} className="text-xs text-txt-secondary hover:text-brand-main inline-flex items-center gap-1 bg-white p-2.5 rounded-lg border border-border">
              {showSecrets ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showSecrets ? 'Ocultar Senhas' : 'Mostrar Senhas'}
            </button>
          </div>

          {/* CREDENCIAIS IPAG */}
          <div className="bg-white rounded-xl border border-border p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
              <h3 className="font-heading font-bold text-indigo-700 flex items-center gap-2">
                <Zap className="w-5 h-5 text-indigo-600" /> Credenciais iPag Gateway
              </h3>
              <div className="flex items-center gap-2 text-xs">
                {(cfg.ipag_sandbox_configured || cfg.ipag?.sandbox_configured) && (
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    ✓ Sandbox salva
                  </span>
                )}
                {(cfg.ipag_prod_configured || cfg.ipag?.production_configured) && (
                  <span className="text-emerald-600 font-semibold flex items-center gap-1 ml-2">
                    ✓ Produção salva
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3 p-4 bg-indigo-50/30 rounded-xl border border-indigo-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-indigo-900 uppercase">Sandbox (Testes)</h4>
                  {(cfg.ipag_sandbox_configured || cfg.ipag?.sandbox_configured) && (
                    <Badge variant="success">Configurado</Badge>
                  )}
                </div>
                <Field
                  label="API ID (Sandbox)"
                  name="ipag_sandbox_api_id"
                  value={form.ipag_sandbox_api_id}
                  onChange={(v) => setForm(f => ({ ...f, ipag_sandbox_api_id: v }))}
                  testId="ipag-sandbox-id"
                  placeholder="Ex: sandbox_user ou email iPag"
                />
                <Field
                  label="API Key / Token (Sandbox)"
                  name="ipag_sandbox_api_key"
                  value={form.ipag_sandbox_api_key}
                  onChange={(v) => setForm(f => ({ ...f, ipag_sandbox_api_key: v }))}
                  type={showSecrets ? 'text' : 'password'}
                  placeholder={cfg.ipag_sandbox_api_key_masked || cfg.ipag?.sandbox_api_key_masked || 'Sua chave de sandbox'}
                  testId="ipag-sandbox-key"
                  hint={cfg.ipag_sandbox_api_key_masked || cfg.ipag?.sandbox_api_key_masked ? `Salva: ${cfg.ipag_sandbox_api_key_masked || cfg.ipag?.sandbox_api_key_masked}` : null}
                />
              </div>

              <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase">Produção</h4>
                  {(cfg.ipag_prod_configured || cfg.ipag?.production_configured) && (
                    <Badge variant="success">Configurado</Badge>
                  )}
                </div>
                <Field
                  label="API ID (Produção)"
                  name="ipag_prod_api_id"
                  value={form.ipag_prod_api_id}
                  onChange={(v) => setForm(f => ({ ...f, ipag_prod_api_id: v }))}
                  testId="ipag-prod-id"
                  placeholder="Ex: prod_user ou email iPag"
                />
                <Field
                  label="API Key / Token (Produção)"
                  name="ipag_prod_api_key"
                  value={form.ipag_prod_api_key}
                  onChange={(v) => setForm(f => ({ ...f, ipag_prod_api_key: v }))}
                  type={showSecrets ? 'text' : 'password'}
                  placeholder={cfg.ipag_prod_api_key_masked || cfg.ipag?.prod_api_key_masked || 'Sua chave de produção'}
                  testId="ipag-prod-key"
                  hint={cfg.ipag_prod_api_key_masked || cfg.ipag?.prod_api_key_masked ? `Salva: ${cfg.ipag_prod_api_key_masked || cfg.ipag?.prod_api_key_masked}` : null}
                />
              </div>
            </div>
          </div>

          {/* CREDENCIAIS MERCADOPAGO */}
          <div className="bg-white rounded-xl border border-border p-6 space-y-4">
            <h3 className="font-heading font-bold text-sky-700 flex items-center gap-2 border-b border-border pb-3">
              <CreditCard className="w-5 h-5 text-sky-600" /> Credenciais MercadoPago
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3 p-3 bg-sky-50/30 rounded-lg border border-sky-100">
                <h4 className="text-xs font-bold text-sky-900 uppercase">Sandbox (Testes)</h4>
                <Field label="Public Key (TEST)" value={form.mp_test_public_key} onChange={(v) => setForm(f => ({ ...f, mp_test_public_key: v }))} testId="mp-test-pub" placeholder="TEST-..." />
                <Field label="Access Token (TEST)" value={form.mp_test_access_token} onChange={(v) => setForm(f => ({ ...f, mp_test_access_token: v }))}
                  type={showSecrets ? 'text' : 'password'} placeholder={cfg.test_access_token_masked || 'TEST-...'} testId="mp-test-tok" />
              </div>

              <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <h4 className="text-xs font-bold text-slate-900 uppercase">Produção</h4>
                <Field label="Public Key (PROD)" value={form.mp_prod_public_key} onChange={(v) => setForm(f => ({ ...f, mp_prod_public_key: v }))} testId="mp-prod-pub" placeholder="APP_USR-..." />
                <Field label="Access Token (PROD)" value={form.mp_prod_access_token} onChange={(v) => setForm(f => ({ ...f, mp_prod_access_token: v }))}
                  type={showSecrets ? 'text' : 'password'} placeholder={cfg.prod_access_token_masked || 'APP_USR-...'} testId="mp-prod-tok" />
              </div>
            </div>

            <div className="pt-2">
              <Field label="MercadoPago Webhook Secret (HMAC SHA256)" value={form.mp_webhook_secret} onChange={(v) => setForm(f => ({ ...f, mp_webhook_secret: v }))}
                type={showSecrets ? 'text' : 'password'} placeholder={cfg.webhook_secret_masked || 'Secret opcional do MercadoPago'} testId="mp-secret" />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={saveCredentials} disabled={saving} data-testid="save-creds-btn" className="px-6 py-2.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Salvar Todas as Credenciais
            </Button>
          </div>
        </div>
      )}

      {/* LOGS & PAYLOADS DAS INTEGRAÇÕES */}
      {tab === 'logs' && (
        <div className="space-y-4">
          {/* CARDS DE RESUMO */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-medium block">Total de Registros</span>
              <span className="text-xl font-bold text-slate-900">{logsStats.total_all || logsTotal}</span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-medium block flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-blue-500" /> Enviados (Requests)
              </span>
              <span className="text-xl font-bold text-blue-600">{logsStats.outgoing || 0}</span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-medium block flex items-center gap-1">
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" /> Recebidos (Webhooks)
              </span>
              <span className="text-xl font-bold text-emerald-600">{logsStats.incoming || 0}</span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-medium block flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Erros / Falhas
              </span>
              <span className="text-xl font-bold text-rose-600">{logsStats.errors || 0}</span>
            </div>
          </div>

          {/* BARRA DE FILTROS & AÇÕES */}
          <div className="bg-white p-4 rounded-xl border border-border flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[300px]">
              {/* BUSCA POR TEXTO */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar pedido, transação, endpoint..."
                  value={logsFilter.search}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLogsFilter(f => ({ ...f, search: val }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') loadLogs(1);
                  }}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-main font-mono"
                />
              </div>

              {/* FILTRO PROVEDOR */}
              <select
                value={logsFilter.provider}
                onChange={(e) => {
                  const val = e.target.value;
                  const newFilter = { ...logsFilter, provider: val };
                  setLogsFilter(newFilter);
                  loadLogs(1, newFilter);
                }}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-main"
              >
                <option value="all">Todos Gateways</option>
                <option value="ipag">iPag Gateway</option>
                <option value="mercadopago">MercadoPago</option>
              </select>

              {/* FILTRO DIREÇÃO */}
              <select
                value={logsFilter.direction}
                onChange={(e) => {
                  const val = e.target.value;
                  const newFilter = { ...logsFilter, direction: val };
                  setLogsFilter(newFilter);
                  loadLogs(1, newFilter);
                }}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-main"
              >
                <option value="all">Todas Direções</option>
                <option value="outgoing">Enviados (Requests)</option>
                <option value="incoming">Recebidos (Webhooks)</option>
              </select>

              {/* FILTRO STATUS */}
              <select
                value={logsFilter.success}
                onChange={(e) => {
                  const val = e.target.value;
                  const newFilter = { ...logsFilter, success: val };
                  setLogsFilter(newFilter);
                  loadLogs(1, newFilter);
                }}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-main"
              >
                <option value="all">Todos os Status</option>
                <option value="true">Apenas Sucesso</option>
                <option value="false">Apenas Erros / Falhas</option>
              </select>

              <Button size="sm" variant="outline" onClick={() => loadLogs(1)}>
                <Filter className="w-3.5 h-3.5 mr-1" /> Filtrar
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => loadLogs(logsPage)} disabled={logsLoading}>
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${logsLoading ? 'animate-spin' : ''}`} /> Atualizar
              </Button>
              <Button size="sm" variant="ghost" onClick={clearAllLogs} className="text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Limpar
              </Button>
            </div>
          </div>

          {/* TABELA DE LOGS */}
          <div className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-border">
                  <tr>
                    <th className="text-left p-3">Data / Hora</th>
                    <th className="text-left p-3">Gateway</th>
                    <th className="text-left p-3">Direção</th>
                    <th className="text-left p-3">Ação / Endpoint</th>
                    <th className="text-left p-3">Pedido / ID</th>
                    <th className="text-center p-3">Status</th>
                    <th className="text-right p-3">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logsLoading && logs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-main" />
                        Carregando registros...
                      </td>
                    </tr>
                  )}
                  {!logsLoading && logs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-500">
                        <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        Nenhum registro de integração encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  )}
                  {logs.map((l, idx) => {
                    const isOutgoing = l.direction === 'outgoing';
                    const isSuccess = l.success !== false;
                    const statusCode = l.status_code;

                    return (
                      <tr key={l.log_id || idx} className="hover:bg-slate-50/60 transition-colors">
                        {/* DATA */}
                        <td className="p-3 text-xs whitespace-nowrap text-slate-600 font-mono">
                          {formatDateTime(l.created_at || l.received_at)}
                        </td>

                        {/* GATEWAY */}
                        <td className="p-3 text-xs">
                          {l.provider === 'ipag' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              <Zap className="w-3 h-3 text-indigo-500" /> iPag
                            </span>
                          ) : l.provider === 'mercadopago' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                              <CreditCard className="w-3 h-3 text-sky-500" /> MP
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                              {l.provider || 'Gateway'}
                            </span>
                          )}
                        </td>

                        {/* DIREÇÃO */}
                        <td className="p-3 text-xs whitespace-nowrap">
                          {isOutgoing ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              <ArrowUpRight className="w-3 h-3" /> Enviado (Req)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <ArrowDownLeft className="w-3 h-3" /> Recebido (Hook)
                            </span>
                          )}
                        </td>

                        {/* AÇÃO / ENDPOINT */}
                        <td className="p-3 text-xs">
                          <div className="font-semibold text-slate-800 font-mono text-[11px]">
                            {l.action || 'request'}
                          </div>
                          {l.endpoint && (
                            <div className="text-[10px] text-slate-400 font-mono truncate max-w-[220px]" title={l.endpoint}>
                              {l.method ? `${l.method} ` : ''}{l.endpoint}
                            </div>
                          )}
                        </td>

                        {/* PEDIDO / ID */}
                        <td className="p-3 text-xs font-mono">
                          {l.order_id ? (
                            <span className="font-bold text-slate-800">{l.order_id}</span>
                          ) : l.data_id ? (
                            <span className="text-slate-600 truncate max-w-[140px] block" title={l.data_id}>
                              ID: {l.data_id}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* STATUS */}
                        <td className="p-3 text-center text-xs whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isSuccess
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {isSuccess ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {statusCode ? `${statusCode}` : isSuccess ? 'OK' : 'Falha'}
                          </span>
                        </td>

                        {/* AÇÃO */}
                        <td className="p-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedLog(l);
                              setModalTab('request');
                            }}
                            className="text-xs h-7 px-2.5 hover:bg-slate-100"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1 text-slate-600" /> Ver Payload
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* PAGINAÇÃO */}
            {logsPages > 1 && (
              <div className="p-3 border-t border-border flex items-center justify-between bg-slate-50 text-xs text-slate-600">
                <span>Total: <b>{logsTotal}</b> registros • Página <b>{logsPage}</b> de <b>{logsPages}</b></span>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={logsPage <= 1 || logsLoading}
                    onClick={() => loadLogs(logsPage - 1)}
                    className="h-7 px-2"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={logsPage >= logsPages || logsLoading}
                    onClick={() => loadLogs(logsPage + 1)}
                    className="h-7 px-2"
                  >
                    Próxima <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* MODAL DE DETALHES DE PAYLOAD / RESPOSTA */}
          {selectedLog && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                {/* CABEÇALHO DO MODAL */}
                <div className="p-4 sm:p-5 border-b border-border bg-slate-50/80 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-heading font-bold text-base text-slate-900">
                        Detalhes da Integração
                      </h3>
                      {selectedLog.provider === 'ipag' ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-100 text-indigo-800">iPag</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-100 text-sky-800">MercadoPago</span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        selectedLog.direction === 'outgoing' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {selectedLog.direction === 'outgoing' ? 'Requisição Enviada' : 'Webhook Recebido'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        selectedLog.success !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        HTTP {selectedLog.status_code || (selectedLog.success !== false ? '200' : 'Erro')}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 font-mono flex items-center gap-3 flex-wrap">
                      <span>Ação: <b className="text-slate-700">{selectedLog.action || '-'}</b></span>
                      {selectedLog.order_id && <span>Pedido: <b className="text-slate-700">{selectedLog.order_id}</b></span>}
                      {selectedLog.data_id && <span>ID: <b className="text-slate-700">{selectedLog.data_id}</b></span>}
                      <span>Horário: <b>{formatDateTime(selectedLog.created_at || selectedLog.received_at)}</b></span>
                    </div>

                    {selectedLog.endpoint && (
                      <div className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded inline-block">
                        {selectedLog.method || 'POST'} {selectedLog.endpoint}
                      </div>
                    )}

                    {selectedLog.error_message && (
                      <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2 rounded-lg mt-1 font-mono">
                        <b>Erro:</b> {selectedLog.error_message}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setSelectedLog(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* ABAS DO MODAL */}
                <div className="flex border-b border-border bg-slate-50/50 px-4 pt-2 gap-2 text-xs font-semibold">
                  <button
                    onClick={() => setModalTab('request')}
                    className={`px-3 py-2 border-b-2 transition ${
                      modalTab === 'request'
                        ? 'border-brand-main text-brand-main'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Payload Enviado / Corpo (Request)
                  </button>
                  <button
                    onClick={() => setModalTab('response')}
                    className={`px-3 py-2 border-b-2 transition ${
                      modalTab === 'response'
                        ? 'border-brand-main text-brand-main'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Resposta Retornada (Response)
                  </button>
                  <button
                    onClick={() => setModalTab('headers')}
                    className={`px-3 py-2 border-b-2 transition ${
                      modalTab === 'headers'
                        ? 'border-brand-main text-brand-main'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Headers & Metadados
                  </button>
                </div>

                {/* CORPO DO MODAL COM CONTEÚDO FORMATADO */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-900 text-slate-100">
                  {modalTab === 'request' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span>Corpo / Payload ({selectedLog.direction === 'outgoing' ? 'enviado para o gateway' : 'recebido via webhook'})</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(selectedLog.request_payload || selectedLog.raw_body || {}, 'req')}
                          className="text-xs text-slate-300 hover:text-white hover:bg-slate-800 h-7"
                        >
                          {copiedKey === 'req' ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                          {copiedKey === 'req' ? 'Copiado!' : 'Copiar JSON'}
                        </Button>
                      </div>
                      <pre className="font-mono text-xs text-emerald-300 bg-slate-950 p-4 rounded-xl overflow-x-auto border border-slate-800 leading-relaxed whitespace-pre-wrap">
                        {JSON.stringify(selectedLog.request_payload ?? selectedLog.raw_body ?? { info: "Sem payload" }, null, 2)}
                      </pre>
                    </div>
                  )}

                  {modalTab === 'response' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span>Resposta do Provedor / Gateway</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(selectedLog.response_payload || {}, 'resp')}
                          className="text-xs text-slate-300 hover:text-white hover:bg-slate-800 h-7"
                        >
                          {copiedKey === 'resp' ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                          {copiedKey === 'resp' ? 'Copiado!' : 'Copiar JSON'}
                        </Button>
                      </div>
                      <pre className="font-mono text-xs text-sky-300 bg-slate-950 p-4 rounded-xl overflow-x-auto border border-slate-800 leading-relaxed whitespace-pre-wrap">
                        {JSON.stringify(selectedLog.response_payload ?? { info: "Sem payload de resposta" }, null, 2)}
                      </pre>
                    </div>
                  )}

                  {modalTab === 'headers' && (
                    <div className="space-y-4">
                      <div>
                        <span className="text-xs text-slate-400 block mb-1">Headers Enviados:</span>
                        <pre className="font-mono text-xs text-amber-200 bg-slate-950 p-3 rounded-xl overflow-x-auto border border-slate-800 whitespace-pre-wrap">
                          {JSON.stringify(selectedLog.headers_sent ?? { info: "Padrão da requisição" }, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 block mb-1">Headers Recebidos / Detalhes de Conexão:</span>
                        <pre className="font-mono text-xs text-amber-200 bg-slate-950 p-3 rounded-xl overflow-x-auto border border-slate-800 whitespace-pre-wrap">
                          {JSON.stringify(selectedLog.headers_received ?? selectedLog.headers ?? {}, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>

                {/* RODAPÉ DO MODAL */}
                <div className="p-3 sm:p-4 border-t border-border bg-slate-50 flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-400">Log ID: {selectedLog.log_id || 'N/A'}</span>
                  <Button size="sm" variant="outline" onClick={() => setSelectedLog(null)}>
                    Fechar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, testId, name, hint }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-semibold block text-slate-700">{label}</label>
        {hint && <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">{hint}</span>}
      </div>
      <input
        type={type}
        name={name}
        id={name}
        value={value || ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono focus:outline-none focus:border-brand-main bg-white"
        data-testid={testId}
        autoComplete="new-password"
      />
    </div>
  );
}
