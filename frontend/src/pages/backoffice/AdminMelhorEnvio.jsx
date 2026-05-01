import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatDateTime } from '../../lib/utils';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Loader2, ExternalLink, Truck, Save, LinkIcon, Unlink, RefreshCw, CheckCircle2, AlertCircle, Zap, Copy } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminMelhorEnvio() {
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [params] = useSearchParams();
  const [testForm, setTestForm] = useState({ cep_origin: '', cep_destination: '01310100', weight_kg: 0.5, length_cm: 16, width_cm: 11, height_cm: 2, insurance_value: 100 });
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const load = async () => {
    try { setCfg(await api.get('/api/admin/melhorenvio/config')); } catch (e) { toast.error(e?.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // Handle OAuth callback result
  useEffect(() => {
    const success = params.get('me_success');
    const err = params.get('me_error');
    const desc = params.get('me_desc');
    if (success) { toast.success('Melhor Envio conectado com sucesso!'); load(); }
    else if (err) { toast.error(`Erro ao conectar: ${err}${desc ? ' — ' + desc : ''}`); }
    // eslint-disable-next-line
  }, []);

  const set = (k, v) => setCfg({ ...cfg, [k]: v });

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...cfg };
      // Se o secret foi mascarado, não enviar
      if (payload.client_secret && payload.client_secret.includes('•')) delete payload.client_secret;
      const updated = await api.put('/api/admin/melhorenvio/config', payload);
      setCfg(updated);
      toast.success('Configuração salva');
    } catch (e) { toast.error(e?.message); }
    finally { setSaving(false); }
  };

  const connect = async () => {
    setConnecting(true);
    try {
      // Salvar antes para garantir que client_id/redirect_uri estão persistidos
      await save();
      const r = await api.post('/api/admin/melhorenvio/authorize-url');
      if (r.authorize_url) window.location.href = r.authorize_url;
    } catch (e) { toast.error(e?.message); }
    finally { setConnecting(false); }
  };

  const disconnect = async () => {
    if (!window.confirm('Desconectar a conta do Melhor Envio?')) return;
    try {
      await api.post('/api/admin/melhorenvio/disconnect');
      toast.success('Desconectado');
      load();
    } catch (e) { toast.error(e?.message); }
  };

  const refresh = async () => {
    try {
      await api.post('/api/admin/melhorenvio/refresh');
      toast.success('Token renovado');
      load();
    } catch (e) { toast.error(e?.message); }
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.post('/api/admin/melhorenvio/test-calculate', testForm);
      setTestResult(r);
      if (r.error) toast.error(r.error);
      else toast.success(`${(r.options || []).length} opções retornadas`);
    } catch (e) { toast.error(e?.message); }
    finally { setTesting(false); }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(cfg.suggested_callback_url);
    toast.success('URL copiada');
  };

  if (loading || !cfg) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-main" /></div>;

  const connected = cfg.connected;

  return (
    <div className="max-w-4xl" data-testid="admin-melhor-envio">
      <div className="mb-6">
        <h1 className="font-heading font-black text-2xl text-txt-primary flex items-center gap-2">
          <Truck className="w-6 h-6 text-brand-main" /> Melhor Envio
        </h1>
        <p className="text-sm text-txt-secondary mt-1">
          Cálculo de frete multi-transportadora (Correios PAC/SEDEX, JadLog, Loggi, etc.) sem contrato direto.
        </p>
      </div>

      {/* Status */}
      <div className={`mb-6 rounded-xl p-4 border-2 ${connected ? 'bg-emerald-50 border-emerald-300' : 'bg-amber-50 border-amber-300'}`}>
        <div className="flex items-center gap-3">
          {connected ? <CheckCircle2 className="w-6 h-6 text-emerald-600" /> : <AlertCircle className="w-6 h-6 text-amber-600" />}
          <div className="flex-1">
            <div className={`font-bold ${connected ? 'text-emerald-900' : 'text-amber-900'}`}>
              {connected ? 'Conectado' : 'Não conectado'}
            </div>
            <div className={`text-xs ${connected ? 'text-emerald-800' : 'text-amber-800'}`}>
              {connected
                ? `Token expira em ${cfg.token_expires_at ? formatDateTime(cfg.token_expires_at) : '—'} · Última renovação ${cfg.token_last_refresh_at ? formatDateTime(cfg.token_last_refresh_at) : '—'}`
                : 'Configure as credenciais abaixo e clique em "Conectar ao Melhor Envio".'}
            </div>
          </div>
          {connected && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={refresh}><RefreshCw className="w-3.5 h-3.5" /> Renovar</Button>
              <Button size="sm" variant="outline" onClick={disconnect}><Unlink className="w-3.5 h-3.5" /> Desconectar</Button>
            </div>
          )}
        </div>
      </div>

      {/* Tutorial */}
      <Card title="Como configurar">
        <ol className="text-sm space-y-2 list-decimal pl-5">
          <li>Acesse <a href="https://melhorenvio.com.br/painel/gerenciar/tokens" target="_blank" rel="noreferrer" className="text-brand-main underline inline-flex items-center gap-1">Painel → Tokens <ExternalLink className="w-3 h-3" /></a> e clique em <b>Adicionar Aplicação</b>.</li>
          <li>Ao criar, copie a URL abaixo para o campo <b>Redirect URI</b>:</li>
        </ol>
        <div className="mt-3 bg-bg-secondary rounded-lg p-3 flex items-center gap-2">
          <code className="text-xs flex-1 font-mono break-all">{cfg.suggested_callback_url}</code>
          <Button size="sm" variant="outline" onClick={copyUrl}><Copy className="w-3.5 h-3.5" /> Copiar</Button>
        </div>
        <ol start={3} className="text-sm space-y-2 list-decimal pl-5 mt-3">
          <li>Após criar, copie o <b>Client ID</b> e <b>Client Secret</b> e cole abaixo.</li>
          <li>Clique em <b>Salvar</b> e depois em <b>Conectar ao Melhor Envio</b> (você será redirecionado para autorizar).</li>
        </ol>
      </Card>

      <Card title="Credenciais">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="Client ID" value={cfg.client_id} onChange={(v) => set('client_id', v)} testId="me-client-id" />
          <FormField label="Client Secret" value={cfg.client_secret} onChange={(v) => set('client_secret', v)} placeholder={cfg.has_client_secret ? '(já salvo — preencha para alterar)' : ''} testId="me-client-secret" />
          <FormField label="Redirect URI" value={cfg.redirect_uri || cfg.suggested_callback_url} onChange={(v) => set('redirect_uri', v)} testId="me-redirect" hint="Deve bater EXATAMENTE com o cadastrado no Melhor Envio." />
          <FormField label="CEP de origem (loja)" value={cfg.origin_postal_code} onChange={(v) => set('origin_postal_code', v)} placeholder="00000000" testId="me-cep-origin" />
        </div>
        <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
          <input type="checkbox" checked={cfg.sandbox !== false} onChange={(e) => set('sandbox', e.target.checked)} data-testid="me-sandbox" />
          <span className="text-sm">Usar <b>ambiente sandbox</b> (recomendado para testes)</span>
        </label>
        <div className="flex gap-2 mt-4">
          <Button onClick={save} disabled={saving} data-testid="me-save"><Save className="w-4 h-4" />{saving ? 'Salvando...' : 'Salvar'}</Button>
          {!connected && (
            <Button variant="outline" onClick={connect} disabled={connecting || !cfg.client_id} data-testid="me-connect">
              <LinkIcon className="w-4 h-4" />{connecting ? 'Abrindo...' : 'Conectar ao Melhor Envio'}
            </Button>
          )}
        </div>
      </Card>

      {/* Teste rápido */}
      {connected && (
        <Card title="Teste rápido de cotação">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <FormField label="CEP origem (vazio = usar config)" value={testForm.cep_origin} onChange={(v) => setTestForm({ ...testForm, cep_origin: v })} placeholder={cfg.origin_postal_code || '00000000'} />
            <FormField label="CEP destino" value={testForm.cep_destination} onChange={(v) => setTestForm({ ...testForm, cep_destination: v })} />
            <FormField label="Peso (kg)" type="number" value={testForm.weight_kg} onChange={(v) => setTestForm({ ...testForm, weight_kg: parseFloat(v) || 0 })} />
            <FormField label="Valor declarado (R$)" type="number" value={testForm.insurance_value} onChange={(v) => setTestForm({ ...testForm, insurance_value: parseFloat(v) || 0 })} />
            <FormField label="Comprimento (cm)" type="number" value={testForm.length_cm} onChange={(v) => setTestForm({ ...testForm, length_cm: parseFloat(v) || 0 })} />
            <FormField label="Largura (cm)" type="number" value={testForm.width_cm} onChange={(v) => setTestForm({ ...testForm, width_cm: parseFloat(v) || 0 })} />
            <FormField label="Altura (cm)" type="number" value={testForm.height_cm} onChange={(v) => setTestForm({ ...testForm, height_cm: parseFloat(v) || 0 })} />
          </div>
          <Button onClick={runTest} disabled={testing} data-testid="me-test"><Zap className="w-4 h-4" />{testing ? 'Calculando...' : 'Testar cotação'}</Button>

          {testResult && (
            <div className="mt-4">
              {testResult.error ? (
                <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-3 rounded-lg">{testResult.error}</div>
              ) : (
                <div className="border border-border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
                      <tr>
                        <th className="text-left p-2">Transportadora</th>
                        <th className="text-left p-2">Serviço</th>
                        <th className="text-right p-2">Preço</th>
                        <th className="text-center p-2">Prazo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(testResult.options || []).map(o => (
                        <tr key={o.service_id} className="border-t border-border">
                          <td className="p-2 flex items-center gap-2">
                            {o.company_picture && <img src={o.company_picture} alt={o.company_name} className="w-5 h-5 object-contain" />}
                            {o.company_name}
                          </td>
                          <td className="p-2">{o.service_name}</td>
                          <td className="p-2 text-right font-bold">R$ {o.price.toFixed(2)}</td>
                          <td className="p-2 text-center text-xs">{o.delivery_days}d</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="bg-white border border-border rounded-xl p-5 mb-4">
      <h2 className="font-bold text-base mb-3">{title}</h2>
      {children}
    </div>
  );
}

function FormField({ label, value, onChange, placeholder, type = 'text', hint, testId }) {
  return (
    <div>
      <label className="text-xs font-semibold block mb-1">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono"
        data-testid={testId}
      />
      {hint && <p className="text-xs text-txt-secondary mt-1">{hint}</p>}
    </div>
  );
}
