import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { User, Save, AlertCircle, CheckCircle2, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { formatCpf, isValidCpf } from '../../lib/utils';

import MyConsignmentCard from '../../components/convenio/MyConsignmentCard';

export default function MyAccount() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    cpf: user?.cpf ? formatCpf(user.cpf) : '',
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [saving, setSaving] = useState(false);
  const [cpfError, setCpfError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Sincroniza o formulário quando o usuário é carregado
  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        name: user.name || '',
        phone: user.phone || '',
        cpf: user.cpf ? formatCpf(user.cpf) : '',
      }));
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
    setPasswordError('');

    // Validação de CPF
    const digits = (form.cpf || '').replace(/\D/g, '');
    if (digits.length > 0) {
      if (!isValidCpf(form.cpf)) {
        setCpfError('CPF inválido. Por favor, verifique os números digitados.');
        toast.error('CPF inválido. Por favor, digite um CPF válido.');
        return;
      }
    }

    // Validação de alteração de senha
    const isChangingPassword = Boolean(form.new_password || form.confirm_password || form.current_password);
    if (isChangingPassword) {
      if (!form.current_password) {
        setPasswordError('Informe sua senha atual para alterar a senha.');
        toast.error('Informe sua senha atual para alterar a senha.');
        return;
      }
      if (!form.new_password || form.new_password.length < 6) {
        setPasswordError('A nova senha deve ter no mínimo 6 caracteres.');
        toast.error('A nova senha deve ter no mínimo 6 caracteres.');
        return;
      }
      if (form.new_password !== form.confirm_password) {
        setPasswordError('A confirmação da nova senha não coincide.');
        toast.error('A confirmação da nova senha não coincide.');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        phone: form.phone,
        cpf: form.cpf,
      };

      if (isChangingPassword) {
        payload.current_password = form.current_password;
        payload.new_password = form.new_password;
      }

      const u = await api.put('/api/users/me', payload);
      setUser(u);
      setCpfError('');
      setPasswordError('');

      // Limpa os campos de senha após salvar com sucesso
      setForm((prev) => ({
        ...prev,
        current_password: '',
        new_password: '',
        confirm_password: '',
      }));

      if (isChangingPassword) {
        toast.success('Perfil e senha atualizados com sucesso!');
      } else {
        toast.success('Perfil atualizado com sucesso!');
      }
    } catch (err) {
      const msg = err.message || 'Erro ao atualizar perfil';
      toast.error(msg);
      if (msg.toLowerCase().includes('senha')) {
        setPasswordError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8" data-testid="my-account">
      <h1 className="font-heading font-black text-3xl text-txt-primary flex items-center gap-3">
        <User className="w-7 h-7 text-brand-main" /> Minha conta
      </h1>

      <form onSubmit={submit} className="bg-white rounded-xl border border-border p-6 space-y-6 shadow-sm">
        {/* Seção Dados Pessoais */}
        <div className="space-y-4">
          <h2 className="font-bold text-lg text-txt-primary">Dados pessoais</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Email" value={user?.email || ''} disabled hint="O email de login não pode ser alterado" />
            <Input
              label="Nome completo"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Telefone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="(11) 99999-9999"
            />
            
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
          </div>
        </div>

        {/* Seção Segurança / Alterar Senha */}
        <div className="pt-6 border-t border-border space-y-4">
          <div>
            <h2 className="font-bold text-lg text-txt-primary flex items-center gap-2">
              <Lock className="w-5 h-5 text-brand-main" /> Alterar Senha
            </h2>
            <p className="text-xs text-txt-secondary mt-1">
              Deixe os campos abaixo em branco caso não queira alterar sua senha de acesso.
            </p>
          </div>

          {passwordError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{passwordError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Input
                label="Senha atual"
                type={showCurrentPw ? 'text' : 'password'}
                placeholder="Digite a senha atual"
                value={form.current_password}
                onChange={(e) => setForm({ ...form, current_password: e.target.value })}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 transition"
                onClick={() => setShowCurrentPw(!showCurrentPw)}
                tabIndex={-1}
                title={showCurrentPw ? 'Ocultar senha' : 'Ver senha'}
              >
                {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="relative">
              <Input
                label="Nova senha"
                type={showNewPw ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres"
                value={form.new_password}
                onChange={(e) => setForm({ ...form, new_password: e.target.value })}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 transition"
                onClick={() => setShowNewPw(!showNewPw)}
                tabIndex={-1}
                title={showNewPw ? 'Ocultar senha' : 'Ver senha'}
              >
                {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="relative">
              <Input
                label="Confirmar nova senha"
                type={showConfirmPw ? 'text' : 'password'}
                placeholder="Repita a nova senha"
                value={form.confirm_password}
                onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 transition"
                onClick={() => setShowConfirmPw(!showConfirmPw)}
                tabIndex={-1}
                title={showConfirmPw ? 'Ocultar senha' : 'Ver senha'}
              >
                {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <Button type="submit" loading={saving} size="lg" className="min-w-[140px]">
            <Save className="w-4 h-4 mr-2" /> Salvar alterações
          </Button>
        </div>
      </form>

      {/* Se o usuário for funcionário de empresa credenciada, renderiza o Cartão Consignado */}
      <MyConsignmentCard />
    </div>
  );
}
