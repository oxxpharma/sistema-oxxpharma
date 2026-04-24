import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatDateTime } from '../../lib/utils';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Search, Loader2, Mail, Phone, CreditCard, Power } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search) q.set('search', search);
      if (role) q.set('role', role);
      q.set('limit', '100');
      const d = await api.get(`/api/admin/users?${q}`);
      setUsers(d.users || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [role]);

  const activate = async (uid) => {
    try {
      const r = await api.post(`/api/admin/users/${uid}/activate-referral`);
      toast.success(r.already_active ? 'Já estava ativo' : `Ativado! Código: ${r.referral_code}`);
      load();
    } catch (e) { toast.error(e?.message || 'Erro'); }
  };
  const deactivate = async (uid) => {
    if (!confirm('Desativar o programa para este usuário? O código será removido.')) return;
    try {
      await api.post(`/api/admin/users/${uid}/deactivate-referral`);
      toast.success('Desativado');
      load();
    } catch (e) { toast.error(e?.message || 'Erro'); }
  };

  return (
    <div data-testid="admin-users">
      <h1 className="font-heading font-black text-3xl text-txt-primary mb-6">Usuários</h1>

      <div className="bg-white rounded-xl border border-border p-4 mb-4 flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            className="w-full h-10 pl-10 pr-4 bg-bg-secondary border border-border rounded-lg text-sm"
          />
        </div>
        <select value={role} onChange={e => setRole(e.target.value)} className="h-10 px-3 bg-bg-secondary border border-border rounded-lg text-sm">
          <option value="">Todos</option>
          <option value="customer">Clientes</option>
          <option value="admin">Admins</option>
        </select>
        <Button variant="outline" onClick={load}>Buscar</Button>
      </div>

      {loading ? <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div> : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
                <tr>
                  <th className="text-left p-3">Usuário</th>
                  <th className="text-left p-3">Contato</th>
                  <th className="text-left p-3">Cód. indicação</th>
                  <th className="text-left p-3">Indicado por</th>
                  <th className="text-left p-3">Cadastro</th>
                  <th className="text-center p-3">Programa</th>
                  <th className="text-center p-3">Perfil</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.user_id} className="border-t border-border hover:bg-bg-secondary/50">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-brand-light text-brand-main font-bold flex items-center justify-center">
                          {u.name?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="font-semibold">{u.name}</div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 text-xs"><Mail className="w-3 h-3" />{u.email}</div>
                      {u.phone && <div className="flex items-center gap-1.5 text-xs mt-0.5"><Phone className="w-3 h-3" />{u.phone}</div>}
                    </td>
                    <td className="p-3 font-mono text-xs">{u.referral_code || '-'}</td>
                    <td className="p-3 font-mono text-xs">{u.sponsor_code || '-'}</td>
                    <td className="p-3 text-xs text-txt-secondary">{formatDateTime(u.created_at)}</td>
                    <td className="p-3 text-center">
                      {u.referral_program_active && u.referral_code ? (
                        <button onClick={() => deactivate(u.user_id)} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-emerald-50 text-emerald-700 hover:bg-red-50 hover:text-red-700 rounded" data-testid={`deactivate-${u.user_id}`}>
                          <Power className="w-3 h-3" /> Ativo
                        </button>
                      ) : (
                        <button onClick={() => activate(u.user_id)} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-bg-secondary text-txt-secondary hover:bg-brand-light hover:text-brand-main rounded" data-testid={`activate-${u.user_id}`}>
                          <CreditCard className="w-3 h-3" /> Ativar
                        </button>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {u.role === 'admin' ? <Badge variant="brand">Admin</Badge> : <Badge>Cliente</Badge>}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-txt-secondary">Nenhum usuário.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
