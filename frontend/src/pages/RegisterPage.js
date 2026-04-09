import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff } from 'lucide-react';

const LOGO_URL = 'https://customer-assets.emergentagent.com/job_oxx-franchise-system/artifacts/5hmh2yiu_image.png';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', sponsor_code: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({ ...form, access_level: 5 });
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-secondary p-4 font-body">
      <div className="w-full max-w-sm bg-white border border-border rounded-md p-6">
        <div className="flex items-center gap-2 mb-8">
          <img src={LOGO_URL} alt="OxxPharma" className="h-8" />
          <span className="font-heading font-bold text-xl text-txt-primary tracking-tight">OxxPharma</span>
        </div>
        <h1 className="font-heading font-bold text-xl text-txt-primary tracking-tight">Cadastre-se</h1>
        <p className="text-sm text-txt-secondary mt-1">Crie sua conta para comecar</p>

        {error && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-accent-red" data-testid="register-error">{error}</div>}

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-txt-secondary mb-1">Nome</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
              className="w-full px-3 py-2.5 border border-border rounded-md text-sm" required data-testid="register-name" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-txt-secondary mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
              className="w-full px-3 py-2.5 border border-border rounded-md text-sm" required data-testid="register-email" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-txt-secondary mb-1">Senha</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                className="w-full px-3 py-2.5 border border-border rounded-md text-sm pr-10" required data-testid="register-password" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-secondary">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-txt-secondary mb-1">Telefone</label>
            <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
              className="w-full px-3 py-2.5 border border-border rounded-md text-sm" data-testid="register-phone" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-txt-secondary mb-1">Codigo de Indicacao (opcional)</label>
            <input value={form.sponsor_code} onChange={e => setForm({...form, sponsor_code: e.target.value})}
              className="w-full px-3 py-2.5 border border-border rounded-md text-sm" data-testid="register-sponsor" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-brand-main text-white font-semibold text-sm rounded-md hover:bg-brand-hover disabled:opacity-50"
            data-testid="register-submit-btn">
            {loading ? 'Cadastrando...' : 'Cadastrar'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-txt-secondary">
          Ja tem conta? <Link to="/login" className="text-brand-main font-semibold hover:underline">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
