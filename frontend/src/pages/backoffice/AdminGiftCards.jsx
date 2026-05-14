import React, { useEffect, useState } from 'react';
import { api, API_URL } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { CreditCard, Loader2, Play, Settings, FileText, ListOrdered, PlusCircle, Trash2, Save, Send, Download, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDateTime } from '../../lib/utils';

const TABS = [
  { key: 'config', label: 'Configuração', icon: Settings },
  { key: 'fields', label: 'Form. de adesão', icon: ListOrdered },
  { key: 'batches', label: 'Lotes', icon: Send },
  { key: 'logs', label: 'Logs da API', icon: FileText },
];

export default function AdminGiftCards() {
  const [tab, setTab] = useState('config');
  return (
    <div data-testid="admin-giftcards">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading font-black text-2xl flex items-center gap-3">
            <CreditCard className="w-7 h-7 text-brand-main" /> Cartão de Benefícios
          </h1>
          <p className="text-sm text-txt-secondary mt-1">Programa de indicação + envio diário de cashbacks.</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-border overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            data-testid={`tab-${t.key}`}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${tab === t.key ? 'border-brand-main text-brand-main' : 'border-transparent text-txt-secondary hover:text-txt-primary'}`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'config' && <ConfigTab />}
      {tab === 'fields' && <FieldsTab />}
      {tab === 'batches' && <BatchesTab />}
      {tab === 'logs' && <LogsTab />}
    </div>
  );
}

// ============ CONFIG ============
function ConfigTab() {
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const c = await api.get('/api/admin/card-config');
    setCfg(c);
  };
  useEffect(() => { (async () => { try { await load(); } finally { setLoading(false); } })(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { enrollment_fields, ...rest } = cfg; // eslint-disable-line no-unused-vars
      const updated = await api.put('/api/admin/card-config', rest);
      setCfg(updated);
      toast.success('Configuração salva!');
    } catch (e) { toast.error(e?.message || 'Erro'); }
    finally { setSaving(false); }
  };

  const resetReferrals = async () => {
    if (!window.confirm('Isso vai DESATIVAR o programa de indicação de TODOS os usuários (exceto admin) e zerar os códigos. Continuar?')) return;
    try {
      const r = await api.post('/api/admin/reset-all-referrals');
      toast.success(`${r.updated} usuários resetados`);
    } catch (e) { toast.error('Erro ao resetar'); }
  };

  if (loading) return <Loader />;
  if (!cfg) return null;

  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-heading font-bold">Status do programa</h3>
            <p className="text-xs text-txt-secondary">Habilita o CRON diário e o recebimento de cashbacks via cartão.</p>
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer" data-testid="toggle-enabled">
            <input
              type="checkbox"
              checked={!!cfg.enabled}
              onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}
              className="w-5 h-5 accent-brand-main"
            />
            <span className="text-sm font-semibold">{cfg.enabled ? 'Ativado' : 'Desativado'}</span>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hora do envio (0-23)" value={cfg.cron_hour} onChange={(v) => setCfg({ ...cfg, cron_hour: parseInt(v || 0) })} type="number" testId="cfg-hour" />
          <Field label="Minuto do envio (0-59)" value={cfg.cron_minute} onChange={(v) => setCfg({ ...cfg, cron_minute: parseInt(v || 0) })} type="number" testId="cfg-minute" />
        </div>
        <p className="text-xs text-txt-secondary mt-2">Fuso horário: America/Sao_Paulo (GMT-3).</p>
      </Card>

      <Card>
        <h3 className="font-heading font-bold mb-1">API do Cartão (envio diário)</h3>
        <p className="text-xs text-txt-secondary mb-4">Endpoint POST para onde o lote consolidado do dia é enviado. Se deixar em branco, o lote fica disponível só para download em CSV.</p>
        <div className="space-y-3">
          <Field label="URL" value={cfg.api_url} onChange={(v) => setCfg({ ...cfg, api_url: v })} testId="cfg-api-url" placeholder="https://api.cartao.com/batch" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Método" value={cfg.api_method} onChange={(v) => setCfg({ ...cfg, api_method: v })} options={['POST', 'PUT']} testId="cfg-api-method" />
            <Field label="Timeout (seg)" type="number" value={cfg.api_timeout_seconds} onChange={(v) => setCfg({ ...cfg, api_timeout_seconds: parseInt(v || 30) })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Autenticação" value={cfg.api_auth_type} onChange={(v) => setCfg({ ...cfg, api_auth_type: v })} options={['none', 'bearer', 'apikey', 'basic']} testId="cfg-auth-type" />
            <Field label="Valor do auth (token/key/user:pass)" value={cfg.api_auth_value} onChange={(v) => setCfg({ ...cfg, api_auth_value: v })} />
          </div>
          {cfg.api_auth_type === 'apikey' && (
            <Field label="Nome do header da API Key" value={cfg.api_auth_header_name} onChange={(v) => setCfg({ ...cfg, api_auth_header_name: v })} />
          )}
          <Field label='Headers extras (JSON)' value={cfg.api_extra_headers} onChange={(v) => setCfg({ ...cfg, api_extra_headers: v })} placeholder='{"X-Client":"OxxPharma"}' />
          <Textarea label="Template do payload (opcional, usa {{batch_json}})" value={cfg.api_payload_template} onChange={(v) => setCfg({ ...cfg, api_payload_template: v })} rows={4} />
        </div>
      </Card>

      <Card>
        <h3 className="font-heading font-bold mb-1">Aprovação automática de adesões</h3>
        <p className="text-xs text-txt-secondary mb-4">
          Quando ativado, novas solicitações de adesão ao Programa de Benefícios são aprovadas automaticamente após o tempo definido. Útil para evitar acúmulo manual.
        </p>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!cfg.auto_approve_enrollment}
              onChange={(e) => setCfg({ ...cfg, auto_approve_enrollment: e.target.checked })}
              className="w-5 h-5 accent-brand-main"
              data-testid="cfg-auto-approve"
            />
            <span className="font-semibold text-sm">Ativar aprovação automática</span>
          </label>
          <Field
            label="Delay antes de aprovar (em minutos)"
            value={cfg.auto_approve_delay_minutes}
            onChange={(v) => setCfg({ ...cfg, auto_approve_delay_minutes: Math.max(0, parseInt(v || 0)) })}
            type="number"
            testId="cfg-auto-approve-delay"
          />
          <p className="text-[11px] text-txt-secondary">
            Recomendado: 60 a 1440 minutos (1h a 24h). Use 0 para aprovar quase instantaneamente (verificação roda a cada minuto).
          </p>
        </div>
      </Card>

      <Card>
        <h3 className="font-heading font-bold mb-1">API do Cartão (cadastro de beneficiário)</h3>
        <p className="text-xs text-txt-secondary mb-4">Chamada opcional feita quando o usuário adere ao programa (envia os dados do formulário).</p>
        <div className="space-y-3">
          <Field label="URL" value={cfg.enrollment_api_url} onChange={(v) => setCfg({ ...cfg, enrollment_api_url: v })} placeholder="https://api.cartao.com/beneficiario" />
          <Select label="Método" value={cfg.enrollment_api_method} onChange={(v) => setCfg({ ...cfg, enrollment_api_method: v })} options={['POST', 'PUT']} />
          <Textarea label="Template do payload (opcional, usa {{batch_json}} como variável com {user,enrollment,body})" value={cfg.enrollment_api_payload_template} onChange={(v) => setCfg({ ...cfg, enrollment_api_payload_template: v })} rows={3} />
        </div>
      </Card>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="outline" className="text-red-600 border-red-200" onClick={resetReferrals} data-testid="reset-referrals-btn">
          <AlertTriangle className="w-4 h-4" /> Resetar todos os links de indicação
        </Button>
        <Button onClick={save} disabled={saving} data-testid="save-config-btn">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar configurações
        </Button>
      </div>
    </div>
  );
}

// ============ FIELDS ============
function FieldsTab() {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const c = await api.get('/api/admin/card-config');
        setFields(c.enrollment_fields || []);
      } finally { setLoading(false); }
    })();
  }, []);

  const setField = (i, patch) => setFields(fs => fs.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  const remove = (i) => setFields(fs => fs.filter((_, idx) => idx !== i));
  const add = () => setFields(fs => [...fs, { key: `field_${fs.length + 1}`, label: '', type: 'text', required: false }]);

  const save = async () => {
    // valida keys únicas e preenchidas
    const keys = new Set();
    for (const f of fields) {
      if (!f.key || !f.label) { toast.error('Todos os campos precisam de key e label'); return; }
      if (keys.has(f.key)) { toast.error(`Key duplicada: ${f.key}`); return; }
      keys.add(f.key);
    }
    setSaving(true);
    try {
      await api.put('/api/admin/card-config', { enrollment_fields: fields });
      toast.success('Campos do formulário salvos!');
    } catch (e) { toast.error('Erro ao salvar'); }
    finally { setSaving(false); }
  };

  if (loading) return <Loader />;

  return (
    <div className="space-y-4 max-w-4xl">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-heading font-bold">Campos do formulário de adesão</h3>
            <p className="text-xs text-txt-secondary">O usuário preenche isso ao aderir ao programa. Os dados vão para o cartão.</p>
          </div>
          <Button variant="outline" onClick={add} data-testid="add-field-btn"><PlusCircle className="w-4 h-4" /> Adicionar campo</Button>
        </div>
        <div className="space-y-3">
          {fields.map((f, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 border border-border rounded-lg" data-testid={`field-row-${i}`}>
              <div className="col-span-12 md:col-span-3">
                <label className="text-[11px] font-semibold">Key (chave interna)</label>
                <input value={f.key} onChange={(e) => setField(i, { key: e.target.value.replace(/\s+/g, '_') })} className="w-full px-2 py-1.5 border border-border rounded text-sm" />
              </div>
              <div className="col-span-12 md:col-span-3">
                <label className="text-[11px] font-semibold">Label (exibido)</label>
                <input value={f.label} onChange={(e) => setField(i, { label: e.target.value })} className="w-full px-2 py-1.5 border border-border rounded text-sm" />
              </div>
              <div className="col-span-6 md:col-span-2">
                <label className="text-[11px] font-semibold">Tipo</label>
                <select value={f.type} onChange={(e) => setField(i, { type: e.target.value })} className="w-full px-2 py-1.5 border border-border rounded text-sm">
                  {['text', 'number', 'email', 'date', 'tel', 'select', 'textarea'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-span-6 md:col-span-2">
                <label className="text-[11px] font-semibold">Máscara</label>
                <select value={f.mask || ''} onChange={(e) => setField(i, { mask: e.target.value || undefined })} className="w-full px-2 py-1.5 border border-border rounded text-sm">
                  <option value="">—</option>
                  <option value="cpf">cpf</option>
                  <option value="phone">phone</option>
                  <option value="cep">cep</option>
                </select>
              </div>
              <div className="col-span-6 md:col-span-1 flex items-center gap-1">
                <input type="checkbox" checked={!!f.required} onChange={(e) => setField(i, { required: e.target.checked })} id={`req_${i}`} />
                <label htmlFor={`req_${i}`} className="text-[11px] font-semibold">Obrig.</label>
              </div>
              <div className="col-span-6 md:col-span-1 flex justify-end">
                <button onClick={() => remove(i)} className="p-2 text-red-600 hover:bg-red-50 rounded" data-testid={`remove-field-${i}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {f.type === 'select' && (
                <div className="col-span-12">
                  <label className="text-[11px] font-semibold">Opções (uma por linha, formato "valor|rótulo" ou só "valor")</label>
                  <textarea
                    value={(f.options || []).map(o => typeof o === 'string' ? o : `${o.value}|${o.label}`).join('\n')}
                    onChange={(e) => {
                      const lines = e.target.value.split('\n').filter(Boolean);
                      const opts = lines.map(l => {
                        const [val, lab] = l.split('|');
                        return lab ? { value: val.trim(), label: lab.trim() } : val.trim();
                      });
                      setField(i, { options: opts });
                    }}
                    className="w-full px-2 py-1.5 border border-border rounded text-sm"
                    rows={3}
                  />
                </div>
              )}
            </div>
          ))}
          {fields.length === 0 && (
            <div className="text-center text-sm text-txt-secondary py-10 border border-dashed border-border rounded-lg">
              Nenhum campo ainda. Clique em "Adicionar campo".
            </div>
          )}
        </div>
      </Card>
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} data-testid="save-fields-btn">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar campos
        </Button>
      </div>
    </div>
  );
}

// ============ BATCHES ============
function BatchesTab() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    const d = await api.get('/api/admin/card-batches');
    setBatches(d.batches || []);
  };
  useEffect(() => { (async () => { try { await load(); } finally { setLoading(false); } })(); }, []);

  const runManual = async () => {
    if (!window.confirm('Gerar e enviar o lote AGORA com todas as cashbacks pagas pendentes?')) return;
    setRunning(true);
    try {
      const r = await api.post('/api/admin/card-batches/run');
      if (r.ran) toast.success(`Lote criado: ${r.users_count} usuários, ${formatCurrency(r.total_amount)}`);
      else toast.info('Nenhuma cashback pendente');
      await load();
    } catch (e) { toast.error('Erro ao rodar'); }
    finally { setRunning(false); }
  };

  const markExported = async (id) => {
    try {
      await api.post(`/api/admin/card-batches/${id}/mark-exported`);
      toast.success('Lote marcado como exportado');
      await load();
    } catch { toast.error('Erro'); }
  };

  const download = (id, ext = 'csv') => {
    const token = localStorage.getItem('token');
    const url = `${API_URL}/api/admin/card-batches/${id}/export.${ext}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${id}.${ext}`;
        a.click();
      });
  };

  if (loading) return <Loader />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <p className="text-sm text-txt-secondary">Lotes diários enviados ao cartão de benefícios.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} data-testid="refresh-batches-btn"><RefreshCw className="w-4 h-4" /> Atualizar</Button>
          <Button onClick={runManual} disabled={running} data-testid="run-batch-btn">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Rodar agora
          </Button>
        </div>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
              <tr>
                <th className="text-left p-3">Data</th>
                <th className="text-left p-3">Batch</th>
                <th className="text-right p-3">Usuários</th>
                <th className="text-right p-3">Total</th>
                <th className="text-center p-3">Status</th>
                <th className="text-center p-3">Modo</th>
                <th className="text-right p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 && (
                <tr><td colSpan={7} className="p-10 text-center text-txt-secondary">Nenhum lote ainda.</td></tr>
              )}
              {batches.map(b => (
                <tr key={b.batch_id} className="border-t border-border">
                  <td className="p-3 whitespace-nowrap text-xs">{formatDateTime(b.created_at)}</td>
                  <td className="p-3 font-mono text-xs">{b.batch_id}</td>
                  <td className="p-3 text-right">{b.users_count}</td>
                  <td className="p-3 text-right font-bold">{formatCurrency(b.total_amount || 0)}</td>
                  <td className="p-3 text-center"><BatchStatus status={b.status} /></td>
                  <td className="p-3 text-center text-xs">{b.mode || '-'}</td>
                  <td className="p-3 text-right space-x-1 whitespace-nowrap">
                    <button onClick={() => download(b.batch_id, 'csv')} className="px-2 py-1 text-xs bg-bg-secondary rounded hover:bg-border inline-flex items-center gap-1" data-testid={`export-csv-${b.batch_id}`}>
                      <Download className="w-3 h-3" /> CSV
                    </button>
                    <button onClick={() => download(b.batch_id, 'xlsx')} className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 inline-flex items-center gap-1" data-testid={`export-xlsx-${b.batch_id}`}>
                      <Download className="w-3 h-3" /> XLSX
                    </button>
                    {b.status !== 'sent_api' && b.status !== 'sent_manual' && (
                      <button onClick={() => markExported(b.batch_id)} className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 inline-flex items-center gap-1" data-testid={`mark-${b.batch_id}`}>
                        <CheckCircle2 className="w-3 h-3" /> Marcar enviado
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function BatchStatus({ status }) {
  if (status === 'sent_api') return <Badge variant="success">API enviado</Badge>;
  if (status === 'sent_manual') return <Badge variant="success">Manual</Badge>;
  if (status === 'failed') return <Badge variant="error">Falhou</Badge>;
  if (status === 'queued') return <Badge variant="warning">Na fila</Badge>;
  return <Badge>{status || '-'}</Badge>;
}

// ============ LOGS ============
function LogsTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);

  const load = async () => {
    const d = await api.get('/api/admin/card-logs');
    setLogs(d.logs || []);
  };
  useEffect(() => { (async () => { try { await load(); } finally { setLoading(false); } })(); }, []);

  if (loading) return <Loader />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-txt-secondary">Últimas chamadas HTTP feitas à API do cartão.</p>
        <Button variant="outline" onClick={load}><RefreshCw className="w-4 h-4" /> Atualizar</Button>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
              <tr>
                <th className="text-left p-3">Data</th>
                <th className="text-left p-3">Método</th>
                <th className="text-left p-3">URL</th>
                <th className="text-center p-3">Status</th>
                <th className="text-left p-3">Contexto</th>
                <th className="text-right p-3">Ver</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-txt-secondary">Nenhum log ainda.</td></tr>}
              {logs.map(l => (
                <tr key={l.log_id} className="border-t border-border">
                  <td className="p-3 text-xs whitespace-nowrap">{formatDateTime(l.created_at)}</td>
                  <td className="p-3 text-xs">{l.method}</td>
                  <td className="p-3 text-xs font-mono truncate max-w-xs">{l.url}</td>
                  <td className="p-3 text-center">
                    {l.success ? <Badge variant="success">{l.status_code || 'OK'}</Badge> : <Badge variant="error">{l.status_code || 'ERR'}</Badge>}
                  </td>
                  <td className="p-3 text-xs">{l.context?.type || '-'}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => setOpen(l)} className="text-xs text-brand-main hover:underline">Detalhes</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {open && <LogModal log={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function LogModal({ log, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-border flex justify-between items-center">
          <h3 className="font-heading font-bold">Log {log.log_id}</h3>
          <button onClick={onClose} className="p-2 hover:bg-bg-secondary rounded">✕</button>
        </div>
        <div className="p-5 space-y-4 text-xs">
          <Detail label="URL" val={log.url} />
          <Detail label="Método" val={log.method} />
          <Detail label="Status" val={String(log.status_code || log.error || '-')} />
          <Detail label="Headers (enviado)" val={JSON.stringify(log.request_headers || {}, null, 2)} pre />
          <Detail label="Body (enviado)" val={JSON.stringify(log.request_body || {}, null, 2)} pre />
          <Detail label="Response" val={log.response_body || log.error || '-'} pre />
        </div>
      </div>
    </div>
  );
}

// ============ UI helpers ============
function Loader() { return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>; }
function Card({ children }) { return <div className="bg-white rounded-xl border border-border p-6">{children}</div>; }
function Field({ label, value, onChange, type = 'text', placeholder, testId }) {
  return (
    <div>
      <label className="text-xs font-semibold block mb-1">{label}</label>
      <input type={type} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-brand-main"
        data-testid={testId} />
    </div>
  );
}
function Textarea({ label, value, onChange, rows = 3 }) {
  return (
    <div>
      <label className="text-xs font-semibold block mb-1">{label}</label>
      <textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} rows={rows}
        className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono focus:outline-none focus:border-brand-main" />
    </div>
  );
}
function Select({ label, value, onChange, options, testId }) {
  return (
    <div>
      <label className="text-xs font-semibold block mb-1">{label}</label>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-brand-main" data-testid={testId}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
function Detail({ label, val, pre }) {
  return (
    <div>
      <div className="font-semibold mb-1">{label}</div>
      {pre ? <pre className="bg-bg-secondary p-3 rounded text-[11px] overflow-x-auto whitespace-pre-wrap">{val}</pre> : <div className="text-txt-secondary break-all">{val}</div>}
    </div>
  );
}
