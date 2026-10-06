import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { User, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatCpf, isValidCpf } from '../../lib/utils';

import MyConsignmentCard from '../../components/convenio/MyConsignmentCard';

export default function MyAccount() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    cpf: user?.cpf ? formatCpf(user.cpf) : '',
  });
  const [saving, setSaving] = useState(false);
  const [cpfError, setCpfError] = useState('');

  // Sincroniza o formulário quando o usuário é carregado
  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        phone: user.phone || '',
        cpf: user.cpf ? formatCpf(user.cpf) : '',
      });
      setCpfError('');
    }
  }, [user]);

  const handleCpfChange = (e) => {
    const formatted = formatCpf(e.target.value);
    setForm((prev) => ({ ...prev, cpf: formatted }));
    const digits = formatted.replace(/\D/g, '');
    if (digits.length === 11) {
      if (!isValidCpf(formatted)) {
        setCpfError('CPF inválido (dígitos de verificação incorretos)');
      } else {
        setCpfError('');
      }
    } else if (digits.length > 0) {
      setCpfError('CPF incompleto (deve conter 11 dígitos)');
    } else {
      setCpfError('');
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const digits = (form.cpf || '').replace(/\D/g, '');
    if (digits.length > 0) {
      if (!isValidCpf(form.cpf)) {
        setCpfError('CPF inválido. Por favor, verifique os números digitados.');
        toast.error('CPF inválido. Por favor, digite um CPF válido.');
        return;
      }
    }

    setSaving(true);
    try {
      const u = await api.put('/api/users/me', form);
      setUser(u);
      setCpfError('');
      toast.success('Perfil atualizado');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8" data-testid="my-account">
      <h1 className="font-heading font-black text-3xl text-txt-primary flex items-center gap-3"><User className="w-7 h-7 text-brand-main" /> Minha conta</h1>

      <form onSubmit={submit} className="bg-white rounded-xl border border-border p-6 space-y-4 shadow-sm">
        <h2 className="font-bold text-lg">Dados pessoais</h2>
        <Input label="Email" value={user?.email} disabled />
        <Input label="Nome completo" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <Input label="Telefone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" />
        
        <div>
          <Input
            label="CPF"
            value={form.cpf}
            onChange={handleCpfChange}
            placeholder="000.000.000-00"
            maxLength={14}
            className={cpfError ? 'border-red-500 focus:ring-red-500' : ''}
            data-testid="input-cpf"
          />
          {cpfError ? (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1 font-medium" data-testid="cpf-error-msg">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {cpfError}
            </p>
          ) : form.cpf && form.cpf.replace(/\D/g, '').length === 11 ? (
            <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1 font-medium" data-testid="cpf-valid-msg">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> CPF válido
            </p>
          ) : null}
        </div>

        <Button type="submit" loading={saving}><Save className="w-4 h-4" /> Salvar</Button>
      </form>

      {/* Se o usuário for funcionário de empresa credenciada, renderiza o Cartão Consignado */}
      <MyConsignmentCard />
    </div>
  );
}
