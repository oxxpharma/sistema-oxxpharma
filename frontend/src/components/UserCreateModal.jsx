import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Button } from './ui/Button';
import { X, Loader2, Save, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const NETWORK_OPTIONS = [
  { value: 'customer', label: 'Cliente' },
  { value: 'network_1', label: 'Equipe 1 (Corporativa)' },
  { value: 'network_2', label: 'Equipe 2 (Propagandista)' },
];
const ROLE_OPTIONS_BASE = [
  { value: 'customer', label: 'Cliente' },
  { value: 'comercial', label: 'Comercial (backoffice sem financeiro/integrações)' },
  { value: 'financeiro', label: 'Financeiro (cashbacks, saques, cartão)' },
];
const ROLE_OPTIONS_SUPER = [
  { value: 'admin', label: 'Admin (tudo exceto integrações críticas)' },
  { value: 'super_admin', label: 'Super Admin (acesso total)' },
];
const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
];
const PIX_KEY_OPTIONS = [
  { value: '', label: '—' },
  { value: 'cpf', label: 'CPF' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' },
  { value: 'random', label: 'Chave aleatória' },
];

const EMPTY_ADDR = {
  label: '', recipient: '', street: '', number: '', complement: '',
  neighborhood: '', city: '', state: '', zip_code: '', is_default: true,
};

export default function UserCreateModal({ onClose, onCreated }) {
  const { isSuperAdmin } = useAuth();
  const [allRoles, setAllRoles] = useState([]);
  
  const ROLE_OPTIONS = isSuperAdmin
    ? [...ROLE_OPTIONS_BASE, ...ROLE_OPTIONS_SUPER]
    : ROLE_OPTIONS_BASE;
  const [form, setForm] = useState({
    name: '', email: '', phone: '', cpf: '',
    external_id: '',
    role: 'customer',
    profile_id: null,
    status: 'active',
    network_type: 'customer',
    network_sponsor_id: '',
    sponsor_code: '',
    pix_key: '', pix_key_type: '',
    category_ids: [],
    addresses: [],
    send_first_access: true,
  });
  const [allCats, setAllCats] = useState([]);
  const [includeAddress, setIncludeAddress] = useState(false);
  const [addr, setAddr] = useState(EMPTY_ADDR);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [catsRes, rolesRes] = await Promise.all([
          api.get('/api/admin/user-categories'),
          api.get('/api/admin/role-profiles'),
        ]);
        setAllCats(catsRes.categories || []);
        
        // Converte perfis do backend para formato de opções
        const roleOptions = (rolesRes.profiles || []).map(p => ({
          value: p.profile_id,
          label: p.name,
        }));
        setAllRoles(roleOptions);
      } catch (e) {
        console.error('Erro ao carregar roles:', e);
      }
    };
    loadData();
  }, []);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const setA = (k, v) => setAddr(prev => ({ ...prev, [k]: v }));

  const handleRoleChange = (v) => {
    // Verifica se é um system profile (role) ou customizado (profile_id)
    const systemRoles = ['customer', 'comercial', 'financeiro', 'admin', 'super_admin'];
    if (systemRoles.includes(v)) {
      // É um role de sistema
      set('role', v);
      set('profile_id', null);
    } else {
      // É um perfil customizado (prof_xxx)
      set('profile_id', v);
      set('role', 'customer');
    }
  };

  const toggleCat = (cid) => {
    const cur = new Set(form.category_ids || []);
    if (cur.has(cid)) cur.delete(cid); else cur.add(cid);
    set('category_ids', [...cur]);
  };

  const submit = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    if (!form.email.trim()) { toast.error('E-mail é obrigatório'); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      // tira chaves vazias para não sujar o banco
      Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null; });
      if (includeAddress && addr.street && addr.zip_code) {
        payload.addresses = [{ ...addr, address_id: 'addr_' + Date.now() }];
      } else {
        payload.addresses = [];
      }
      const r = await api.post('/api/admin/users', payload);
      toast.success(form.send_first_access ? 'Usuário criado e e-mail de 1º acesso enviado' : 'Usuário criado');
      onCreated && onCreated(r.user);
      onClose();
    } catch (e) {
      toast.error(e?.message || 'Erro ao criar usuário');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto overscroll-contain py-6 sm:py-12 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl mb-6" onClick={e => e.stopPropagation()} data-testid="user-create-modal">
        <div className="p-5 border-b border-border flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-light text-brand-main flex items-center justify-center"><UserPlus className="w-5 h-5" /></div>
            <div>
              <h2 className="font-heading font-black text-xl">Novo usuário</h2>
              <p className="text-xs text-txt-secondary">A senha será definida pelo próprio usuário no primeiro acesso.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-bg-secondary rounded" data-testid="close-create-modal"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Identificação */}
          <Section title="Identificação">
            <Field label="Nome completo *" value={form.name} onChange={(v) => set('name', v)} testId="create-name" />
            <Field label="E-mail *" type="email" value={form.email} onChange={(v) => set('email', v)} testId="create-email" />
            <Field label="Telefone" type="tel" value={form.phone} onChange={(v) => set('phone', v)} testId="create-phone" />
            <Field label="CPF" value={form.cpf} onChange={(v) => set('cpf', v)} testId="create-cpf" />
            <Field label="ID externo (corporativo)" value={form.external_id} onChange={(v) => set('external_id', v)} testId="create-external_id" />
          </Section>

          {/* Acesso e perfil */}
          <Section title="Acesso e perfil">
            <Select 
              label="Perfil" 
              value={form.profile_id || form.role}
              onChange={handleRoleChange}
              options={allRoles.length > 0 ? allRoles : ROLE_OPTIONS} 
              testId="create-role" 
            />
            <Select label="Status" value={form.status} onChange={(v) => set('status', v)} options={STATUS_OPTIONS} testId="create-status" />
          </Section>

          {/* Equipe */}
          <Section title="Equipe / Indicação">
            <Select label="Equipe" value={form.network_type} onChange={(v) => set('network_type', v)} options={NETWORK_OPTIONS} testId="create-network" />
            <Field label="ID do líder na rede Equipe" value={form.network_sponsor_id} onChange={(v) => set('network_sponsor_id', v)} testId="create-network-sponsor" placeholder="user_xxx" />
            <Field label="Código do patrocinador (referral)" value={form.sponsor_code} onChange={(v) => set('sponsor_code', v.toUpperCase())} testId="create-sponsor-code" placeholder="ABC123" />
          </Section>

          {/* Pix */}
          <Section title="PIX (saques)">
            <Select label="Tipo de chave" value={form.pix_key_type} onChange={(v) => set('pix_key_type', v)} options={PIX_KEY_OPTIONS} testId="create-pix-type" />
            <Field label="Chave PIX" value={form.pix_key} onChange={(v) => set('pix_key', v)} testId="create-pix-key" />
          </Section>

          {/* Categorias */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-txt-secondary block mb-2">Categorias do usuário</label>
            {allCats.length === 0 ? (
              <div className="text-xs text-txt-secondary">Nenhuma categoria cadastrada.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allCats.map(c => {
                  const sel = (form.category_ids || []).includes(c.category_id);
                  return (
                    <button type="button" key={c.category_id} onClick={() => toggleCat(c.category_id)} className="text-xs px-3 py-1.5 rounded-full border-2 transition" style={{ borderColor: c.color, color: sel ? 'white' : c.color, background: sel ? c.color : 'white' }} data-testid={`create-cat-${c.slug}`}>
                      {c.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Endereço opcional */}
          <div>
            <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
              <input type="checkbox" checked={includeAddress} onChange={e => setIncludeAddress(e.target.checked)} data-testid="toggle-address" />
              <span className="font-semibold">Adicionar endereço inicial</span>
            </label>
            {includeAddress && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-bg-secondary/50 rounded-lg">
                <Field label="Apelido (Casa, Trabalho...)" value={addr.label} onChange={(v) => setA('label', v)} />
                <Field label="Destinatário" value={addr.recipient} onChange={(v) => setA('recipient', v)} />
                <Field label="Rua *" value={addr.street} onChange={(v) => setA('street', v)} />
                <Field label="Número" value={addr.number} onChange={(v) => setA('number', v)} />
                <Field label="Complemento" value={addr.complement} onChange={(v) => setA('complement', v)} />
                <Field label="Bairro" value={addr.neighborhood} onChange={(v) => setA('neighborhood', v)} />
                <Field label="Cidade" value={addr.city} onChange={(v) => setA('city', v)} />
                <Field label="Estado (UF)" value={addr.state} onChange={(v) => setA('state', v.toUpperCase().slice(0, 2))} />
                <Field label="CEP *" value={addr.zip_code} onChange={(v) => setA('zip_code', v)} placeholder="00000-000" />
              </div>
            )}
          </div>

          {/* Toggle envio email */}
          <label className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer">
            <input type="checkbox" checked={form.send_first_access} onChange={e => set('send_first_access', e.target.checked)} className="mt-0.5" data-testid="send-first-access-toggle" />
            <div className="text-xs">
              <div className="font-bold text-amber-900">Enviar e-mail de primeiro acesso</div>
              <div className="text-amber-800 mt-0.5">O usuário receberá um link válido por 7 dias para definir a própria senha. Se desmarcado, você poderá enviar depois pelo botão "Enviar 1º acesso" no edit.</div>
            </div>
          </label>
        </div>

        <div className="p-5 border-t border-border flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving} data-testid="create-user-submit">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Criar usuário
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wider text-txt-secondary mb-2">{title}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, testId }) {
  return (
    <div>
      <label className="text-xs font-semibold block mb-1">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-brand-main"
        data-testid={testId}
      />
    </div>
  );
}

function Select({ label, value, onChange, options, testId }) {
  return (
    <div>
      <label className="text-xs font-semibold block mb-1">{label}</label>
      <select value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm" data-testid={testId}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
