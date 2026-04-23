import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { MapPin, Plus, Trash2, Edit, Check } from 'lucide-react';
import { toast } from 'sonner';

const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const empty = { label: 'Casa', street: '', number: '', complement: '', neighborhood: '', city: '', state: 'SP', zip_code: '', is_default: false };

export default function MyAddresses() {
  const [addresses, setAddresses] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);

  const load = async () => {
    const { addresses } = await api.get('/api/users/me/addresses');
    setAddresses(addresses || []);
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/api/users/me/addresses/${editing}`, form);
      else await api.post('/api/users/me/addresses', form);
      toast.success('Endereço salvo');
      setShowForm(false);
      setEditing(null);
      setForm(empty);
      load();
    } catch (err) { toast.error(err.message); }
  };

  const del = async (id) => {
    if (!window.confirm('Excluir endereço?')) return;
    try { await api.del(`/api/users/me/addresses/${id}`); toast.success('Excluído'); load(); } catch (err) { toast.error(err.message); }
  };

  const startEdit = (a) => {
    setEditing(a.address_id);
    setForm({ ...a });
    setShowForm(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8" data-testid="my-addresses">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading font-black text-3xl text-txt-primary flex items-center gap-3"><MapPin className="w-7 h-7 text-brand-main" /> Meus endereços</h1>
        {!showForm && <Button onClick={() => { setShowForm(true); setEditing(null); setForm(empty); }}><Plus className="w-4 h-4" /> Novo</Button>}
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-white rounded-xl border border-border p-6 space-y-3 mb-6">
          <h2 className="font-bold text-lg">{editing ? 'Editar endereço' : 'Novo endereço'}</h2>
          <div className="grid grid-cols-3 gap-3">
            <Input label="CEP" required value={form.zip_code} onChange={e => setForm({ ...form, zip_code: e.target.value })} />
            <Input label="Nome" className="col-span-2" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Rua" required className="col-span-2" value={form.street} onChange={e => setForm({ ...form, street: e.target.value })} />
            <Input label="Número" required value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Complemento" value={form.complement || ''} onChange={e => setForm({ ...form, complement: e.target.value })} />
            <Input label="Bairro" required value={form.neighborhood} onChange={e => setForm({ ...form, neighborhood: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Cidade" required className="col-span-2" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
            <Select label="UF" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })}>
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_default} onChange={e => setForm({ ...form, is_default: e.target.checked })} />
            Definir como endereço padrão
          </label>
          <div className="flex gap-2">
            <Button type="submit">Salvar</Button>
            <Button type="button" variant="ghost" onClick={() => { setShowForm(false); setEditing(null); setForm(empty); }}>Cancelar</Button>
          </div>
        </form>
      )}

      {addresses.length === 0 && !showForm ? (
        <div className="bg-white rounded-xl border border-border p-12 text-center text-txt-secondary">Nenhum endereço cadastrado.</div>
      ) : (
        <div className="space-y-3">
          {addresses.map(a => (
            <div key={a.address_id} className="bg-white rounded-xl border border-border p-5 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{a.label}</span>
                  {a.is_default && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold flex items-center gap-1"><Check className="w-3 h-3" /> Padrão</span>}
                </div>
                <div className="text-sm text-txt-secondary mt-1">{a.street}, {a.number}{a.complement ? ` - ${a.complement}` : ''} · {a.neighborhood}</div>
                <div className="text-sm text-txt-secondary">{a.city}/{a.state} · CEP {a.zip_code}</div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => startEdit(a)} className="p-2 hover:bg-bg-secondary rounded-lg" data-testid={`edit-addr-${a.address_id}`}><Edit className="w-4 h-4" /></button>
                <button onClick={() => del(a.address_id)} className="p-2 hover:bg-red-50 text-red-500 rounded-lg" data-testid={`del-addr-${a.address_id}`}><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
