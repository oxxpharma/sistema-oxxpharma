import React, { useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { User, Save, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

export default function MyAccount() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    cpf: user?.cpf || '',
    pix_key_type: user?.pix_key_type || 'cpf',
    pix_key: user?.pix_key || '',
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const u = await api.put('/api/users/me', form);
      setUser(u);
      toast.success('Perfil atualizado');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6" data-testid="my-account">
      <h1 className="font-heading font-black text-3xl text-txt-primary flex items-center gap-3"><User className="w-7 h-7 text-brand-main" /> Minha conta</h1>

      <form onSubmit={submit} className="bg-white rounded-xl border border-border p-6 space-y-4">
        <h2 className="font-bold text-lg">Dados pessoais</h2>
        <Input label="Email" value={user?.email} disabled />
        <Input label="Nome completo" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <Input label="Telefone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" />
        <Input label="CPF" value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" hint="Necessário para recebimento de comissões." />

        <div className="pt-4 border-t border-border">
          <h2 className="font-bold text-lg flex items-center gap-2 mb-3"><CreditCard className="w-5 h-5 text-brand-main" /> Chave PIX para recebimento</h2>
          <div className="grid grid-cols-3 gap-3">
            <Select label="Tipo" value={form.pix_key_type} onChange={e => setForm({ ...form, pix_key_type: e.target.value })}>
              <option value="cpf">CPF</option>
              <option value="email">Email</option>
              <option value="phone">Telefone</option>
              <option value="random">Chave aleatória</option>
            </Select>
            <Input label="Chave PIX" className="col-span-2" value={form.pix_key} onChange={e => setForm({ ...form, pix_key: e.target.value })} placeholder="Sua chave" />
          </div>
        </div>

        <Button type="submit" loading={saving}><Save className="w-4 h-4" /> Salvar</Button>
      </form>
    </div>
  );
}
