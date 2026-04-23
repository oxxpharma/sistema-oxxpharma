import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get('redirect') || '/';
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await login(form.email, form.password);
      toast.success(`Olá, ${u.name.split(' ')[0]}!`);
      navigate(u.role === 'admin' || u.access_level <= 1 ? (redirect === '/' ? '/backoffice' : redirect) : redirect);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-secondary flex items-center justify-center p-4" data-testid="login-page">
      <div className="max-w-md w-full">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-txt-secondary hover:text-brand-main mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar para a loja
        </Link>
        <div className="bg-white rounded-2xl border border-border p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-lg bg-brand-main flex items-center justify-center">
              <span className="text-white font-heading font-black">O</span>
            </div>
            <span className="font-heading font-black text-xl">OxxPharma</span>
          </div>
          <h1 className="font-heading font-black text-2xl mb-1">Entrar</h1>
          <p className="text-sm text-txt-secondary mb-6">Acesse sua conta</p>
          <form onSubmit={submit} className="space-y-4">
            <Input label="Email" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} data-testid="login-email" />
            <Input label="Senha" type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} data-testid="login-password" />
            <Button type="submit" loading={loading} className="w-full" size="lg" data-testid="login-submit">Entrar</Button>
          </form>
          <p className="text-sm text-center text-txt-secondary mt-6">
            Não tem conta? <Link to="/cadastrar" className="text-brand-main font-semibold">Cadastre-se</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
