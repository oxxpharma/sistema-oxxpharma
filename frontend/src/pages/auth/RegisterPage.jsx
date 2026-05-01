import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useReferral } from '../../contexts/RefContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { toast } from 'sonner';
import { ArrowLeft, Share2 } from 'lucide-react';
import BrandLogo from '../../components/branding/BrandLogo';

export default function RegisterPage() {
  const { register } = useAuth();
  const { refCode, refName } = useReferral();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', cpf: '' });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) { toast.error('Senha deve ter no mínimo 6 caracteres'); return; }
    setLoading(true);
    try {
      await register({ ...form, sponsor_code: refCode || undefined });
      toast.success('Conta criada com sucesso!');
      navigate('/');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-secondary flex items-center justify-center p-4" data-testid="register-page">
      <div className="max-w-md w-full">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-txt-secondary hover:text-brand-main mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar para a loja
        </Link>
        <div className="bg-white rounded-2xl border border-border p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <BrandLogo slot="auth_pages" variant="light" textClassName="font-heading font-black text-xl" />
          </div>
          <h1 className="font-heading font-black text-2xl mb-1">Criar conta</h1>
          <p className="text-sm text-txt-secondary mb-6">Leva menos de 1 minuto</p>

          {refName && (
            <div className="bg-brand-light border border-brand-main/20 rounded-lg p-3 mb-4 flex items-center gap-2 text-xs" data-testid="sponsor-info">
              <Share2 className="w-4 h-4 text-brand-main" />
              <div>
                Indicado por <strong className="text-brand-main">{refName}</strong>
              </div>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <Input label="Nome completo" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="reg-name" />
            <Input label="Email" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} data-testid="reg-email" />
            <Input label="Telefone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" />
            <Input label="CPF" value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" data-testid="reg-cpf" hint="Necessário para receber benefícios e pontos do programa." />
            <Input label="Senha" type="password" required minLength={6} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} hint="Mínimo 6 caracteres" data-testid="reg-password" />
            <Button type="submit" loading={loading} className="w-full" size="lg" data-testid="reg-submit">Criar conta</Button>
          </form>
          <p className="text-sm text-center text-txt-secondary mt-6">
            Já tem conta? <Link to="/login" className="text-brand-main font-semibold">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
