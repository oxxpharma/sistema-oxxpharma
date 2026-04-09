import React, { useState, useEffect } from 'react';
import { useAuth, LEVEL_NAMES } from '../contexts/AuthContext';
import AppLayout, { DashCard } from '../components/layout/AppLayout';
import { Search, Plus, Edit2, Trash2, X, ChevronLeft, ChevronRight } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function UsersPage() {
  const { token, accessLevel } = useAuth();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [states, setStates] = useState([]);
  const [ddds, setDdds] = useState([]);

  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '', cpf: '',
    access_level: 4, state: '', ddd: '', city: '', status: 'active',
    franchise_value: 0, annual_revenue: 0,
  });

  useEffect(() => { fetchUsers(); }, [page, search, filterLevel]);
  useEffect(() => { fetchStates(); }, []);

  const fetchStates = async () => {
    try {
      const res = await fetch(`${API_URL}/api/reference/states`);
      if (res.ok) { const d = await res.json(); setStates(d.states); }
    } catch {}
  };

  const fetchDDDs = async (state) => {
    try {
      const res = await fetch(`${API_URL}/api/reference/ddds?state=${state}`);
      if (res.ok) { const d = await res.json(); setDdds(d.ddds); }
    } catch {}
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/users?page=${page}&limit=15`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (filterLevel !== '') url += `&access_level=${filterLevel}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        setUsers(d.users);
        setTotal(d.total);
        setPages(d.pages);
      }
    } catch {} finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditUser(null);
    setForm({ name: '', email: '', password: '', phone: '', cpf: '', access_level: 4, state: '', ddd: '', city: '', status: 'active', franchise_value: 0, annual_revenue: 0 });
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditUser(u);
    setForm({
      name: u.name || '', email: u.email || '', password: '', phone: u.phone || '', cpf: u.cpf || '',
      access_level: u.access_level, state: u.state || '', ddd: u.ddd || '', city: u.city || '',
      status: u.status || 'active', franchise_value: u.franchise_value || 0, annual_revenue: u.annual_revenue || 0,
    });
    if (u.state) fetchDDDs(u.state);
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (editUser) {
        const body = { ...form };
        if (!body.password) delete body.password;
        body.access_level = parseInt(body.access_level);
        body.franchise_value = parseFloat(body.franchise_value) || 0;
        body.annual_revenue = parseFloat(body.annual_revenue) || 0;
        await fetch(`${API_URL}/api/users/${editUser.user_id}`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await fetch(`${API_URL}/api/users/create`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, access_level: parseInt(form.access_level) }),
        });
      }
      setShowModal(false);
      fetchUsers();
    } catch {}
  };

  const handleDelete = async (uid) => {
    if (!window.confirm('Deseja desativar este usuario?')) return;
    await fetch(`${API_URL}/api/users/${uid}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    fetchUsers();
  };

  const levelBadge = (lvl) => {
    const colors = {
      0: 'bg-red-100 text-red-700',
      1: 'bg-blue-100 text-blue-700',
      2: 'bg-emerald-100 text-emerald-700',
      3: 'bg-violet-100 text-violet-700',
      4: 'bg-amber-100 text-amber-700',
      5: 'bg-slate-100 text-slate-600',
      6: 'bg-pink-100 text-pink-700',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${colors[lvl] || 'bg-gray-100'}`}>
        {LEVEL_NAMES[lvl] || lvl}
      </span>
    );
  };

  return (
    <AppLayout title="Usuarios" subtitle={`${total} registros`}>
      <div className="space-y-4 fade-in">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-secondary" />
            <input
              type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Buscar por nome ou email..."
              className="w-full pl-9 pr-3 py-2.5 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-main"
              data-testid="users-search"
            />
          </div>
          <select
            value={filterLevel} onChange={e => { setFilterLevel(e.target.value); setPage(1); }}
            className="px-3 py-2.5 border border-border rounded-md text-sm bg-white"
            data-testid="users-level-filter"
          >
            <option value="">Todos os Niveis</option>
            {Object.entries(LEVEL_NAMES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          {accessLevel <= 2 && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2.5 bg-brand-main text-white rounded-md text-sm font-semibold hover:bg-brand-hover transition-all"
              data-testid="create-user-btn"
            >
              <Plus className="w-4 h-4" /> Novo Usuario
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white border border-border rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-secondary">
                  <th className="text-left px-4 py-3 font-semibold text-txt-secondary text-xs uppercase tracking-wide">Nome</th>
                  <th className="text-left px-4 py-3 font-semibold text-txt-secondary text-xs uppercase tracking-wide">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-txt-secondary text-xs uppercase tracking-wide">Nivel</th>
                  <th className="text-left px-4 py-3 font-semibold text-txt-secondary text-xs uppercase tracking-wide">Estado</th>
                  <th className="text-left px-4 py-3 font-semibold text-txt-secondary text-xs uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-txt-secondary text-xs uppercase tracking-wide">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-txt-secondary">Carregando...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-txt-secondary">Nenhum usuario encontrado</td></tr>
                ) : users.map(u => (
                  <tr key={u.user_id} className="border-b border-border hover:bg-bg-secondary/50 transition-colors" data-testid={`user-row-${u.user_id}`}>
                    <td className="px-4 py-3 font-medium text-txt-primary">{u.name}</td>
                    <td className="px-4 py-3 text-txt-secondary">{u.email}</td>
                    <td className="px-4 py-3">{levelBadge(u.access_level)}</td>
                    <td className="px-4 py-3 text-txt-secondary">{u.state || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(u)} className="p-1.5 hover:bg-bg-secondary rounded-md" data-testid={`edit-user-${u.user_id}`}>
                          <Edit2 className="w-4 h-4 text-txt-secondary" />
                        </button>
                        {accessLevel === 0 && (
                          <button onClick={() => handleDelete(u.user_id)} className="p-1.5 hover:bg-red-50 rounded-md" data-testid={`delete-user-${u.user_id}`}>
                            <Trash2 className="w-4 h-4 text-accent-red" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-txt-secondary">Pagina {page} de {pages}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-md hover:bg-bg-secondary disabled:opacity-30">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="p-1.5 rounded-md hover:bg-bg-secondary disabled:opacity-30">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" data-testid="user-modal">
            <div className="bg-white rounded-md border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
                <h3 className="font-heading font-bold text-lg">{editUser ? 'Editar Usuario' : 'Novo Usuario'}</h3>
                <button onClick={() => setShowModal(false)} className="p-1 hover:bg-bg-secondary rounded-md">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-txt-secondary mb-1">Nome</label>
                    <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm" data-testid="user-form-name" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-txt-secondary mb-1">Email</label>
                    <input value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm" data-testid="user-form-email" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-txt-secondary mb-1">Senha {editUser && '(vazio = manter)'}</label>
                    <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm" data-testid="user-form-password" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-txt-secondary mb-1">Telefone</label>
                    <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-txt-secondary mb-1">CPF</label>
                    <input value={form.cpf} onChange={e => setForm({...form, cpf: e.target.value})}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-txt-secondary mb-1">Nivel</label>
                    <select value={form.access_level} onChange={e => setForm({...form, access_level: e.target.value})}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm bg-white" data-testid="user-form-level">
                      {Object.entries(LEVEL_NAMES).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-txt-secondary mb-1">Status</label>
                    <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm bg-white">
                      <option value="active">Ativo</option>
                      <option value="suspended">Suspenso</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-txt-secondary mb-1">Estado</label>
                    <select value={form.state} onChange={e => { setForm({...form, state: e.target.value, ddd: ''}); fetchDDDs(e.target.value); }}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm bg-white" data-testid="user-form-state">
                      <option value="">Selecione</option>
                      {states.map(s => <option key={s.uf} value={s.uf}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-txt-secondary mb-1">DDD</label>
                    <select value={form.ddd} onChange={e => setForm({...form, ddd: e.target.value})}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm bg-white" data-testid="user-form-ddd">
                      <option value="">Selecione</option>
                      {ddds.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-txt-secondary mb-1">Cidade</label>
                    <input value={form.city} onChange={e => setForm({...form, city: e.target.value})}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm" data-testid="user-form-city" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-txt-secondary mb-1">Valor Franquia (R$)</label>
                    <input type="number" value={form.franchise_value} onChange={e => setForm({...form, franchise_value: e.target.value})}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-txt-secondary mb-1">Receita Anual (R$)</label>
                    <input type="number" value={form.annual_revenue} onChange={e => setForm({...form, annual_revenue: e.target.value})}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 px-5 py-3.5 border-t border-border">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-txt-secondary hover:bg-bg-secondary rounded-md">
                  Cancelar
                </button>
                <button onClick={handleSave} className="px-4 py-2 bg-brand-main text-white text-sm font-semibold rounded-md hover:bg-brand-hover" data-testid="save-user-btn">
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
