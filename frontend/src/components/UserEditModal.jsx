import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Button } from './ui/Button';
import { X, Loader2, Save, Mail, Trash2, Power, KeyRound, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const FIELDS = [
  { key: 'name', label: 'Nome', type: 'text' },
  { key: 'email', label: 'E-mail', type: 'email' },
  { key: 'phone', label: 'Telefone', type: 'tel' },
  { key: 'cpf', label: 'CPF', type: 'text' },
  { key: 'external_id', label: 'ID externo (corporativo)', type: 'text' },
  { key: 'sponsor_code', label: 'Código sponsor (afiliado)', type: 'text' },
];

const NETWORK_OPTIONS = [
  { value: 'customer', label: 'Cliente' },
  { value: 'network_1', label: 'Equipe 1 (Corporativa)' },
  { value: 'network_2', label: 'Equipe 2 (Propagandista)' },
];
const ROLE_OPTIONS_BASE = [
  { value: 'customer', label: 'Cliente' },
  { value: 'comercial', label: 'Comercial (backoffice sem financeiro/integrações)' },
  { value: 'financeiro', label: 'Financeiro (comissões, saques, cartão)' },
];
const ROLE_OPTIONS_SUPER = [
  { value: 'admin', label: 'Admin (tudo exceto integrações críticas)' },
  { value: 'super_admin', label: 'Super Admin (acesso total)' },
];
const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
];

export default function UserEditModal({ userId, onClose, onSaved }) {
  const { isSuperAdmin } = useAuth();
  const ROLE_OPTIONS = isSuperAdmin
    ? [...ROLE_OPTIONS_BASE, ...ROLE_OPTIONS_SUPER]
    : ROLE_OPTIONS_BASE;
  const [u, setU] = useState(null);
  const [original, setOriginal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allCats, setAllCats] = useState([]);

  const load = async () => {
    try {
      const [r, ucs] = await Promise.all([
        api.get(`/api/admin/users/${userId}`),
        api.get('/api/admin/user-categories').catch(() => ({ categories: [] })),
      ]);
      if (!Array.isArray(r.category_ids)) r.category_ids = [];
      setU(r);
      setOriginal(r);
      setAllCats(ucs.categories || []);
    } catch (e) { toast.error(e?.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId]);

  const set = (k, v) => setU(prev => ({ ...prev, [k]: v }));
  const toggleCat = (cid) => {
    const cur = new Set(u.category_ids || []);
    if (cur.has(cid)) cur.delete(cid); else cur.add(cid);
    setU(prev => ({ ...prev, category_ids: [...cur] }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        name: u.name, email: u.email, phone: u.phone, cpf: u.cpf,
        external_id: u.external_id, sponsor_code: u.sponsor_code,
        leader_external_id: u.leader_external_id || null,
        status: u.status, role: u.role, network_type: u.network_type,
        // access_level agora e sincronizado pelo backend baseado no role
      };
      // Se o admin alterou leader_external_id mas NAO tocou no network_sponsor_id,
      // omitir network_sponsor_id para o backend auto-resolver via external_id.
      const leaderChanged = (original?.leader_external_id || null) !== (u.leader_external_id || null);
      const sponsorChanged = (original?.network_sponsor_id || null) !== (u.network_sponsor_id || null);
      if (!(leaderChanged && !sponsorChanged)) {
        payload.network_sponsor_id = u.network_sponsor_id || null;
      }
      const updated = await api.put(`/api/admin/users/${userId}`, payload);
      // salva categorias separadamente
      await api.put(`/api/admin/users/${userId}/categories`, { category_ids: u.category_ids || [] });
      toast.success('Usuário atualizado');
      onSaved && onSaved(updated);
      onClose();
    } catch (e) { toast.error(e?.message || 'Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const sendReset = async () => {
    try {
      await api.post(`/api/admin/users/${userId}/send-password-reset`);
      toast.success('E-mail de recuperação enviado');
    } catch (e) { toast.error(e?.message || 'Erro'); }
  };

  const sendFirstAccess = async () => {
    try {
      await api.post(`/api/admin/users/${userId}/send-first-access`);
      toast.success('E-mail de primeiro acesso enviado');
      load();
    } catch (e) { toast.error(e?.message || 'Erro'); }
  };

  const toggleStatus = async () => {
    try {
      const r = await api.post(`/api/admin/users/${userId}/toggle-status`);
      set('status', r.status);
      toast.success(`Conta ${r.status === 'active' ? 'ativada' : 'desativada'}`);
    } catch (e) { toast.error(e?.message); }
  };

  const del = async () => {
    if (!window.confirm(`Deletar PERMANENTEMENTE o usuário ${u.name}? Esta ação não pode ser desfeita.`)) return;
    if (!window.confirm('Tem CERTEZA absoluta? Pedidos serão preservados, mas comissões e dados serão apagados.')) return;
    try {
      await api.del(`/api/admin/users/${userId}`);
      toast.success('Usuário deletado');
      onSaved && onSaved(null);
      onClose();
    } catch (e) { toast.error(e?.message); }
  };

  if (loading) {
    return <Modal onClose={onClose}><div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div></Modal>;
  }
  if (!u) return null;

  return (
    <Modal onClose={onClose}>
      <div className="p-5 border-b border-border flex justify-between items-center">
        <div>
          <h2 className="font-heading font-black text-xl">{u.name}</h2>
          <p className="text-xs text-txt-secondary font-mono">{u.user_id}</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-bg-secondary rounded" data-testid="close-edit-modal">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        {FIELDS.map(f => (
          <Field key={f.key} label={f.label} type={f.type} value={u[f.key]} onChange={(v) => set(f.key, v)} testId={`edit-${f.key}`} />
        ))}
        <Select label="Status" value={u.status || 'active'} onChange={(v) => set('status', v)} options={STATUS_OPTIONS} testId="edit-status" />
        <Select label="Perfil" value={u.role || 'customer'} onChange={(v) => set('role', v)} options={ROLE_OPTIONS} testId="edit-role" />
        <Select label="Equipe" value={u.network_type || 'customer'} onChange={(v) => set('network_type', v)} options={NETWORK_OPTIONS} testId="edit-network" />
        <Field label="ID externo do líder (leader_external_id)" value={u.leader_external_id} onChange={(v) => set('leader_external_id', v || null)} testId="edit-leader-external-id" />
        <Field label="ID do líder na rede Equipe (network_sponsor_id)" value={u.network_sponsor_id} onChange={(v) => set('network_sponsor_id', v || null)} testId="edit-network-sponsor" />
      </div>

      {/* Categorias do usuário (multi-select) */}
      <div className="px-5 pb-5">
        <label className="text-xs font-semibold block mb-2">Categorias do usuário</label>
        {allCats.length === 0 ? (
          <div className="text-xs text-txt-secondary">Nenhuma categoria cadastrada. Crie em <span className="font-mono">/backoffice/categorias-usuarios</span>.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allCats.map(c => {
              const sel = (u.category_ids || []).includes(c.category_id);
              return (
                <button type="button" key={c.category_id} onClick={() => toggleCat(c.category_id)} className={`text-xs px-3 py-1.5 rounded-full border-2 transition`} style={{ borderColor: c.color, color: sel ? 'white' : c.color, background: sel ? c.color : 'white' }} data-testid={`user-cat-toggle-${c.slug}`}>
                  {c.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-5 border-t border-border bg-bg-secondary/50 space-y-3">
        <div className="text-xs font-bold text-txt-secondary uppercase tracking-wider">Ações</div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={sendReset} data-testid="send-reset-btn">
            <Mail className="w-4 h-4" /> Enviar reset de senha
          </Button>
          <Button variant="outline" size="sm" onClick={sendFirstAccess} data-testid="send-first-access-btn">
            <Send className="w-4 h-4" /> Enviar 1º acesso
          </Button>
          <Button variant="outline" size="sm" onClick={toggleStatus} data-testid="toggle-status-btn">
            <Power className="w-4 h-4" /> {u.status === 'active' ? 'Desativar' : 'Ativar'}
          </Button>
          <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={del} data-testid="delete-user-btn">
            <Trash2 className="w-4 h-4" /> Deletar usuário
          </Button>
        </div>
      </div>

      <div className="p-5 border-t border-border flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} disabled={saving} data-testid="save-edit-btn">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
        </Button>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto overscroll-contain py-6 sm:py-12 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl mb-6" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', testId }) {
  return (
    <div>
      <label className="text-xs font-semibold block mb-1">{label}</label>
      <input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-brand-main"
        data-testid={testId} />
    </div>
  );
}

function Select({ label, value, onChange, options, testId }) {
  return (
    <div>
      <label className="text-xs font-semibold block mb-1">{label}</label>
      <select value={value || ''} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-brand-main"
        data-testid={testId}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
