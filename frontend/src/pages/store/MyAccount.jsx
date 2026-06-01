import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { User, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function MyAccount() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    cpf: user?.cpf || '',
  });
  const [saving, setSaving] = useState(false);

  // Sincroniza o formulário quando o usuário é carregado
  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        phone: user.phone || '',
        cpf: user.cpf || '',
      });
    }
  }, [user]);

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
        <Input label="CPF" value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" />

        <Button type="submit" loading={saving}><Save className="w-4 h-4" /> Salvar</Button>
      </form>
    </div>
  );
}
