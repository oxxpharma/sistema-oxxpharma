import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { CreditCard, Loader2, AlertTriangle, RefreshCw, Save, Webhook, Eye, EyeOff, ShieldCheck, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '../../lib/utils';

export default function AdminPayments() {
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState([]);
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
      setForm({
        mp_test_public_key: r.test_public_key || '',
        mp_test_access_token: '',
        mp_prod_public_key: r.prod_public_key || '',
        mp_prod_access_token: '',
        mp_webhook_secret: '',
        ipag_sandbox_api_id: r.ipag_sandbox_api_id || '',
        ipag_sandbox_api_key: '',
        ipag_prod_api_id: r.ipag_prod_api_id || '',
        ipag_prod_api_key: '',
      });
    } finally { setLoading(false); }
  };

  const loadLogs = async () => {
    try {
      const r = await api.get('/api/admin/payments-webhook-logs');
      setLogs(r.logs || []);
    } catch (e) { toast.error(e?.message); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === 'logs') loadLogs(); }, [tab]);

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
      const payload = {};
      if (form.mp_test_public_key !== cfg.test_public_key) payload.mp_test_public_key = form.mp_test_public_key;
      if (form.mp_test_access_token) payload.mp_test_access_token = form.mp_test_access_token;
      if (form.mp_prod_public_key !== cfg.prod_public_key) payload.mp_prod_public_key = form.mp_prod_public_key;
      if (form.mp_prod_access_token) payload.mp_prod_access_token = form.mp_prod_access_token;
      if (form.mp_webhook_secret) payload.mp_webhook_secret = form.mp_webhook_secret;

      if (form.ipag_sandbox_api_id !== cfg.ipag_sandbox_api_id) payload.ipag_sandbox_api_id = form.ipag_sandbox_api_id;
      if (form.ipag_sandbox_api_key) payload.ipag_sandbox_api_key = form.ipag_sandbox_api_key;
      if (form.ipag_prod_api_id !== cfg.ipag_prod_api_id) payload.ipag_prod_api_id = form.ipag_prod_api_id;
      if (form.ipag_prod_api_key) payload.ipag_prod_api_key = form.ipag_prod_api_key;

      await api.put('/api/admin/payments-config', payload);
      toast.success('Credenciais de pagamento salvas com sucesso');
      await load();
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
    if (env === 'production' && !cfg.ipag_prod_configured && form.ipag_prod_api_key === '') {
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
              <span>Ambiente: <b>{cfg.ipag_environment === 'production' ? 'PRODUÇÃO' : 'Sandbox'}</b></span>
              {cfg.ipag_sandbox_configured || cfg.ipag_prod_configured ? (
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
          { id: 'logs', label: 'Webhook Logs' }
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
                className={`text-left p-4 rounded-xl border-2 transition ${cfg.ipag_environment === 'sandbox' ? 'border-indigo-500 bg-indigo-50/40' : 'border-border bg-white hover:border-slate-300'}`}>
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="warning">Sandbox</Badge>
                  {cfg.ipag_environment === 'sandbox' && <Badge variant="brand">ATIVO</Badge>}
                </div>
                <div className="font-bold text-sm">Sandbox (https://sandbox.ipag.com.br)</div>
                <p className="text-xs text-txt-secondary mt-1">Ambiente de homologação e testes de API v2.</p>
              </button>

              <button onClick={() => setIpagEnv('production')} disabled={saving}
                className={`text-left p-4 rounded-xl border-2 transition ${cfg.ipag_environment === 'production' ? 'border-red-500 bg-red-50/40' : 'border-border bg-white hover:border-slate-300'}`}>
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="error">Produção</Badge>
                  {cfg.ipag_environment === 'production' && <Badge variant="error">ATIVO</Badge>}
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
            <h3 className="font-heading font-bold text-indigo-700 flex items-center gap-2 border-b border-border pb-3">
              <Zap className="w-5 h-5 text-indigo-600" /> Credenciais iPag Gateway
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3 p-3 bg-indigo-50/30 rounded-lg border border-indigo-100">
                <h4 className="text-xs font-bold text-indigo-900 uppercase">Sandbox (Testes)</h4>
                <Field label="API ID (Sandbox)" value={form.ipag_sandbox_api_id} onChange={(v) => setForm(f => ({ ...f, ipag_sandbox_api_id: v }))} testId="ipag-sandbox-id" placeholder="Ex: sandbox_user" />
                <Field label="API Key / Token (Sandbox)" value={form.ipag_sandbox_api_key} onChange={(v) => setForm(f => ({ ...f, ipag_sandbox_api_key: v }))}
                  type={showSecrets ? 'text' : 'password'} placeholder={cfg.ipag_sandbox_api_key_masked || 'Sua chave de sandbox'} testId="ipag-sandbox-key" />
              </div>

              <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <h4 className="text-xs font-bold text-slate-900 uppercase">Produção</h4>
                <Field label="API ID (Produção)" value={form.ipag_prod_api_id} onChange={(v) => setForm(f => ({ ...f, ipag_prod_api_id: v }))} testId="ipag-prod-id" placeholder="Ex: prod_user" />
                <Field label="API Key / Token (Produção)" value={form.ipag_prod_api_key} onChange={(v) => setForm(f => ({ ...f, ipag_prod_api_key: v }))}
                  type={showSecrets ? 'text' : 'password'} placeholder={cfg.ipag_prod_api_key_masked || 'Sua chave de produção'} testId="ipag-prod-key" />
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

      {/* LOGS */}
      {tab === 'logs' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-txt-secondary">Últimos logs de webhooks e retornos dos gateways.</p>
            <Button variant="outline" onClick={loadLogs}><RefreshCw className="w-4 h-4" /> Atualizar</Button>
          </div>
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
                  <tr>
                    <th className="text-left p-3">Recebido em</th>
                    <th className="text-left p-3">Gateway</th>
                    <th className="text-left p-3">Pedido / ID</th>
                    <th className="text-center p-3">Status</th>
                    <th className="text-left p-3">Ação executada</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-txt-secondary">Nenhum webhook recebido.</td></tr>}
                  {logs.map(l => (
                    <tr key={l.log_id || Math.random()} className="border-t border-border hover:bg-slate-50/50">
                      <td className="p-3 text-xs whitespace-nowrap">{formatDateTime(l.received_at)}</td>
                      <td className="p-3 text-xs font-bold">
                        {l.provider === 'ipag' ? <span className="text-indigo-600">iPag</span> : <span className="text-sky-600">MercadoPago</span>}
                      </td>
                      <td className="p-3 text-xs font-mono">{l.order_id || l.data_id || '-'}</td>
                      <td className="p-3 text-center text-xs">
                        <Badge variant={l.action === 'marked_paid' ? 'success' : 'neutral'}>
                          {l.status || l.payment_details?.status || 'Recebido'}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs font-mono">{l.action || '-'}</td>
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

function Field({ label, value, onChange, type = 'text', placeholder, testId }) {
  return (
    <div>
      <label className="text-xs font-semibold block mb-1 text-slate-700">{label}</label>
      <input type={type} value={value || ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono focus:outline-none focus:border-brand-main bg-white"
        data-testid={testId} autoComplete="off" />
    </div>
  );
}
