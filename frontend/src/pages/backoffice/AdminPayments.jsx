import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { CreditCard, Loader2, AlertTriangle, RefreshCw, Save, Webhook, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '../../lib/utils';

export default function AdminPayments() {
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState([]);
  const [tab, setTab] = useState('config');
  const backendUrl = process.env.REACT_APP_BACKEND_URL;

  const load = async () => {
    try {
      const r = await api.get('/api/admin/payments-config');
      setCfg(r);
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

  const setEnv = async (env) => {
    if (env === 'production' && !cfg.production_configured) {
      toast.error('Tokens de PRODUÇÃO não configurados em .env');
      return;
    }
    if (env === 'production' && !confirm('CUIDADO: ativar PRODUÇÃO vai cobrar pagamentos REAIS dos clientes. Continuar?')) return;
    setSaving(true);
    try {
      await api.put('/api/admin/payments-config', { mp_environment: env });
      toast.success(`Ambiente alterado para ${env === 'production' ? 'PRODUÇÃO' : 'TESTE'}`);
      await load();
    } catch (e) { toast.error(e?.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;
  if (!cfg) return null;

  const isProd = cfg.mp_environment === 'production';
  const webhookUrl = `${backendUrl}/api/payments/webhook/mercadopago`;

  return (
    <div data-testid="admin-payments">
      <div className="mb-6">
        <h1 className="font-heading font-black text-2xl flex items-center gap-3">
          <CreditCard className="w-7 h-7 text-brand-main" /> Pagamentos (MercadoPago)
        </h1>
        <p className="text-sm text-txt-secondary mt-1">Configure ambiente de teste ou produção. Tokens vêm do .env.</p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-border">
        {['config', 'logs'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition ${tab === t ? 'border-brand-main text-brand-main' : 'border-transparent text-txt-secondary hover:text-txt-primary'}`}
            data-testid={`tab-${t}`}>
            {t === 'config' ? 'Configuração' : 'Webhook Logs'}
          </button>
        ))}
      </div>

      {tab === 'config' && (
        <div className="space-y-4 max-w-3xl">
          {/* Environment selector */}
          <div className="bg-white rounded-xl border border-border p-6">
            <h3 className="font-heading font-bold mb-4">Ambiente atual</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setEnv('test')}
                disabled={saving}
                className={`text-left p-5 rounded-xl border-2 transition ${cfg.mp_environment === 'test' ? 'border-brand-main bg-brand-light' : 'border-border bg-white hover:border-border'}`}
                data-testid="env-test-btn"
              >
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="warning">Sandbox</Badge>
                  {cfg.mp_environment === 'test' && <Badge variant="brand">ATIVO</Badge>}
                </div>
                <div className="font-bold mb-1">Ambiente de Testes</div>
                <p className="text-xs text-txt-secondary">Usuário de teste, sem cobrança real. Recomendado para desenvolvimento e homologação.</p>
                <div className="mt-3 text-[11px] text-txt-secondary">
                  Token: {cfg.test_configured ? <span className="text-emerald-600 font-bold">✓ Configurado</span> : <span className="text-red-600">Faltando</span>}
                </div>
              </button>
              <button
                onClick={() => setEnv('production')}
                disabled={saving}
                className={`text-left p-5 rounded-xl border-2 transition ${isProd ? 'border-red-500 bg-red-50' : 'border-border bg-white hover:border-border'}`}
                data-testid="env-prod-btn"
              >
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="error">Produção</Badge>
                  {isProd && <Badge variant="error">ATIVO</Badge>}
                </div>
                <div className="font-bold mb-1">Ambiente de Produção</div>
                <p className="text-xs text-txt-secondary">Cobrança real de clientes via MercadoPago. Use com cuidado.</p>
                <div className="mt-3 text-[11px] text-txt-secondary">
                  Token: {cfg.production_configured ? <span className="text-emerald-600 font-bold">✓ Configurado</span> : <span className="text-red-600">Faltando — adicione em .env</span>}
                </div>
              </button>
            </div>
            {isProd && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-800">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div><b>Modo Produção ATIVO.</b> Todos os pagamentos serão cobrados de verdade.</div>
              </div>
            )}
          </div>

          {/* Public keys info */}
          <div className="bg-white rounded-xl border border-border p-6 space-y-3">
            <h3 className="font-heading font-bold">Public Keys (somente leitura)</h3>
            <p className="text-xs text-txt-secondary">As chaves vêm das variáveis de ambiente do servidor. Para alterar, edite o arquivo <code>/app/backend/.env</code>.</p>
            <KV label="Test Public Key" value={cfg.test_public_key || '(não configurado)'} />
            <KV label="Production Public Key" value={cfg.production_public_key || '(não configurado)'} />
            <KV label="Webhook Secret" value={cfg.webhook_secret_configured ? '✓ Configurado' : 'Não configurado (recomendado configurar para validação HMAC)'} />
          </div>

          {/* Webhook URL */}
          <div className="bg-white rounded-xl border border-border p-6">
            <h3 className="font-heading font-bold mb-2 flex items-center gap-2"><Webhook className="w-5 h-5" /> URL de Webhook</h3>
            <p className="text-xs text-txt-secondary mb-3">
              Configure esta URL no painel MercadoPago em <a href="https://www.mercadopago.com.br/developers/panel/notifications/webhooks" target="_blank" rel="noreferrer" className="text-brand-main underline">Webhooks</a>:
            </p>
            <div className="bg-bg-secondary p-3 rounded font-mono text-xs break-all">{webhookUrl}</div>
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-txt-secondary">Últimos webhooks recebidos do MercadoPago.</p>
            <Button variant="outline" onClick={loadLogs}><RefreshCw className="w-4 h-4" /> Atualizar</Button>
          </div>
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
                  <tr>
                    <th className="text-left p-3">Recebido em</th>
                    <th className="text-left p-3">Tipo</th>
                    <th className="text-left p-3">Data ID</th>
                    <th className="text-center p-3">Assinatura</th>
                    <th className="text-left p-3">Pagamento</th>
                    <th className="text-left p-3">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-txt-secondary">Nenhum webhook recebido.</td></tr>}
                  {logs.map(l => (
                    <tr key={l.log_id} className="border-t border-border">
                      <td className="p-3 text-xs whitespace-nowrap">{formatDateTime(l.received_at)}</td>
                      <td className="p-3 text-xs">{l.type || '-'}</td>
                      <td className="p-3 text-xs font-mono">{l.data_id || '-'}</td>
                      <td className="p-3 text-center">
                        {l.valid_signature ? <Badge variant="success">OK</Badge> : <Badge variant="error">Inválida</Badge>}
                      </td>
                      <td className="p-3 text-xs">
                        {l.payment_details?.status ? <Badge variant={l.payment_details.status === 'approved' ? 'success' : 'warning'}>{l.payment_details.status}</Badge> : '-'}
                        {l.payment_details?.external_reference && <div className="font-mono text-[10px] mt-1">{l.payment_details.external_reference}</div>}
                      </td>
                      <td className="p-3 text-xs">{l.action || '-'}</td>
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

function KV({ label, value }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-txt-secondary uppercase mb-1">{label}</div>
      <div className="bg-bg-secondary p-2 rounded font-mono text-xs break-all">{value}</div>
    </div>
  );
}
