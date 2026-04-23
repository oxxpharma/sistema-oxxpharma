import React, { useEffect, useState } from 'react';
import { api, API_URL } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Webhook, Copy, RefreshCcw, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '../../lib/utils';

export default function AdminWebhook() {
  const [settings, setSettings] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showToken, setShowToken] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, l] = await Promise.all([
        api.get('/api/admin/settings'),
        api.get('/api/admin/webhook-logs'),
      ]);
      setSettings(s);
      setLogs(l.logs || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const regen = async () => {
    if (!window.confirm('Gerar novo token? O token antigo deixará de funcionar imediatamente.')) return;
    setRegenerating(true);
    try {
      const r = await api.post('/api/admin/webhook-token/regenerate');
      toast.success('Novo token gerado');
      setSettings({ ...settings, external_webhook_token: r.external_webhook_token });
    } catch (err) { toast.error(err.message); } finally { setRegenerating(false); }
  };

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); toast.success('Copiado'); } catch { toast.error('Não foi possível copiar'); }
  };

  if (loading || !settings) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;

  const webhookUrl = `${API_URL}/api/external/network1/sync`;
  const token = settings.external_webhook_token || '';
  const examplePayload = JSON.stringify({
    action: 'upsert',
    users: [
      { external_id: 'EXT001', name: 'João Silva', email: 'joao@ext.com', leader_external_id: null, phone: '11999998888' },
      { external_id: 'EXT002', name: 'Maria Costa', email: 'maria@ext.com', leader_external_id: 'EXT001' },
    ],
  }, null, 2);

  return (
    <div data-testid="admin-webhook">
      <div className="mb-6">
        <h1 className="font-heading font-black text-3xl text-txt-primary flex items-center gap-3">
          <Webhook className="w-7 h-7 text-brand-main" /> Sync externa (Rede 1)
        </h1>
        <p className="text-sm text-txt-secondary mt-1">API para o sistema externo enviar criação/atualização de usuários em tempo real.</p>
      </div>

      {/* URL e Token */}
      <div className="bg-white rounded-xl border border-border p-6 mb-6">
        <h2 className="font-heading font-black text-lg mb-4">Credenciais do webhook</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-txt-secondary mb-1.5 font-semibold uppercase tracking-wider">URL do endpoint (POST)</label>
            <div className="flex gap-2">
              <div className="flex-1 bg-bg-secondary border border-border rounded-lg p-3 font-mono text-sm break-all" data-testid="webhook-url">{webhookUrl}</div>
              <Button variant="outline" onClick={() => copy(webhookUrl)}><Copy className="w-4 h-4" /></Button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-txt-secondary mb-1.5 font-semibold uppercase tracking-wider">Token (envie no header <code>X-Webhook-Token</code>)</label>
            <div className="flex gap-2">
              <div className="flex-1 bg-bg-secondary border border-border rounded-lg p-3 font-mono text-sm break-all" data-testid="webhook-token">
                {showToken ? token : '•'.repeat(Math.max(16, token.length))}
              </div>
              <Button variant="outline" onClick={() => setShowToken(!showToken)} title={showToken ? 'Ocultar' : 'Revelar'}>
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button variant="outline" onClick={() => copy(token)}><Copy className="w-4 h-4" /></Button>
              <Button variant="danger" onClick={regen} loading={regenerating} data-testid="regen-token-btn"><RefreshCcw className="w-4 h-4" /> Regenerar</Button>
            </div>
            <p className="text-xs text-txt-secondary mt-2">Mantenha em segredo. Se vazar, regenere imediatamente.</p>
          </div>
        </div>
      </div>

      {/* Docs */}
      <div className="bg-white rounded-xl border border-border p-6 mb-6">
        <h2 className="font-heading font-black text-lg mb-3">Como integrar</h2>
        <ol className="list-decimal ml-5 text-sm space-y-2 text-txt-primary">
          <li>No sistema externo, crie uma integração que chame <code className="bg-bg-secondary px-1 rounded">POST {webhookUrl}</code> sempre que um usuário for criado/atualizado/removido.</li>
          <li>Inclua o header <code className="bg-bg-secondary px-1 rounded">X-Webhook-Token: [seu token]</code>.</li>
          <li>Envie o payload no formato JSON abaixo. Os campos obrigatórios são <code>external_id</code>, <code>name</code> e <code>email</code>. <code>leader_external_id</code> é o ID do patrocinador/líder.</li>
          <li>Para <strong>remover</strong> um usuário da rede, envie <code>{'"action": "delete"'}</code> — ele não é deletado, apenas volta a <code>customer</code>.</li>
        </ol>

        <div className="mt-4 grid md:grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-bold text-txt-secondary mb-1">Exemplo de payload</div>
            <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-auto max-h-80" data-testid="payload-example">{examplePayload}</pre>
          </div>
          <div>
            <div className="text-xs font-bold text-txt-secondary mb-1">Exemplo cURL</div>
            <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-auto max-h-80">{`curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Token: ${showToken ? token : '<seu-token>'}" \\
  -d '${examplePayload.replace(/\n/g, ' ').replace(/\s+/g, ' ')}'`}</pre>
          </div>
        </div>
      </div>

      {/* Logs */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-heading font-black text-lg">Histórico de chamadas</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
              <tr>
                <th className="text-left p-3">Data</th>
                <th className="text-center p-3">Autenticado</th>
                <th className="text-left p-3">Ação</th>
                <th className="text-right p-3">Usuários</th>
                <th className="text-left p-3">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.log_id} className="border-t border-border" data-testid={`whk-log-${l.log_id}`}>
                  <td className="p-3 text-xs">{formatDateTime(l.created_at)}</td>
                  <td className="p-3 text-center">
                    {l.authorized
                      ? <span className="inline-flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle2 className="w-3.5 h-3.5" /> OK</span>
                      : <span className="inline-flex items-center gap-1 text-red-500 text-xs"><AlertCircle className="w-3.5 h-3.5" /> Token inválido</span>
                    }
                  </td>
                  <td className="p-3 text-xs">{l.action || '-'}</td>
                  <td className="p-3 text-right">{l.users_count ?? '-'}</td>
                  <td className="p-3 text-xs font-mono">
                    {l.stats ? `c:${l.stats.created || 0} u:${l.stats.updated || 0} d:${l.stats.deleted || 0}` : '-'}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-txt-secondary">Nenhuma chamada ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
