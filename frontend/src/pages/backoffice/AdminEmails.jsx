import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Mail, Plus, Edit, Trash2, X, RotateCcw, Send, FileText, Inbox, Settings as SettingsIcon, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '../../lib/utils';

const TABS = [
  { id: 'config', label: 'Configuração', icon: SettingsIcon },
  { id: 'templates', label: 'Modelos', icon: FileText },
  { id: 'broadcast', label: 'Envio em massa', icon: Send },
  { id: 'logs', label: 'Logs', icon: Inbox },
];

const TRIGGER_LABELS = {
  email_trigger_welcome: 'Boas-vindas (novo cadastro)',
  email_trigger_order_created: 'Pedido criado',
  email_trigger_order_paid: 'Pagamento confirmado',
  email_trigger_order_shipped: 'Pedido enviado',
  email_trigger_order_delivered: 'Pedido entregue',
  email_trigger_commission_earned: 'Cashback ganha (afiliado)',
  email_trigger_admin_new_order: 'Admin: novo pedido',
  email_trigger_admin_new_candidate: 'Admin: novo candidato a Propagandista',
};

export default function AdminEmails() {
  const [tab, setTab] = useState('config');

  return (
    <div data-testid="admin-emails">
      <div className="mb-6">
        <h1 className="font-heading font-black text-3xl text-txt-primary flex items-center gap-3">
          <Mail className="w-7 h-7 text-brand-main" /> Emails
        </h1>
        <p className="text-sm text-txt-secondary mt-1">Gatilhos automáticos, modelos editáveis e envio em massa.</p>
      </div>
      <div className="flex gap-2 mb-6 flex-wrap border-b border-border">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            data-testid={`email-tab-${t.id}`}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${tab === t.id ? 'border-brand-main text-brand-main' : 'border-transparent text-txt-secondary hover:text-txt-primary'}`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>
      {tab === 'config' && <ConfigTab />}
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'broadcast' && <BroadcastTab />}
      {tab === 'logs' && <LogsTab />}
    </div>
  );
}

function ConfigTab() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  const load = async () => {
    const s = await api.get('/api/admin/settings');
    setSettings(s);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        email_enabled: !!settings.email_enabled,
        resend_api_key: settings.resend_api_key || '',
        email_from: settings.email_from || '',
        email_admin_recipients: settings.email_admin_recipients || '',
        order_invoice_email_to: settings.order_invoice_email_to || '',
      };
      Object.keys(TRIGGER_LABELS).forEach(k => { payload[k] = !!settings[k]; });
      const updated = await api.put('/api/admin/settings', payload);
      setSettings(updated);
      toast.success('Configurações salvas');
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const sendTest = async () => {
    if (!testEmail) { toast.error('Informe um email'); return; }
    setTesting(true);
    try {
      const r = await api.post('/api/admin/email-test', { to: testEmail });
      if (r.sent) toast.success('Email de teste enviado ✓');
      else toast.error(`Falha: ${r.reason}`);
    } catch (err) { toast.error(err.message); } finally { setTesting(false); }
  };

  if (!settings) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;

  return (
    <div className="space-y-6">
      {/* Credenciais Resend */}
      <div className="bg-white rounded-xl border border-border p-6">
        <h2 className="font-heading font-black text-lg mb-1">Credenciais Resend</h2>
        <p className="text-xs text-txt-secondary mb-4">
          Crie uma conta em <a href="https://resend.com" target="_blank" rel="noreferrer" className="text-brand-main underline">resend.com</a> e gere uma API key (free tier: 3.000 emails/mês).
        </p>
        <label className="flex items-center gap-2 text-sm mb-4">
          <input type="checkbox" checked={!!settings.email_enabled} onChange={e => setSettings({ ...settings, email_enabled: e.target.checked })} data-testid="email-enabled" />
          <span className="font-semibold">Ativar envio de emails</span>
        </label>
        <div className="space-y-3">
          <Input label="RESEND_API_KEY" type="password" value={settings.resend_api_key || ''} onChange={e => setSettings({ ...settings, resend_api_key: e.target.value })} placeholder="re_xxxxxxxx" data-testid="resend-key" />
          <Input label="Remetente (From)" value={settings.email_from || ''} onChange={e => setSettings({ ...settings, email_from: e.target.value })} placeholder="OxxPharma <no-reply@seudominio.com.br>" hint='Enquanto você não verifica o domínio no Resend, use "onboarding@resend.dev".' data-testid="email-from" />
          <Input label="Emails dos admins (recebem alertas)" value={settings.email_admin_recipients || ''} onChange={e => setSettings({ ...settings, email_admin_recipients: e.target.value })} placeholder="admin@ex.com, outro@ex.com" hint="Separe por vírgula. Se vazio, usa emails de usuários role=admin." />
          <Input
            label="E-mail para fatura detalhada de pedidos pagos"
            value={settings.order_invoice_email_to || ''}
            onChange={e => setSettings({ ...settings, order_invoice_email_to: e.target.value })}
            placeholder="financeiro@oxxpharma.com.br"
            hint="Quando um pedido for marcado como PAGO, uma cópia da fatura detalhada (itens, totais, endereço, pagamento) é enviada automaticamente para este e-mail. Deixe vazio para desabilitar."
            data-testid="order-invoice-email"
          />
        </div>
        <div className="flex gap-2 mt-4">
          <Button onClick={save} loading={saving} data-testid="save-email-config">Salvar</Button>
        </div>
      </div>

      {/* Teste */}
      <div className="bg-white rounded-xl border border-border p-6">
        <h2 className="font-heading font-black text-lg mb-1">Testar envio</h2>
        <p className="text-xs text-txt-secondary mb-4">Envia um email simples para verificar se as credenciais estão ok.</p>
        <div className="flex gap-2 flex-wrap">
          <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="seu@email.com" className="flex-1 min-w-[220px] h-10 px-3 bg-bg-secondary border border-border rounded-lg text-sm" data-testid="test-email-input" />
          <Button onClick={sendTest} loading={testing} variant="outline" data-testid="send-test-btn"><Send className="w-4 h-4" /> Enviar teste</Button>
        </div>
      </div>

      {/* Gatilhos */}
      <div className="bg-white rounded-xl border border-border p-6">
        <h2 className="font-heading font-black text-lg mb-1">Gatilhos automáticos</h2>
        <p className="text-xs text-txt-secondary mb-4">Liga/desliga cada tipo de email disparado automaticamente.</p>
        <div className="grid md:grid-cols-2 gap-2">
          {Object.entries(TRIGGER_LABELS).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm p-3 rounded-lg hover:bg-bg-secondary cursor-pointer" data-testid={`trigger-${key}`}>
              <input
                type="checkbox"
                checked={!!settings[key]}
                onChange={e => setSettings({ ...settings, [key]: e.target.checked })}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function TemplatesTab() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.get('/api/admin/email-templates');
      setTemplates(d.templates || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const createNew = () => {
    setEditing({ slug: '', name: '', subject: '', body_html: '<p></p>', body_text: '', active: true, _isNew: true });
  };

  const del = async (tid) => {
    if (!window.confirm('Remover este template?')) return;
    try { await api.del(`/api/admin/email-templates/${tid}`); toast.success('Removido'); load(); } catch (err) { toast.error(err.message); }
  };
  const reset = async (tid) => {
    if (!window.confirm('Restaurar o padrão deste template?')) return;
    try { await api.post(`/api/admin/email-templates/${tid}/reset`); toast.success('Restaurado'); load(); } catch (err) { toast.error(err.message); }
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;

  return (
    <div>
      <div className="flex justify-between mb-4">
        <div className="text-sm text-txt-secondary">
          {templates.length} modelo(s). Variáveis disponíveis: <code>{`{{user.name}}`}</code>, <code>{`{{order.total}}`}</code>, <code>{`{{referral_link}}`}</code>, etc.
        </div>
        <Button onClick={createNew} size="sm" data-testid="new-template-btn"><Plus className="w-4 h-4" /> Novo modelo</Button>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {templates.map(t => (
          <div key={t.template_id} className="bg-white rounded-xl border border-border p-4" data-testid={`template-${t.slug}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-heading font-black text-sm truncate">{t.name}</div>
                <div className="text-xs font-mono text-txt-secondary mt-0.5">{t.slug}</div>
                <div className="text-xs text-txt-secondary mt-1 line-clamp-1">Assunto: {t.subject}</div>
              </div>
              {t.active ? <Badge variant="success">Ativo</Badge> : <Badge variant="error">Inativo</Badge>}
            </div>
            <div className="flex gap-1 mt-3 justify-end">
              <button onClick={() => reset(t.template_id)} className="p-1.5 hover:bg-bg-secondary rounded" title="Restaurar padrão" data-testid={`reset-${t.slug}`}><RotateCcw className="w-4 h-4" /></button>
              <button onClick={() => setEditing({ ...t })} className="p-1.5 hover:bg-bg-secondary rounded" data-testid={`edit-${t.slug}`}><Edit className="w-4 h-4" /></button>
              <button onClick={() => del(t.template_id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
      {editing && <TemplateEditor template={editing} onClose={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function TemplateEditor({ template, onClose }) {
  const [form, setForm] = useState(template);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      if (form._isNew) {
        await api.post('/api/admin/email-templates', {
          slug: form.slug, name: form.name, subject: form.subject,
          body_html: form.body_html, body_text: form.body_text || '', active: !!form.active,
        });
        toast.success('Criado');
      } else {
        await api.put(`/api/admin/email-templates/${form.template_id}`, {
          slug: form.slug, name: form.name, subject: form.subject,
          body_html: form.body_html, body_text: form.body_text || '', active: !!form.active,
        });
        toast.success('Salvo');
      }
      onClose();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-border p-5 flex items-center justify-between">
          <h2 className="font-heading font-black text-lg">{form._isNew ? 'Novo modelo' : 'Editar modelo'}</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 grid md:grid-cols-2 gap-4">
          <Input label="Slug (identificador)*" required value={form.slug || ''} onChange={e => setForm({ ...form, slug: e.target.value })} data-testid="tpl-slug" hint="Ex: welcome, order_paid" />
          <Input label="Nome*" required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input className="md:col-span-2" label="Assunto*" required value={form.subject || ''} onChange={e => setForm({ ...form, subject: e.target.value })} data-testid="tpl-subject" />
          <Textarea className="md:col-span-2" label="HTML" rows={14} value={form.body_html || ''} onChange={e => setForm({ ...form, body_html: e.target.value })} data-testid="tpl-html" />
          <Textarea className="md:col-span-2" label="Texto puro (opcional)" rows={4} value={form.body_text || ''} onChange={e => setForm({ ...form, body_text: e.target.value })} />
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={!!form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
            Modelo ativo
          </label>
        </div>
        <div className="grid md:grid-cols-2 gap-4 p-5 pt-0">
          <div className="text-xs text-txt-secondary bg-bg-secondary rounded-lg p-3">
            <strong>Variáveis:</strong> <code>{`{{user.name}}`}</code>, <code>{`{{user.email}}`}</code>, <code>{`{{order.total}}`}</code>, <code>{`{{order_short_id}}`}</code>, <code>{`{{order_link}}`}</code>, <code>{`{{referral_link}}`}</code>, <code>{`{{commission.amount}}`}</code>, <code>{`{{customer_name}}`}</code>, <code>{`{{candidate.name}}`}</code>, etc.
          </div>
          <div>
            <div className="text-xs font-bold text-txt-secondary mb-2">Prévia do HTML</div>
            <div className="border border-border rounded-lg p-3 max-h-64 overflow-auto" dangerouslySetInnerHTML={{ __html: form.body_html }} />
          </div>
        </div>
        <div className="p-5 border-t border-border flex gap-2">
          <Button onClick={save} loading={saving} data-testid="save-tpl-btn">Salvar</Button>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </div>
  );
}

function BroadcastTab() {
  const [form, setForm] = useState({ subject: '', body_html: '<p>Olá {{user.name}},</p>\n<p>Mensagem aqui...</p>', target: 'all', emails: '' });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const send = async () => {
    if (!form.subject || !form.body_html) { toast.error('Preencha assunto e mensagem'); return; }
    if (!window.confirm('Enviar em massa? Esta ação não pode ser desfeita.')) return;
    setSending(true);
    try {
      const payload = { subject: form.subject, body_html: form.body_html, target: form.target };
      if (form.target === 'emails' && form.emails) {
        payload.emails = form.emails.split(',').map(e => e.trim()).filter(Boolean);
        payload.target = 'user_ids';  // usa emails direto
      }
      const r = await api.post('/api/admin/email-broadcast', payload);
      setResult(r);
      toast.success(`Enviado: ${r.sent}/${r.total}`);
    } catch (err) { toast.error(err.message); } finally { setSending(false); }
  };

  return (
    <div className="max-w-3xl bg-white rounded-xl border border-border p-6 space-y-4">
      <h2 className="font-heading font-black text-lg">Envio em massa</h2>
      <div>
        <label className="block text-sm font-medium mb-1.5">Para</label>
        <select value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} className="w-full h-11 px-3 bg-white border border-border rounded-lg" data-testid="broadcast-target">
          <option value="all">Todos os usuários ativos</option>
          <option value="customer">Apenas Indicadores (customer)</option>
          <option value="network_1">Apenas Equipe 1 (Corporativo)</option>
          <option value="network_2">Apenas Propagandistas (Equipe 2)</option>
          <option value="admin">Apenas admins</option>
          <option value="emails">Lista específica de emails</option>
        </select>
      </div>
      {form.target === 'emails' && (
        <Textarea label="Emails (separados por vírgula)" value={form.emails} onChange={e => setForm({ ...form, emails: e.target.value })} rows={2} />
      )}
      <Input label="Assunto*" required value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} data-testid="broadcast-subject" />
      <Textarea label="Mensagem HTML*" required rows={12} value={form.body_html} onChange={e => setForm({ ...form, body_html: e.target.value })} data-testid="broadcast-body" />
      <div className="flex gap-2 pt-2 border-t border-border">
        <Button onClick={send} loading={sending} data-testid="send-broadcast-btn"><Send className="w-4 h-4" /> Enviar</Button>
      </div>
      {result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
          Enviados: <strong>{result.sent}</strong> · Falhas: <strong>{result.failed}</strong> · Total: {result.total}
        </div>
      )}
    </div>
  );
}

function LogsTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.get('/api/admin/email-logs');
      setLogs(d.logs || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  if (loading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
            <tr>
              <th className="text-left p-3">Data</th>
              <th className="text-left p-3">Para</th>
              <th className="text-left p-3">Assunto</th>
              <th className="text-left p-3">Tipo</th>
              <th className="text-center p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.log_id} className="border-t border-border">
                <td className="p-3 text-xs">{formatDateTime(l.created_at)}</td>
                <td className="p-3 text-xs">{(l.to || []).join(', ').substring(0, 40)}</td>
                <td className="p-3 text-xs truncate max-w-[300px]">{l.subject}</td>
                <td className="p-3 text-xs text-txt-secondary">{l.meta?.slug || l.meta?.type || '-'}</td>
                <td className="p-3 text-center">
                  {l.sent
                    ? <span className="inline-flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle2 className="w-3.5 h-3.5" /> Enviado</span>
                    : <span className="inline-flex items-center gap-1 text-red-500 text-xs" title={l.reason}><AlertCircle className="w-3.5 h-3.5" /> {l.reason?.substring(0, 20)}</span>
                  }
                </td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-txt-secondary">Nenhum envio registrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
